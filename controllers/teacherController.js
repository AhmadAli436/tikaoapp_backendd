
import jwt from 'jsonwebtoken';
import Teacher from '../models/Teacher.js';
import nodemailer from 'nodemailer';
import AWS from 'aws-sdk';
import AppUser from '../models/AppUser.js';
import Student from '../models/Student.js';
import ShortFormProgress from '../models/ShortFormProgress.js';
import VideoProgress from '../models/VideoProgress.js';
import ShortFormContent from '../models/ShortFormContent.js';
import Chapter from '../models/Chapter.js';
import Subject from '../models/Subject.js';



const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION,
});

// Configure Nodemailer with Gmail SMTP
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: parseInt(process.env.EMAIL_PORT),
  secure: process.env.EMAIL_SECURE === 'true',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

const sendEmail = async ({ to, subject, html }) => {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.warn('Email credentials not configured. Skipping email send.');
    return;
  }

  try {
    await transporter.sendMail({
      from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
      to,
      subject,
      html,
    });
    console.log(`Email sent successfully to ${to}`);
  } catch (error) {
    console.error('Error sending email:', error);
    throw error;
  }
};

// Generate presigned URL for S3 upload
export const getPresignedUrl = async (req, res) => {
  try {
    const { fileName, fileType } = req.body;
    const key = `avatars/${Date.now()}-${fileName}`;
    const params = {
      Bucket: process.env.S3_BUCKET_NAME,
      Key: key,
      Expires: 60,
      ContentType: fileType,
    };
    const url = await s3.getSignedUrlPromise('putObject', params);
    res.json({ url });
  } catch (error) {
    console.error('Error generating presigned URL:', error);
    res.status(500).json({ message: 'Failed to generate presigned URL' });
  }
};
const generateCode = () => {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
};

const generateUniqueTeacherUID = async () => {
  let uid;
  let exists = true;

  while (exists) {
    uid = `INST${generateCode()}`;
    const existing = await Teacher.findOne({ uid });
    if (!existing) exists = false;
  }

  return uid;
};

