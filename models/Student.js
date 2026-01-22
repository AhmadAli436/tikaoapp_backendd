import mongoose from 'mongoose';

const studentSchema = new mongoose.Schema(
  {
    userId: {
      // Add userId to match selectRole function
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AppUser',
      unique: true,
      sparse: true // This is similar to partial index in Mongoose
    },
    isApproved: {
      type: Boolean,
      default: false,
    },
    rejected: {
      type: Boolean,
      default: false,
    },
    name: {
      type: String,

      trim: true,
      maxlength: [100, 'Name cannot exceed 100 characters'],
    },
    studentUid: {
      type: String,
      unique: true,
      sparse: true ,
      match: [/^[a-zA-Z0-9]{12,15}$/, 'Student UID must be 12-15 alphanumeric characters'],
    },
    uid: {
      type: String,

      unique: true,

      trim: true,
      sparse: true,
    },
    referralCode: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
    },
    mobile: {
      type: String,
      unique: true,
      sparse: true,
    },
    gender: {
      type: String,
      enum: ['Male', 'Female', 'Other'],

    },
    state: {
      type: String,

      trim: true,
    },
    pinCode: {
      type: String,
      match: [/^\d{6}$/, 'Pin code must be 6 digits'],
    },
    parentsMobile: {
      type: String,
      match: [/^\+91\d{10}$/, 'Parents mobile number must be +91 followed by 10 digits'],
    },
    parentEmail: {
      type: String,
      match: [/\S+@\S+\.\S+/, 'Invalid email format'],
      trim: true,
      lowercase: true,
      unique: true,
      sparse: true,
    },
    fatherName: {
      type: String,
      trim: true,
      maxlength: [100, 'Father name cannot exceed 100 characters'],
    },
    motherName: {
      type: String,
      trim: true,
      maxlength: [100, 'Mother name cannot exceed 100 characters'],
    },
    fatherOccupation: {
      type: String,
      trim: true,
      maxlength: [100, 'Father occupation cannot exceed 100 characters'],
    },
    title: {
      type: String,
      enum: ['Mr', 'Ms'],
      default: 'Mr',
    },
    fatherTitle: {
      type: String,
      enum: ['Mr'],
      default: 'Mr',
    },
    motherTitle: {
      type: String,
      enum: ['Mrs', 'Ms'],
      default: 'Ms',
    },
    motherOccupation: {
      type: String,
      trim: true,
      maxlength: [100, 'Mother occupation cannot exceed 100 characters'],
    },
    classId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Class',
    },
    className: { type: String }, // New field
    termsAccepted: { type: Boolean, default: true },
    schoolName: {
      type: String,

      trim: true,
    },
    boardId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Board',
    },
    boardName: { type: String }, // New field
    billingCode: {
      type: String,
      trim: true,
    },
    affiliatedReferralCode: {
      type: String,
      trim: true,
    },
    taggedTeacher: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Teacher',
    },
    avatarUrl: {
      type: String,
      trim: true,
      default: '',
    },
    assignedTeachers: [
      {
        teacherId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Teacher',

        },
        subjectId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Subject',

        },
        subjectName: {
          type: String,

          trim: true,
        },
      },
    ],
    isBlocked: {
      type: Boolean,
      default: false,
    },
    createdByAdmin: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);



export default mongoose.model('Student', studentSchema);