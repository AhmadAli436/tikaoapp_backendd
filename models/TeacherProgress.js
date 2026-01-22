// models/teacherProgress.js
import mongoose from 'mongoose';

const teacherProgressSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'AppUser',
    required: true,
  },
  chapterId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Chapter',
    required: true,
  },
  videoId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'LongFormatVideo',
    required: true,
  },
  mcqAttempts: [
    {
      mcqId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'MCQ',
        required: true,
      },
      selectedOption: {
        type: String,
        required: true,
      },
      isCorrect: {
        type: Boolean,
        required: true,
      },
      attemptedAt: {
        type: Date,
        default: Date.now,
      },
    },
  ],
  timestampInteractions: [
    {
      timestampIndex: {
        type: Number,
        required: true,
      },
      interactedAt: {
        type: Date,
        default: Date.now,
      },
    },
  ],
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

teacherProgressSchema.pre('save', function (next) {
  this.updatedAt = Date.now();
  next();
});

export default mongoose.model('TeacherProgress', teacherProgressSchema);