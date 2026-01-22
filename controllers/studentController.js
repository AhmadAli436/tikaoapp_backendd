import Student from '../models/Student.js';
import Class from '../models/Class.js';
import Board from '../models/Board.js';
import AWS from 'aws-sdk';
import jwt from 'jsonwebtoken';
import { body, validationResult } from 'express-validator';
import Batch from '../models/Batch.js';
import Subject from '../models/Subject.js';
import Chapter from '../models/Chapter.js';
import Notification from '../models/Notification.js';
import MockTest from '../models/MockTest.js'; // Assuming it exists
import mongoose from 'mongoose';
import AppUser from '../models/AppUser.js';
import nodemailer from 'nodemailer';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'; // AWS SDK v3
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import Teacher from '../models/Teacher.js';
import dotenv from 'dotenv';


dotenv.config();
// Configure AWS S3
const s3Client = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
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

// Generate 6-digit PIN
const generatePin = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// Generate presigned URL for S3 upload
// Generate a random alphanumeric code (e.g., 6 characters)
const generateCode = () => {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
};

// Generate unique student UID
const generateUniqueStudentUID = async () => {
  let uid;
  let exists = true;

  while (exists) {
    uid = `INSS${generateCode()}`;
    const existing = await Student.findOne({ uid });
    if (!existing) exists = false;
  }

  return uid;
};