export const getStudentListBasic = async (req, res) => {
  try {
    const { teacherId } = req.params;

    const teacher = await Teacher.findById(teacherId).select("students").lean();
    if (!teacher) {
      return res.status(404).json({ message: "Teacher not found" });
    }

    const students = await Student.find(
      { _id: { $in: teacher.students } },
      "name avatarUrl className boardName userId classId"
    ).lean();

    const enrichedStudents = await Promise.all(
      students.map(async (student) => {
        const userId = student.userId?.toString();
        if (!userId) {
          return {
            ...student,
            courseCompletionPercentage: 0,
            accuracyPercentage: 0,
          };
        }

        /** 1️⃣ Get all subjects for this student's class **/
        const allSubjects = await Subject.find({ class: student.classId }).lean();
        const subjectIds = allSubjects.map(s => s._id);

        /** 2️⃣ Get all chapters for these subjects **/
        const allChapters = await Chapter.find({
          subject: { $in: subjectIds }
        }).lean();

        const allChapterIds = allChapters.map(ch => ch._id.toString());

        let completedChaptersSet = new Set();
        let totalMcqs = 0;
        let mcqsAttempted = 0;
        let correctMcqs = 0;
        let totalWatchTime = 0;
        let totalTime = 0;

        /** ---- Long Form Progress ---- **/
        const longFormProgresses = await VideoProgress.find({ userId }).lean();
        for (const p of longFormProgresses) {
          const chapterId = p.chapterId?.toString();
          if (!chapterId) continue;

          if (p.isWatched) completedChaptersSet.add(chapterId);

          totalWatchTime += p.resumeTime || 0;
          totalTime += p.totalTime || 0;

          mcqsAttempted += p.mcqsAttempted || 0;
          correctMcqs += p.correctMcqs || 0;
        }

        /** ---- Short Form Progress ---- **/
        const shortFormProgresses = await ShortFormProgress.find({ userId }).lean();
        const shortFormIds = shortFormProgresses.map((p) => p.shortFormId);
        const shortFormContents = await ShortFormContent.find({
          _id: { $in: shortFormIds },
        }).lean();

        const shortFormMap = {};
        shortFormContents.forEach((sf) => {
          shortFormMap[sf._id.toString()] = sf;
        });

        for (const sp of shortFormProgresses) {
          const shortForm = shortFormMap[sp.shortFormId?.toString()];
          if (!shortForm) continue;

          const chapterId = sp.chapterId?.toString();
          if (!chapterId) continue;

          const clips = shortForm.sequence.filter((s) => s.type === "clip");
          const mcqs = shortForm.sequence.filter((s) => s.type === "mcq");

          totalMcqs += mcqs.length;

          const attemptedMcqs = new Set(
            (sp.attemptedMcqIds || []).map((id) => id.toString())
          ).size;
          mcqsAttempted += attemptedMcqs;
          correctMcqs += sp.correctCount || 0;

          // Watch time
          let totalClipDuration = 0;
          let watchedClipDuration = 0;
          clips.forEach((clip, idx) => {
            const dur = clip.duration || 0;
            totalClipDuration += dur;
            if (sp.watchedClipIndexes?.includes(idx)) {
              watchedClipDuration += dur;
            }
          });
          totalWatchTime += watchedClipDuration;
          totalTime += totalClipDuration;

          // Chapter completion check
          const watchedClips = new Set(sp.watchedClipIndexes || []).size;
          if (watchedClips >= clips.length && attemptedMcqs >= mcqs.length) {
            completedChaptersSet.add(chapterId);
          }
        }

        /** ---- Accurate Percentages (like getUnifiedProgressReport) ---- **/
        const overallTotalChapters = allChapterIds.length;
        const overallCompletedChapters = completedChaptersSet.size;

        const courseCompletionPercentage =
          overallTotalChapters > 0
            ? Math.round(
              (overallCompletedChapters / overallTotalChapters) * 100
            )
            : 0;

        const accuracyPercentage =
          mcqsAttempted > 0
            ? Math.round((correctMcqs / mcqsAttempted) * 100)
            : 0;

        return {
          ...student,
          courseCompletionPercentage,
          accuracyPercentage,
          totalMcqs,
          mcqsAttempted,
          correctMcqs,
          totalWatchTime,
          totalTime,
        };
      })
    );

    return res.status(200).json({
      message: "Student list with progress fetched successfully",
      data: enrichedStudents,
    });
  } catch (error) {
    console.error("Error fetching student list with progress:", error);
    return res.status(500).json({
      message: "Server error while fetching student list with progress",
      error: error.message,
    });
  }
};


const generateUniqueTeacherReferralCode = async () => {
  let referralCode;
  let exists = true;

  while (exists) {
    referralCode = `INST${generateCode()}`;
    const existing = await Teacher.findOne({ referralCode });
    if (!existing) exists = false;
  }

  return referralCode;
};


