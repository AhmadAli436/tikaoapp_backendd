import mongoose from 'mongoose';

const MCQSchema = new mongoose.Schema(
  {
    chapter: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Chapter',
      required: true,
    },
    format: {
      type: String,
      enum: ['long', 'short'],
      required: true,
      default: 'long',
    },
    type: {
      type: String,
      enum: ['text based', 'image based', 'image option based', 'short content based'],
      required: function () {
        return this.format === 'long';
      },
    },
    difficulty: {
      type: String,
      enum: ['easy', 'moderate', 'hard'],
      required: true,
    },
    keywords: {
      type: [String],
      default: [],
      validate: {
        validator: function (v) {
          return v.length <= 3;
        },
        message: 'Up to three keywords are allowed',
      },
    },
    question: {
      type: String,
      required: true,
      validate: {
        validator: function (v) {
          if (this.format === 'short') {
            return v.split(/\s+/).length <= 50;
          }
          return true;
        },
        message: 'Question must be 50 words or less for short format',
      },
    },
    questionImage: {
      type: String,
      required: function () {
        return this.format === 'long' && this.type === 'image based';
      },
    },
    options: {
      type: [String],
      required: true,
      validate: {
        validator: function (v) {
          if (this.format === 'long') {
            return v.length === 4;
          }
          return v.length === 2 && v.includes('True') && v.includes('False');
        },
        message: function (props) {
          return this.format === 'long'
            ? 'Exactly four options are required for long format'
            : 'Options must be True and False for short format';
        },
      },
    },
    correctOption: {
      type: String,
      required: true,
      validate: {
        validator: function (v) {
          return this.options.includes(v);
        },
        message: 'Correct option must be one of the provided options',
      },
    },
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
    context: 'query', // Ensure validators access the full document during updates
  }
);

export default mongoose.model('MCQ', MCQSchema);