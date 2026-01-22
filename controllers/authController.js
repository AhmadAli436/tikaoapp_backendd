import jwt from 'jsonwebtoken';
import AppUser from '../models/AppUser.js';
import Teacher from '../models/Teacher.js';
import Student from '../models/Student.js';
import Token from '../models/Token.js';
import Subject from '../models/Subject.js';




// Middleware to verify JWT token
export const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    console.error('No token provided');
    return res.status(401).json({ message: 'Access token is required' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your_jwt_secret');
    const tokenDoc = await Token.findOne({ token, userId: decoded.userId }).exec();
    if (!tokenDoc || tokenDoc.expiry < new Date()) {
      console.error('Invalid or expired token in database');
      return res.status(401).json({ message: 'Invalid or expired token' });
    }
    const user = await AppUser.findById(decoded.userId).exec();
    if (!user) {
      console.error('User not found for token');
      return res.status(404).json({ message: 'Invalid token' });
    }
    req.user = user;
    next();
  } catch (err) {
    console.error('Token verification error:', err);
    return res.status(403).json({ message: 'Invalid or expired token' });
  }
};

// Send OTP to mobile
export const sendOTP = async (req, res) => {
  const { mobile } = req.body;
  console.log('Sending OTP request:', { mobile });
  try {
    const user = await AppUser.findOne({ mobile }).exec();
    let userStatus = { isNewUser: !user };

    if (user && user.role === 'teacher') {
      const teacher = await Teacher.findOne({ userId: user._id }).exec();
      if (teacher) {
        userStatus = {
          isNewUser: false,
          role: 'teacher',
          isApproved: teacher.isApproved,
          rejected: teacher.rejected,
          paymentStatus: user.paymentStatus || 'pending',
        };
      }
    } else if (user && user.role === 'student') {
      userStatus = { isNewUser: false, role: 'student', paymentStatus: user.paymentStatus || 'pending' };
    }

    console.log(`Simulated OTP sent to ${mobile}: 1234`, { userStatus });
    res.json({ message: 'OTP sent successfully', userStatus });
  } catch (err) {
    console.error('Error in send-otp:', err);
    res.status(500).json({ message: `Server error: ${err.message}` });
  }
};

