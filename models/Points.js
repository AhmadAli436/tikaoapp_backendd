// models/Points.js
import mongoose from 'mongoose';

const PointsSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    mcqId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'MCQ',
      required: true,
    },
    format: {
      type: String,
      enum: ['long', 'short'],
      required: true,
    },
    longFormatId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'LongFormatVideo',
      required: function () {
        return this.format === 'long';
      },
    },
    shortFormId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ShortFormContent',
      required: function () {
        return this.format === 'short';
      },
    },
   points: { type: Number, default: null },
    isCorrect: {
      type: Boolean,
      required: function () {
        return this.format === 'short';
      },
      default: false,
    },
     role: { type: String, enum: ['student', 'teacher']},
     isAttempted: { type: Boolean, default: false },
    createdAt: {
      type: Date,
      default: Date.now,
    },
    updatedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    runValidators: true,
    context: 'query',
    indexes: [
      // Ensure unique points entry per user, MCQ, and format content
      { key: { userId: 1, mcqId: 1, longFormatId: 1 }, unique: true, partialFilterExpression: { format: 'long' } },
      { key: { userId: 1, mcqId: 1, shortFormId: 1 }, unique: true, partialFilterExpression: { format: 'short' } },
    ],
  }
);

// Update updatedAt on save
PointsSchema.pre('save', function (next) {
  this.updatedAt = new Date();
  next();
});

export default mongoose.model('Points', PointsSchema);