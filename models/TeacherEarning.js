import mongoose from 'mongoose';

const teacherEarningSchema = new mongoose.Schema({
  uniqueId: {
    type: String,
    required: true,
    unique: true,
  },
  date: {
    type: Date,
    required: true,
  },
  year: { type: Number }, // Added for month-based updates
  month: { type: Number }, // Added for month-based updates
  teacherName: {
    type: String,
    required: true,
  },
  referralEarningQty: {
    type: Number,
    default: 0,
  },
  referralEarningAmount: {
    type: Number,
    default: 0,
  },
  salesAssistQty: {
    type: Number,
    default: 0,
  },
  salesAssistAmount: {
    type: Number,
    default: 0,
  },
  directSalesQty: {
    type: Number,
    default: 0,
  },
  directSalesAmount: {
    type: Number,
    default: 0,
  },
  offlineDoubtClassQty: {
    type: Number,
    default: 0,
  },
  offlineDoubtClassAmount: {
    type: Number,
    default: 0,
  },
  totalEarning: {
    type: Number,
    default: 0,
  },
  teacher: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Teacher',
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

export default mongoose.model('TeacherEarning', teacherEarningSchema);