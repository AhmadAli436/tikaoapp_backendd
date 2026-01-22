import mongoose from 'mongoose';

const videoProgressSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'AppUser', required: true },
  videoId: { type: mongoose.Schema.Types.ObjectId, ref: 'LongFormatVideo', required: true },
  chapterId: { type: mongoose.Schema.Types.ObjectId, ref: 'Chapter', required: true },
  resumeTime: { type: Number, default: 0 }, // in seconds
  totalTime: { type: Number, required: true }, // in seconds
  progress: { type: Number, default: 0 }, // percent (0-100)
  isWatched: { type: Boolean, default: false },
  updatedAt: { type: Date, default: Date.now }
});

videoProgressSchema.index({ userId: 1, videoId: 1, chapterId: 1 }, { unique: true });

export default mongoose.model('VideoProgress', videoProgressSchema);
