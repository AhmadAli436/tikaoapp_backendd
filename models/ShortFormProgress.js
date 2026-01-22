import mongoose from 'mongoose';

const shortFormProgressSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  chapterId: { type: mongoose.Schema.Types.ObjectId, ref: 'Chapter', required: true },
  shortFormId: { type: mongoose.Schema.Types.ObjectId, ref: 'ShortFormContent', required: true },
  watchedClipIndexes: [{ type: Number }],
  attemptedMcqIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'MCQ' }],
  mcqAttempts: [{
    mcqId: { type: mongoose.Schema.Types.ObjectId, ref: 'MCQ' },
    selectedOption: String,
    isCorrect: Boolean,
    incorrectOption: String,
  }],
  totalMcqsAttempted: { type: Number, default: 0 },
  correctCount: { type: Number, default: 0 },
  incorrectCount: { type: Number, default: 0 },
  isWatched: { type: Boolean, default: false },
  percentage: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

export default mongoose.model('ShortFormProgress', shortFormProgressSchema);
