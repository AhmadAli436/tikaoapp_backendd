import mongoose from 'mongoose';

const chapterSchema = new mongoose.Schema({
  name: { type: String, required: true },
  thumbnail: { type: String },
  subject: { type: mongoose.Schema.Types.ObjectId, ref: 'Subject', required: true },
  contents: [{
    type: { type: String, enum: ['MCQ', 'LongFormatVideo', 'ConceptVideo', 'ActivityBasedVideo'] },
    data: { type: String },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
  }],
});

chapterSchema.pre('save', function (next) {
  this.updatedAt = Date.now();
  next();
});

export default mongoose.model('Chapter', chapterSchema);