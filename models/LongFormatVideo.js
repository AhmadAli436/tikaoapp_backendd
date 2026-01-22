import mongoose from 'mongoose';

const timestampSchema = new mongoose.Schema({
  title: { type: String, required: true },
  startTime: { type: Number, required: true },
  endTime: { type: Number, required: true },
  thumbnailUrl: { type: String, default: null },
  mcq: { type: mongoose.Schema.Types.ObjectId, ref: 'MCQ', default: null },
});

const longFormatVideoSchema = new mongoose.Schema({
  chapterId: { type: mongoose.Schema.Types.ObjectId, ref: 'Chapter', required: true },
  videoUrl: { type: String, required: true },
  thumbnailUrl: { type: String, required: true },
  timestamps: [timestampSchema],
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

export default mongoose.model('LongFormatVideo', longFormatVideoSchema);