// Verify OTP and generate JWT token, return user details
export const verifyOTP = async (req, res) => {
  const { mobile, otp } = req.body;
  console.log('OTP verification request:', { mobile, otp });
  try {
    let user = await AppUser.findOne({ mobile }).exec();
    console.log('User found:', user);

    // Simulate OTP verification
    if (otp !== '1234') {
      return res.status(400).json({ message: 'Invalid OTP' });
    }

    // Create new user if not exists
    if (!user) {
      try {
        user = new AppUser({ mobile });
        await user.save();
        console.log('New user created:', user);
      } catch (err) {
        if (err.code === 11000) {
          console.error('Duplicate key error:', err);
          return res.status(400).json({ message: 'Mobile number already exists or database conflict. Please try again.' });
        }
        throw err;
      }
    }

    // Prepare user details for response
    let userDetails = {
      userId: user._id,
      mobile: user.mobile,
      role: user.role || 'new',
    };
    let userType = user.role || 'new';
    let isNewUser = !user.role;
    let message = 'OTP verified';

    // Fetch additional details based on role
    if (user.role === 'student') {
      const student = await Student.findOne({ userId: user._id })
        .populate('classId', 'name')
        .populate('boardId', 'name')
        .populate('taggedTeacher', 'name')
        .populate('assignedTeachers.teacherId', 'name')
        .populate('assignedTeachers.subjectId', 'name')
        .exec();
      if (student) {
        userDetails = {
          ...userDetails,
          _id: student._id,
          userId: student.userId,
          mobile: student.mobile,
          isApproved: student.isApproved,
          rejected: student.rejected,
          title:student.title,
          name: student.name,
          uid: student.uid,
          studentUid: student.studentUid, // <-- add this
          referralCode: student.referralCode,
          gender: student.gender,
          state: student.state,
          pinCode: student.pinCode,
          parentsMobile: student.parentsMobile,
          parentEmail: student.parentEmail,
          fatherTitle: student.fatherTitle,
          fatherName: student.fatherName,
          motherTitle: student.motherTitle,
          motherName: student.motherName,
          fatherOccupation: student.fatherOccupation,
          motherOccupation: student.motherOccupation,
          classId: student.classId ? { _id: student.classId._id, name: student.classId.name } : null,
          className: student.className,
          termsAccepted: student.termsAccepted,
          schoolName: student.schoolName,
          boardId: student.boardId ? { _id: student.boardId._id, name: student.boardId.name } : null,
          boardName: student.boardName,
          billingCode: student.billingCode,
          affiliatedReferralCode: student.affiliatedReferralCode,
          taggedTeacher: student.taggedTeacher ? { _id: student.taggedTeacher._id, name: student.taggedTeacher.name } : null,
          avatarUrl: student.avatarUrl,
          assignedTeachers: student.assignedTeachers.map(assignment => ({
            teacherId: assignment.teacherId ? { _id: assignment.teacherId._id, name: assignment.teacherId.name } : null,
            subjectId: assignment.subjectId ? { _id: assignment.subjectId._id, name: assignment.subjectId.name } : null,
            subjectName: assignment.subjectName,
          })),
          isBlocked: student.isBlocked,
          createdByAdmin: student.createdByAdmin,
          createdAt: student.createdAt,
          updatedAt: student.updatedAt,
        };
        if (student.rejected) {
          message = 'Your approval request is rejected, please contact admin@gmail.com.';
          userType = 'student_rejected';
          console.log('Rejected student detected:', userDetails);
        } else if (!student.isApproved) {
          message = 'Your approval request is pending from the admin.';
          userType = 'student_pending';
          console.log('Pending student detected:', userDetails);
        } else {
          userType = 'student_approved';
          console.log('Approved student detected:', userDetails);
        }
      } else {
        message = 'Your approval request is pending from the admin.';
        userType = 'student_pending';
        console.log('Student document not found, treating as pending:', userDetails);
      }
      console.log('Student user detected:', userDetails);
   } else if (user.role === 'teacher') {
  console.log('AppUser _id:', user._id.toString());
  let teacher = await Teacher.findOne({ userId: user._id })
    .populate('assignedClasses._id', 'name')
    .populate('assignedSubjects._id', 'name')
    .populate('students', 'name')
    .exec();
  console.log('Teacher found:', teacher);
  if (!teacher) {
    // Create a new Teacher document if none exists
    teacher = new Teacher({
      userId: user._id,
      mobile: user.mobile,
      createdByAdmin: false,
      termsAccepted: true,
      isApproved: false,
      rejected: false,
      isBlocked: false
    });
    await teacher.save();
    console.log('New Teacher document created:', teacher);
  }
  userDetails = {
    ...userDetails,
    _id: teacher._id,
    userId: teacher.userId,
    mobile: teacher.mobile,
    isApproved: teacher.isApproved,
    rejected: teacher.rejected,
    uid: teacher.uid || '',
    title: teacher.title || '', // <-- add this
    name: teacher.name || '',
    avatarUrl: teacher.avatarUrl || '',
    gender: teacher.gender || '',
    email: teacher.email || '',
    state: teacher.state || '',
    pinCode: teacher.pinCode || '',
    instituteName: teacher.instituteName || '',
    qualification: teacher.qualification || '',
    board: teacher.board || '',
    classes: teacher.classes || [],
    subjects: teacher.subjects || [],
    assignedClasses: teacher.assignedClasses?.map(cls => ({ _id: cls._id?._id || cls._id, name: cls._id?.name || cls.name })) || [],
    assignedSubjects: teacher.assignedSubjects?.map(subject => ({ _id: subject._id?._id || subject._id, name: subject._id?.name || subject.name })) || [],
    bio: teacher.bio || '',
    billingCode: teacher.billingCode || '',
    referralCode: teacher.referralCode || '',
    createdByAdmin: teacher.createdByAdmin,
    termsAccepted: teacher.termsAccepted,
    isBlocked: teacher.isBlocked,
    students: teacher.students?.map(student => ({ _id: student._id, name: student.name })) || [],
    createdAt: teacher.createdAt,
  };
  if (teacher.rejected) {
    message = 'Your approval request is rejected, please contact admin@gmail.com.';
    userType = 'teacher_rejected';
  } else if (!teacher.isApproved) {
    message = 'Your approval request is pending from the admin.';
    userType = 'teacher_pending';
  } else {
    userType = 'teacher_approved';
  }
  console.log('Teacher userDetails:', userDetails);
}

    // Generate JWT token
    const expiresIn = 2592000; // 1 hour in seconds
    const token = jwt.sign({ userId: user._id, role: user.role || 'new' }, process.env.JWT_SECRET || 'your_jwt_secret', { expiresIn });
    console.log('Generated JWT token:', token);

    // Store token in database
    const expiryDate = new Date(Date.now() + expiresIn * 1000);
    const tokenDoc = new Token({
      userId: user._id,
      token,
      expiry: expiryDate,
    });
    await tokenDoc.save();
    console.log('Token stored in database:', { userId: user._id, expiry: expiryDate });

    res.json({
      message,
      isNewUser,
      userId: user._id,
      userType,
      userDetails,
      token,
    });
  } catch (err) {
    console.error('Error in verify-otp:', err);
    res.status(500).json({ message: `Server error: ${err.message}` });
  }
};
// Get user details by ID and role
export const getUserDetails = async (req, res) => {
  const { userId } = req.params;
  console.log('Get user details request:', { userId });
  try {
    const user = await AppUser.findById(userId).exec();
    if (!user) {
      console.error('User not found:', userId);
      return res.status(404).json({ message: 'User not found' });
    }

    let userDetails = {
      userId: user._id,
      mobile: user.mobile,
      role: user.role || 'new',
      paymentStatus: user.paymentStatus || 'pending',
    };

    if (user.role === 'student') {
      const student = await Student.findOne({ userId }).exec();
      if (!student) {
        console.error('Student not found for userId:', userId);
        return res.status(404).json({ message: 'Student details not found' });
      }
      userDetails = {
        ...userDetails,

        title: student.title,
        firstName: student.firstName,
        lastName: student.lastName,
        gender: student.gender,
        email: student.email,
        pinCode: student.pinCode,
        state: student.state,
        class: student.class,
        board: student.board,
        schoolName: student.schoolName,
        uid: student.uid,
        avatar: student.avatar,
        termsAccepted: student.termsAccepted,
      };
      console.log('Student details retrieved:', userDetails);
    } else if (user.role === 'teacher') {
      const teacher = await Teacher.findOne({ userId }).exec();
      if (!teacher) {
        console.error('Teacher not found for userId:', userId);
        return res.status(404).json({ message: 'Teacher details not found' });
      }
      userDetails = {
        ...userDetails,

        title: teacher.title,
        name: teacher.name,
        gender: teacher.gender,
        email: teacher.email,
        pinCode: teacher.pinCode,
        state: teacher.state,
        instituteName: teacher.instituteName,
        qualification: teacher.qualification,
        experience: teacher.experience,
        bio: teacher.bio,
        avatar: teacher.avatar,
        termsAccepted: teacher.termsAccepted,
        isApproved: teacher.isApproved,
        rejected: teacher.rejected,
      };
      console.log('Teacher details retrieved:', userDetails);
    }

    res.json({
      message: 'User details retrieved successfully',
      userDetails,
    });
  } catch (err) {
    console.error('Error in get-user-details:', err);
    res.status(500).json({ message: `Server error: ${err.message}` });
  }
};

