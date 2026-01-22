// models/MockTestAttempt.js
import mongoose from 'mongoose';

const mockTestAttemptSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'AppUser', required: true },
  subjectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Subject', required: true },
  mockTestId: { type: mongoose.Schema.Types.ObjectId, ref: 'MockTest', required: true },
  isAttempted: { type: Boolean, default: false },
  mcqAttempts: [{
    mcqId: { type: mongoose.Schema.Types.ObjectId, ref: 'MCQ', required: true },
    selectedOption: { type: String, required: true },
    isCorrect: { type: Boolean, required: true },
    incorrectOption: { type: String, default: null }
  }],
  totalMcqsAttempted: { type: Number, default: 0 },
  correctCount: { type: Number, default: 0 },
  incorrectCount: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

mockTestAttemptSchema.pre('save', function (next) {
  this.updatedAt = Date.now();
  next();
});

export default mongoose.model('MockTestAttempt', mockTestAttemptSchema);
