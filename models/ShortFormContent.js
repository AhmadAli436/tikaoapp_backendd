import mongoose from 'mongoose';

const shortFormContentSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
  },
  chapterId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Chapter',
    required: true,
  },
  thumbnailUrl: {
    type: String,
    required: true,
  },
  sequence: [
    {
      type: {
        type: String,
        enum: ['clip', 'mcq'],
        required: true,
      },
      clipUrl: {
        type: String,
        required: function () {
          return this.type === 'clip';
        },
      },
      videoUrl: {
        type: String,
        required: function () {
          return this.type === 'mcq';
        },
      },
      mcqId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'MCQ',
        required: function () {
          return this.type === 'mcq';
        },
      },
      timer: {
        type: Number,
        required: function () {
          return this.type === 'mcq';
        },
        default: 30,
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

shortFormContentSchema.pre('save', function (next) {
  this.updatedAt = Date.now();
  next();
});

export default mongoose.model('ShortFormContent', shortFormContentSchema);