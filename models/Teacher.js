import mongoose from 'mongoose';

const teacherSchema = new mongoose.Schema({
  userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AppUser',
      unique: true,
      sparse: true ,
    },
    isApproved: {
      type: Boolean,
      default: false,
    },
    rejected: {
      type: Boolean,
      default: false,
    },
    title: {
    type: String,
    enum: ['Mr', 'Ms', 'Mrs'],
    default: 'Mr', // Default set to Mr.
  },
  uid: {
    type: String,
    unique: true,
    sparse: true,
  },
  mobile: {
    type: String,
  },
  name: {
    type: String,
  },
  avatarUrl: {
    type: String,
    default: '',
  },
  gender: {
    type: String,
    enum: ['Male', 'Female', 'Other'],
  },
  email: {
    type: String,
    match: [/\S+@\S+\.\S+/, 'Invalid email format'],
  },
  state: {
    type: String,
 
  },
  pinCode: {
    type: String,

    match: [/^\d{6}$/, 'Pin code must be 6 digits'],
  },
  instituteName: {
    type: String,
  },
  qualification: {
    type: String,
  },
  board: {
    type: String,
    enum: ['CBSE', 'ICSE', 'State Board', 'Others'],
  },
  classes: {
    type: [String],
  },
  subjects: {
    type: [String],
  },
  assignedClasses: [
    {
      _id: { type: mongoose.Schema.Types.ObjectId, ref: 'Class' },
      name: { type: String },
    },
  ],
  
  assignedSubjects: [
    {
      _id: { type: mongoose.Schema.Types.ObjectId, ref: 'Subject' },
      name: { type: String },
    },
  ],
  bio: {
    type: String,
  },
  billingCode: {
    type: String,
    
  },
  referralCode: {
    type: String,
  },
  createdByAdmin: {
    type: Boolean,
    default: false,
  },
  termsAccepted: {
    type: Boolean,
     default: true,
  },
  isBlocked: {
    type: Boolean,
    default: false,
  },
  isApproved: {
    type: Boolean,
    default: false,
  },
  rejected: {
    type: Boolean,
    default: false,
  },
  students: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Student',
  }],
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

export default mongoose.model('Teacher', teacherSchema);