// Generate unique student referral code
const generateUniqueStudentReferralCode = async () => {
  let referralCode;
  let exists = true;

  while (exists) {
    referralCode = `INSS${generateCode()}`;
    const existing = await Student.findOne({ referralCode });
    if (!existing) exists = false;
  }

  return referralCode;
};
// Create a new student
export const createStudent = async (req, res) => {
  try {
    const {
      userId,
      mobile,
      name,
      gender,
      title,
      fatherTitle,
      motherTitle,
      studentUid,
      state,
      pinCode,
      parentsMobile,
      parentEmail,
      fatherName,
      motherName,
      fatherOccupation,
      motherOccupation,
      classId,
      schoolName,
      boardId,
      affiliatedReferralCode,
      avatarUrl,
      createdByAdmin,
      billingCode,
    } = req.body;

    // 🔍 Fetch user (for fallback mobile)
    const user = await AppUser.findById(userId);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const finalMobile = mobile || user.mobile;

    // ✅ Validate class and board
    const classDoc = await Class.findById(classId);
    if (!classDoc) return res.status(400).json({ message: 'Class not found' });

    const boardDoc = await Board.findById(boardId);
    if (!boardDoc) return res.status(400).json({ message: 'Board not found' });

    // ✅ Check if student exists (for uid/referralCode reuse or generate)
    let existingStudent = await Student.findOne({ userId });

    let uid, referralCode;

    if (existingStudent) {
      // Always validate uniqueness for UID
      const uidInUse = existingStudent.uid
        ? await Student.findOne({ uid: existingStudent.uid, _id: { $ne: existingStudent._id } })
        : true;

      uid = (!existingStudent.uid || uidInUse)
        ? await generateUniqueStudentUID()
        : existingStudent.uid;

      // Always validate uniqueness for referralCode
      const referralInUse = existingStudent.referralCode
        ? await Student.findOne({ referralCode: existingStudent.referralCode, _id: { $ne: existingStudent._id } })
        : true;

      referralCode = (!existingStudent.referralCode || referralInUse)
        ? await generateUniqueStudentReferralCode()
        : existingStudent.referralCode;

    } else {
      uid = await generateUniqueStudentUID();
      referralCode = await generateUniqueStudentReferralCode();
    }


    // ✅ Prepare student data
    const studentData = {
      userId,
      name,
      uid,
      referralCode,
      mobile: finalMobile,
      gender,
      state,
      pinCode,
      parentsMobile,
      title,
      fatherTitle,
      motherTitle,
      studentUid,
      parentEmail,
      fatherName,
      motherName,
      fatherOccupation,
      motherOccupation,
      classId,
      className: classDoc.name,
      schoolName,
      boardId,
      boardName: boardDoc.name,
      billingCode,
      affiliatedReferralCode,
      avatarUrl: avatarUrl || '',
      createdByAdmin,
    };

    // ✅ Create or update using findOneAndUpdate
    const student = await Student.findOneAndUpdate(
      { userId },
      { $set: studentData },
      { new: true, upsert: true }
    );

    // 📧 Send confirmation email to parent
    // 📧 Send confirmation email to parent
    if (student.parentEmail) {
      // Generate HTML for student details
const studentDetailsHtml = `
  <p><strong>User ID:</strong> ${studentData.userId}</p>
  <p><strong>Name:</strong> ${studentData.name}</p>
  <p><strong>Mobile:</strong> ${studentData.mobile}</p>
  <p><strong>Gender:</strong> ${studentData.gender}</p>
  <p><strong>State:</strong> ${studentData.state}</p>
  <p><strong>Pin Code:</strong> ${studentData.pinCode}</p>
  <p><strong>Parent's Mobile:</strong> ${studentData.parentsMobile}</p>
  <p><strong>Title:</strong> ${studentData.title}</p>
  <p><strong>Father's Title:</strong> ${studentData.fatherTitle}</p>
  <p><strong>Mother's Title:</strong> ${studentData.motherTitle}</p>
  <p><strong>Student UID:</strong> ${studentData.studentUid}</p>
  <p><strong>Parent Email:</strong> ${studentData.parentEmail}</p>
  <p><strong>Father's Name:</strong> ${studentData.fatherName}</p>
  <p><strong>Mother's Name:</strong> ${studentData.motherName}</p>
  <p><strong>Father's Occupation:</strong> ${studentData.fatherOccupation}</p>
  <p><strong>Mother's Occupation:</strong> ${studentData.motherOccupation}</p>
  <p><strong>Class ID:</strong> ${studentData.classId}</p>
  <p><strong>Class Name:</strong> ${studentData.className}</p>
  <p><strong>School Name:</strong> ${studentData.schoolName}</p>
  <p><strong>Board ID:</strong> ${studentData.boardId}</p>
  <p><strong>Board Name:</strong> ${studentData.boardName}</p>
  <p><strong>Affiliated Referral Code:</strong> ${studentData.affiliatedReferralCode}</p>
  <p><strong>Avatar URL:</strong> ${studentData.avatarUrl || 'N/A'}</p>
  <p><strong>Created By Admin:</strong> ${studentData.createdByAdmin ? 'Yes' : 'No'}</p>
`;

const mailOptions = {
  to: studentData.parentEmail,
  subject: 'Welcome to Smart Education – Your Student Profile Is Under Review',
  html: `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <link href="https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css" rel="stylesheet">
      <style>
        @media only screen and (max-width: 600px) {
          .container { width: 100% !important; padding: 10px !important; }
          .header { height: auto !important; }
          .footer { flex-direction: column !important; text-align: center !important; }
          .footer-left, .footer-right { width: 100% !important; }
          .social-icons { justify-content: center !important; }
        }
        * { box-sizing: border-box; }
        body { margin: 0; padding: 0; }
      </style>
    </head>
    <body style="background-color: #f3f4f6; font-family: Arial, sans-serif;">
      <div class="container" style="max-width: 600px; margin: 20px auto; background-color: #ffffff; padding: 0;">
        <!-- Blue Header -->
        <div class="header" style="background-color: #1e90ff; color: #ffffff; padding: 20px; text-align: left;">
          <h2 style="margin: 0; font-size: 18px;">Hey ${studentData.name || 'Student'},</h2>
          <p style="margin: 5px 0 0; font-size: 16px;">Thank you for registering as a student with Smart Education!</p>
        </div>
        <!-- White Body -->
        <div style="padding: 20px; color: #333333;">
          <p style="margin: 0 0 15px; font-size: 16px;">We've received your details and your profile is currently under review.</p>
          <h3 style="margin: 0 0 10px; font-size: 18px; font-weight: bold;">What's next?</h3>
          <ul style="margin: 0 0 15px; padding-left: 20px; font-size: 16px;">
            <li>If you've made an offline payment, it will be verified by our team.</li>
            <li>Once verified, your profile will be approved by the admin.</li>
            <li>You'll get access to the platform once your profile is approved by the admin.</li>
            <li>Someone from your center will also reach out to guide you through the next steps.</li>
          </ul>
          <h3 style="margin: 0 0 10px; font-size: 18px; font-weight: bold;">Here's a quick summary of the details you submitted:</h3>
          <div style="margin-bottom: 15px; font-size: 16px;">
            ${studentDetailsHtml}
          </div>
          <p style="margin: 0 0 15px; font-size: 16px;">We'll notify you once your application is reviewed.</p>
          <p style="margin: 0 0 15px; font-size: 16px;">If you have any questions in the meantime, feel free to reach out.</p>
          <p style="margin: 0 0 15px; font-size: 16px;">Warm regards,<br>Team Smart Education</p>
        </div>
        <!-- Black Footer -->
        <div class="footer" style="background-color: #000000; color: #ffffff; padding: 20px; display: flex; justify-content: space-between; align-items: center;">
          <div class="footer-left" style="display: flex; align-items: center;">
           <img src="https://insta-owel-admin-bucket.s3.ap-south-1.amazonaws.com/admin_asset/logoinstaowl.png" 
     alt="Smart Education Logo" 
     style="margin-right: 10px; width: 30px; height: 30px;">

            <div>
              <p style="margin: 0; font-size: 14px;">+91 9812132123</p>
              <p style="margin: 0; font-size: 14px;">hello@instaowl.com</p>
            </div>
          </div>
          <div class="footer-right" style="display: flex; align-items: center;">
            <div style="margin-right: 15px;">
              <p style="margin: 0; font-size: 14px;">Follow us</p>
              <div class="social-icons" style="display: flex; gap: 10px; margin-top: 5px;">
                <a href="https://www.youtube.com/instaowl" style="color: #ffffff; text-decoration: none;">
                  <img src="https://insta-owel-admin-bucket.s3.ap-south-1.amazonaws.com/admin_asset/youtubelogo.png" alt="YouTube" style="vertical-align: middle;">
                </a>
                <a href="https://www.instagram.com/instaowl" style="color: #ffffff; text-decoration: none;">
                  <img src="https://insta-owel-admin-bucket.s3.ap-south-1.amazonaws.com/admin_asset/instagramlogo.png" alt="Instagram" style="vertical-align: middle;">
                </a>
              </div>
            </div>
            <p style="margin: 0; font-size: 14px;"><a href="https://www.instaowl.com" style="color: #ffffff; text-decoration: none;">www.instaowl.com</a></p>
          </div>
        </div>
      </div>
    </body>
    </html>
  `,
};


    await sendEmail(mailOptions);
      console.log(`Email sent to ${student.parentEmail} for student UID: ${uid}`);
    }

    const response = {
      _id: student._id,
      uid: student.uid,
      referralCode: student.referralCode,
      studentUid: student.studentUid,
      name: student.name,
      mobile: student.mobile,
      parentEmail: student.parentEmail,
      avatarUrl: student.avatarUrl,
      classId: student.classId,
      className: student.className,
      boardId: student.boardId,
      boardName: student.boardName,
    };

    console.log('Created/updated student:', response);
    res.status(201).json({ message: 'Student created/updated successfully and email sent', student: response });
  } catch (error) {
    console.error('Error creating/updating student or sending email:', error);
    res.status(500).json({ message: 'Error creating/updating student or sending email', error: error.message });
  }
};

