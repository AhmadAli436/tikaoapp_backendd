// models/MockTestPoints.model.js
import mongoose from 'mongoose';

const mockTestPointsSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    subjectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Subject',
      required: true,
    },
    mockTestId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'MockTest',
      required: true,
    },
    mcqId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'MCQ',
      required: true,
    },
    points: {
      type: Number, // No validation, accepts 0, -1, 4, etc.
      required: true,
    },
    isCorrect: {
      type: Boolean,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// Prevent duplicate point entries for same question in mock test
mockTestPointsSchema.index(
  { userId: 1, subjectId: 1, mockTestId: 1, mcqId: 1 },
  { unique: true }
);

const MockTestPoints = mongoose.model('MockTestPoints', mockTestPointsSchema);

export default MockTestPoints;