// Select user role
export const selectRole = async (req, res) => {
  const { userId, role } = req.body;
  console.log('Select role request:', { userId, role });
  try {
    const user = await AppUser.findById(userId).exec();
    if (!user) return res.status(404).json({ message: 'User not found' });

    // Update the role
    const previousRole = user.role; // Store previous role for cleanup
    user.role = role;
    await user.save();
    console.log('Role updated:', { userId, role });

    // Clean up previous role-specific document if role has changed
    if (previousRole !== role) {
      if (previousRole === 'teacher') {
        await Teacher.deleteOne({ userId }).exec();
        console.log('Deleted Teacher document for user:', userId);
      } else if (previousRole === 'student') {
        await Student.deleteOne({ userId }).exec();
        console.log('Deleted Student document for user:', userId);
      }
    }

    // Initialize new role-specific document if needed
    if (role === 'teacher') {
      const existingTeacher = await Teacher.findOne({ userId }).exec();
      if (!existingTeacher) {
        const teacher = new Teacher({
          userId,
          mobile: user.mobile, // Include mobile from AppUser
          isApproved: false,
          rejected: false,
        });
        await teacher.save();
        console.log('Teacher document initialized:', teacher);
      }
    } else if (role === 'student') {
      const existingStudent = await Student.findOne({ userId }).exec();
      if (!existingStudent) {
        const student = new Student({
          userId,
          mobile: user.mobile, // Include mobile from AppUser
          isApproved: false,
          rejected: false,
        });
        await student.save();
        console.log('Student document initialized:', student);
      }
    }

    // Update token with new role
    const expiresIn = 3600;
    const token = jwt.sign({ userId: user._id, role }, process.env.JWT_SECRET || 'your_jwt_secret', { expiresIn });
    const expiryDate = new Date(Date.now() + expiresIn * 1000);
    const tokenDoc = new Token({ userId: user._id, token, expiry: expiryDate });
    await tokenDoc.save();
    console.log('New token stored for role update:', { userId, expiry: expiryDate });

    const userDetails = {
      userId: user._id,
      mobile: user.mobile,
      role,
    };

    res.json({ message: `Role set to ${role}`, userId, userDetails, token });
  } catch (err) {
    console.error('Error in select-role:', err);
    res.status(500).json({ message: err.message });
  }
};
// Payment processing
export const payment = async (req, res) => {
  const { userId } = req.body;
  console.log('Payment request:', { userId });
  try {
    const user = await AppUser.findById(userId).exec();
    if (!user || user.role !== 'teacher') {
      return res.status(400).json({ message: 'Invalid user or role' });
    }

    const teacher = await Teacher.findOne({ userId }).exec();
    if (!teacher) {
      return res.status(404).json({ message: 'Teacher not found' });
    }

    // Simulate payment
    user.paymentStatus = 'completed';
    await user.save();
    console.log('Payment status updated:', user);

    res.json({ message: 'Payment successful', paymentStatus: user.paymentStatus });
  } catch (err) {
    console.error('Error in payment:', err);
    res.status(500).json({ message: err.message, paymentStatus: 'failed' });
  }
};