// Generate presigned S3 URL
// Generate presigned S3 URL
export const getPresignedUrl = async (req, res) => {
  try {
    const { fileName, fileType } = req.body;

    if (!fileName || !fileType) {
      return res.status(400).json({ message: 'fileName and fileType are required' });
    }

    const allowedFileTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedFileTypes.includes(fileType)) {
      return res.status(400).json({ message: `Invalid file type. Allowed types: ${allowedFileTypes.join(', ')}` });
    }

    const allowedExtensions = ['jpg', 'jpeg', 'png', 'webp'];
    const fileExtension = fileName.split('.').pop().toLowerCase();
    if (!allowedExtensions.includes(fileExtension)) {
      return res.status(400).json({ message: `Invalid file extension. Allowed extensions: ${allowedExtensions.join(', ')}` });
    }

    const key = `avatars/${Date.now()}.${fileExtension}`;
    const bucketName = process.env.S3_BUCKET_NAME;

    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: key,
      ContentType: fileType,
    });

    // Use the instantiated s3Client
    const url = await getSignedUrl(s3Client, command, { expiresIn: 3600 });
    console.log(`Generated presigned URL for key: ${key}`);

    res.json({
      url,
      filePath: `https://${bucketName}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`,
    });
  } catch (error) {
    console.error('Error generating presigned URL:', {
      message: error.message,
      stack: error.stack,
      code: error.code,
      name: error.name,
    });
    res.status(500).json({ message: 'Failed to generate presigned URL', error: error.message });
  }
};