export const createTeacher = async (req, res) => {
  try {
    const {
      userId,
      mobile, // May or may not be provided
      name,
      gender,
      email,
      state,
      pinCode,
      instituteName,
      qualification,
      board,
      classes,
      subjects,
      title,
      bio,
      billingCode,
      termsAccepted = true,
      createdByAdmin = false,
      avatarUrl
    } = req.body;

    // 🔍 Fetch user to get existing mobile if not provided
    const user = await AppUser.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const finalMobile = mobile || user.mobile; // ✅ Use existing if not provided

    // ❌ Check if teacher with same email already exists
    const existingTeacher = await Teacher.findOne({ email });
    if (existingTeacher) {
      return res.status(400).json({ message: 'This email is already registered' });
    }

    // 🆕 Generate UID and Referral Code
    // 🆕 Generate UID and Referral Code with uniqueness check
    let uid, referralCode;
    const existingTeacherByUser = await Teacher.findOne({ userId });

    if (existingTeacherByUser) {
      // Check UID uniqueness
      const uidInUse = existingTeacherByUser.uid
        ? await Teacher.findOne({ uid: existingTeacherByUser.uid, _id: { $ne: existingTeacherByUser._id } })
        : true;

      uid = (!existingTeacherByUser.uid || uidInUse)
        ? await generateUniqueTeacherUID()
        : existingTeacherByUser.uid;

      // Check Referral Code uniqueness
      const referralInUse = existingTeacherByUser.referralCode
        ? await Teacher.findOne({ referralCode: existingTeacherByUser.referralCode, _id: { $ne: existingTeacherByUser._id } })
        : true;

      referralCode = (!existingTeacherByUser.referralCode || referralInUse)
        ? await generateUniqueTeacherReferralCode()
        : existingTeacherByUser.referralCode;

    } else {
      // New teacher → generate fresh codes
      uid = await generateUniqueTeacherUID();
      referralCode = await generateUniqueTeacherReferralCode();
    }


    // ✅ Build teacher data with safe mobile
    const teacherData = {
      userId,
      mobile: finalMobile,
      uid,
      name,
      gender,
      email,
      state,
      pinCode,
      instituteName,
      qualification,
      title,
      board,
      classes,
      subjects,
      bio,
      referralCode,
      termsAccepted,
      billingCode,
      createdByAdmin,
      avatarUrl
    };

    // ✅ Save new teacher
    const teacher = await Teacher.findOneAndUpdate(
      { userId },                   // Find teacher by userId
      { $set: teacherData },        // Update with new data
      { upsert: true, new: true }   // Create if not exists, return updated document
    );

     // 📧 Send email to teacher
   const mailOptions = {
  to: email,
  subject: 'Welcome to Smart Education – Your Teaching Assistant Profile Is Under Review',
  html: `
  <!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
      * { box-sizing: border-box; }
      body { margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f3f4f6; }
      .container { max-width: 600px; margin: 20px auto; background-color: #ffffff; padding: 0; }
      .header { background-color: #3b82f6; color: #ffffff; padding: 30px 20px; text-align: left; }
      .header h2 { margin: 0; font-size: 22px; }
      .header p { margin: 5px 0 0; font-size: 18px; }

      .body { padding: 20px; color: #333333; }
      .body p, .body li { font-size: 16px; line-height: 1.5; }
      .body h3 { margin: 20px 0 10px; font-size: 18px; font-weight: bold; }
      .body ul { padding-left: 20px; }

      .profile-table { width: 100%; border-collapse: collapse; margin: 15px 0; }
      .profile-table td { padding: 10px; border: 1px solid #e5e7eb; }
      .profile-table tr:nth-child(even) { background-color: #f3f4f6; }

      .footer { background-color: #000000; color: #ffffff; padding: 30px 20px; display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; }
      .footer-left { display: flex; gap: 15px; flex-direction: column; }
      .footer-left img { width: 30px; height: 30px; }
      .footer-left p { margin: 3px 0; font-size: 14px; }

      .footer-right { text-align: right; }
      .footer-right p { margin: 0 0 5px; font-size: 14px; }
      .social-icons { display: flex; gap: 10px; justify-content: flex-end; margin-bottom: 5px; }
      .social-icons img { width: 24px; height: 24px; }

      @media only screen and (max-width: 600px) {
        .footer { flex-direction: column; text-align: center; }
        .footer-left, .footer-right { width: 100%; text-align: center; }
        .social-icons { justify-content: center; }
      }
    </style>
  </head>
  <body>
    <div class="container">

      <!-- Header -->
      <div class="header">
        <h2>Hey ${name || 'Teaching Assistant'},</h2>
        <p>Thank you for registering as a Teaching Assistant with Smart Education!</p>
      </div>

      <!-- Body -->
      <div class="body">
        <p>We've received your details and your profile is currently under review.</p>

        <h3>What's next?</h3>
        <ul>
          <li>If you've made an offline payment, it will be verified by our team.</li>
          <li>Once verified, your profile will be approved by the admin.</li>
          <li>You'll get access to the platform once your profile is approved.</li>
          <li>Someone from your center will also reach out to guide you through the next steps.</li>
        </ul>

        <h3>Your Profile Details:</h3>
        <table class="profile-table">
          <tr><td>Name</td><td>${name || 'N/A'}</td></tr>
          <tr><td>Email</td><td>${email || 'N/A'}</td></tr>
          <tr><td>Mobile Number</td><td>${finalMobile || 'N/A'}</td></tr>
          <tr><td>Institute Name</td><td>${instituteName || 'N/A'}</td></tr>
          <tr><td>Qualification</td><td>${qualification || 'N/A'}</td></tr>
          <tr><td>Board</td><td>${board || 'N/A'}</td></tr>
          <tr><td>Classes</td><td>${classes?.length ? classes.join(', ') : 'N/A'}</td></tr>
          <tr><td>Subjects</td><td>${subjects?.length ? subjects.join(', ') : 'N/A'}</td></tr>
          <tr><td>State</td><td>${state || 'N/A'}</td></tr>
          <tr><td>Pin Code</td><td>${pinCode || 'N/A'}</td></tr>
          <tr><td>Bio</td><td>${bio || 'N/A'}</td></tr>
        </table>

        <p>We'll notify you once your application is reviewed.</p>
        <p>If you have any questions in the meantime, feel free to reach out.</p>
        <p>Warm regards,<br>Team Smart Education</p>
      </div>

      <!-- Footer -->
      <div class="footer">
        <div class="footer-left">
          <img src="https://insta-owel-admin-bucket.s3.ap-south-1.amazonaws.com/admin_asset/logoinstaowl.png" alt="Smart Education Logo">
          <p>+91 9812132123</p>
          <p>hello@instaowl.com</p>
        </div>
        <div class="footer-right">
          <div class="social-icons">
            <a href="https://www.youtube.com/instaowl"><img src="https://insta-owel-admin-bucket.s3.ap-south-1.amazonaws.com/admin_asset/youtubelogo.png" alt="YouTube"></a>
            <a href="https://www.instagram.com/instaowl"><img src="https://insta-owel-admin-bucket.s3.ap-south-1.amazonaws.com/admin_asset/instagramlogo.png" alt="Instagram"></a>
          </div>
          <p><a href="https://www.instaowl.com" style="color:#ffffff; text-decoration:none;">www.instaowl.com</a></p>
        </div>
      </div>

    </div>
  </body>
  </html>
  `,
};


    await sendEmail(mailOptions);
    console.log('Email sent to:', email);

    res.status(201).json({
      message: 'Teacher created successfully and email sent',
      teacher: {
        uid: teacher.uid,
        referralCode: teacher.referralCode,
        title: teacher.title,
        name: teacher.name,
        gender: teacher.gender,
        email: teacher.email,
        state: teacher.state,
        pinCode: teacher.pinCode,
        instituteName: teacher.instituteName,
        qualification: teacher.qualification,
        board: teacher.board,
        classes: teacher.classes,
        subjects: teacher.subjects,
        bio: teacher.bio,
        termsAccepted: teacher.termsAccepted,
        createdByAdmin: teacher.createdByAdmin,
        avatarUrl: teacher.avatarUrl,
        mobile: teacher.mobile // 🔄 Return the used mobile
      },
    });
  } catch (error) {
    console.error('Error creating teacher or sending email:', error);
    res.status(400).json({ message: 'Failed to create teacher or send email', error: error.message });
  }
};
export const updateTeacher = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    const teacher = await Teacher.findById(id);
    if (!teacher) {
      return res.status(404).json({ message: 'Teacher not found' });
    }

    // Prevent updating immutable fields
    delete updateData.uid;
    delete updateData.referralCode;
    delete updateData.createdAt;
    delete updateData.students;
    delete updateData.classes;
    delete updateData.subjects;
    delete updateData.billingCode;

    const updatedTeacher = await Teacher.findByIdAndUpdate(
      id,
      { $set: updateData },
      { new: true, runValidators: true }
    ).select('-__v');

    res.status(200).json({
      message: 'Teacher updated successfully',
      teacher: updatedTeacher,
    });
  } catch (error) {
    res.status(400).json({ message: 'Failed to update teacher', error: error.message });
  }
};