// Check teacher approval status
export const checkTeacherApproval = async (req, res) => {
  const { userId } = req.params;
  console.log('Check teacher approval request:', { userId });
  try {
    const user = await AppUser.findById(userId).exec();
    if (!user || user.role !== 'teacher') {
      return res.status(400).json({ message: 'Invalid user or role' });
    }

    const teacher = await Teacher.findOne({ userId }).exec();
    if (!teacher) {
      return res.status(404).json({ message: 'Teacher not found' });
    }

    let nextScreen = 'teacher-dashboard';
    let message = 'Welcome to the dashboard!';

    if (teacher.rejected) {
      nextScreen = 'teacher-rejected';
      message = 'Your approval request is rejected, please contact admin@gmail.com.';
    } else if (!teacher.isApproved) {
      nextScreen = 'teacher-approval-pending';
      message = 'Your approval request is pending from the admin.';
    } else if (user.paymentStatus !== 'completed') {
      nextScreen = 'payment-screen';
      message = 'Your payment is pending.';
    }

    const userDetails = {
      userId: user._id,
      mobile: user.mobile,
      role: user.role,
      paymentStatus: user.paymentStatus,
      title: teacher.title,
      name: teacher.name,
      gender: teacher.gender,
      email: teacher.email,
      pinCode: teacher.pinCode,
      state: teacher.state,
      instituteName: teacher.instituteName,
      qualification: teacher.qualification,
      experience: teacher.experience,
      bio: teacher.bio,
      avatar: teacher.avatar,
      termsAccepted: teacher.termsAccepted,
      isApproved: teacher.isApproved,
      rejected: teacher.rejected,
    };

    console.log('Teacher approval response:', {
      isApproved: teacher.isApproved,
      paymentStatus: user.paymentStatus,
      nextScreen,
    });

    res.json({
      isApproved: teacher.isApproved,
      rejected: teacher.rejected,
      nextScreen,
      message,
      paymentStatus: user.paymentStatus,
      userDetails,
    });
  } catch (err) {
    console.error('Error in check-teacher-approval:', err);
    res.status(500).json({ message: err.message });
  }
};
// Other functions (abridged for brevity)
export const welcome = async (req, res) => {
  const userId = req.params.userId || req.user._id;
  console.log('Welcome request:', { userId });
  try {
    const user = await AppUser.findById(userId).exec();
    if (!user) return res.status(404).json({ message: 'User not found' });

    const redirect = user.role === 'student' ? '/student-dashboard' : '/teacher-dashboard';
    res.status(200).json({ message: 'Welcome!', redirect });
  } catch (err) {
    console.error('Error in welcome:', err);
    res.status(500).json({ message: err.message });
  }
};


export const studentDetails = async (req, res) => {
  const { userId, title, firstName, lastName, gender, email, pinCode, state } = req.body;
  console.log('Student details request:', { userId, title, firstName, lastName });

  try {
    const user = await AppUser.findById(userId).exec();
    if (!user || user.role !== 'student') {
      return res.status(400).json({ message: 'Invalid user or role' });
    }

    let student = await Student.findOne({ userId }).exec();
    if (!student) {
      student = new Student({ userId });
    }

    student.title = title;
    student.firstName = firstName;
    student.lastName = lastName;
    student.gender = gender;
    student.email = email;
    student.pinCode = pinCode;
    student.state = state;
    await student.save();

    // Respond with student data + mobile from AppUser
    const responseData = {
      userId: student.userId,
      title: student.title,
      firstName: student.firstName,
      lastName: student.lastName,
      gender: student.gender,
      email: student.email,
      pinCode: student.pinCode,
      state: student.state,
      mobile: user.mobile,          // mobile from AppUser
      avatar: student.avatar,
      avatarUrl: student.avatarUrl,
      termsAccepted: student.termsAccepted,
      paymentStatus: student.paymentStatus,
      tutorialViewed: student.tutorialViewed,
      classId: student.classId,
      className: student.className,
      boardId: student.boardId,
      boardName: student.boardName,
      schoolName: student.schoolName,
      uid: student.uid,
    };

    console.log('Student details saved:', student);
    res.json({ message: 'Student details submitted', student: responseData });

  } catch (err) {
    console.error('Error in student-details:', err);
    res.status(500).json({ message: err.message });
  }
};

//Ali this route is expecting multiple array of classes
export const getSubjects = async (req, res) => {
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