// Update a student
export const updateStudent = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      mobile,
      name,
      gender,
      state,
      pinCode,
      parentsMobile,
      parentEmail,
      fatherName,
      motherName,
      fatherOccupation,
      motherOccupation,
      classId,
      schoolName,
      boardId,
      affiliatedReferralCode,
      avatarUrl,
      title, // Added
      fatherTitle, // Added
      motherTitle, // Added
      studentUid, // Added
    } = req.body;

    // Validate ObjectId
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ message: 'Invalid student ID format' });
    }

    // Verify classId and get className
    const classDoc = await Class.findById(classId);
    if (!classDoc) {
      return res.status(400).json({ message: 'Class not found' });
    }

    // Verify boardId and get boardName
    const boardDoc = await Board.findById(boardId);
    if (!boardDoc) {
      return res.status(400).json({ message: 'Board not found' });
    }

    // Update student
    const updatedStudent = await Student.findByIdAndUpdate(
      id,
      {
        name,
        mobile,
        gender,
        state,
        pinCode,
        parentsMobile,
        parentEmail,
        fatherName,
        motherName,
        fatherOccupation,
        motherOccupation,
        classId,
        className: classDoc.name,
        schoolName,
        boardId,
        boardName: boardDoc.name,
        affiliatedReferralCode: affiliatedReferralCode || '',
        avatarUrl: avatarUrl || '',
        title, // Added
        fatherTitle, // Added
        motherTitle, // Added
        studentUid, // Added
      },
      { new: true, runValidators: true }
    )
      .populate('classId', 'name')
      .populate('boardId', 'name')
      .populate({
        path: 'assignedTeachers.teacherId',
        select: 'name',
      })
      .populate({
        path: 'assignedTeachers.subjectId',
        select: 'name',
      })
      .lean();

    if (!updatedStudent) {
      return res.status(404).json({ message: 'Student not found' });
    }

    const response = {
      _id: updatedStudent._id,
      uid: updatedStudent.uid,
      referralCode: updatedStudent.referralCode,
      studentUid: updatedStudent.studentUid, // Added
      name: updatedStudent.name,
      mobile: updatedStudent.mobile,
      parentEmail: updatedStudent.parentEmail,
      avatarUrl: updatedStudent.avatarUrl,
      classId: updatedStudent.classId._id,
      className: updatedStudent.className,
      boardId: updatedStudent.boardId._id,
      boardName: updatedStudent.boardName,
      gender: updatedStudent.gender,
      state: updatedStudent.state,
      pinCode: updatedStudent.pinCode,
      parentsMobile: updatedStudent.parentsMobile,
      fatherName: updatedStudent.fatherName,
      motherName: updatedStudent.motherName,
      fatherOccupation: updatedStudent.fatherOccupation,
      motherOccupation: updatedStudent.motherOccupation,
      schoolName: updatedStudent.schoolName,
      billingCode: updatedStudent.billingCode,
      affiliatedReferralCode: updatedStudent.affiliatedReferralCode,
      termsAccepted: updatedStudent.termsAccepted,
      assignedTeachers: updatedStudent.assignedTeachers,
      title: updatedStudent.title, // Added
      fatherTitle: updatedStudent.fatherTitle, // Added
      motherTitle: updatedStudent.motherTitle, // Added
    };

    console.log('Updated student:', response);
    res.status(200).json({ message: 'Student updated successfully', student: response });
  } catch (error) {
    console.error('Error updating student:', error);
    res.status(500).json({ message: 'Error updating student', error: error.message });
  }
};
// Authentication middleware
const authMiddleware = async (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    return res.status(401).json({ message: 'No token provided' });
  }
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log("Decoded Token ==>", decoded);
    if (decoded.userId !== req.body.userId && decoded.userId !== req.params.userId) {
      return res.status(403).json({ message: 'Unauthorized' });
    }
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Invalid token' });
  }
};

// Get Classes Endpoint
// Get Classes Endpoint
export const getClasses = async (req, res) => {
  try {
    const classes = await Class.find().select('name').exec();
    res.json(classes); // Return full documents with _id and name
  } catch (err) {
    console.error('Error in get-classes:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// Get Boards Endpoint
export const getBoards = async (req, res) => {
  try {
    const boards = await Board.find().select('name').exec();
    res.json(boards); // Return full documents with _id and name
  } catch (err) {
    console.error('Error in get-boards:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

//get subjects
export const getSubjects = async (req, res) => {
  const { classId } = req.params;
  console.log('Received get subjects request:', { classId });
  try {
    const subjects = await Subject.find({ class: classId }).exec();
    res.json({ subjects });
  } catch (err) {
    console.error('Error in get-subjects:', err);
    res.status(500).json({ message: err.message });
  }
};
//Ali this route is expecting multiple array of classes
export const getMultipleSubjects = async (req, res) => {
  const { classIds } = req.body; // Expecting an array of class IDs in the body
  console.log('Received get subjects request:', { classIds });

  try {
    // Validate classIds
    if (!Array.isArray(classIds) || classIds.length === 0) {
      return res.status(400).json({ message: 'classIds must be a non-empty array' });
    }

    // Fetch subjects for all provided class IDs
    const subjects = await Subject.find({ class: { $in: classIds } }).exec();
    res.json({ subjects });
  } catch (err) {
    console.error('Error in get-subjects:', err);
    res.status(500).json({ message: err.message });
  }
};



