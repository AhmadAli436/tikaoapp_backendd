import mongoose from 'mongoose';

const feedbackSchema = new mongoose.Schema({
  fromId: { type: mongoose.Schema.Types.ObjectId, required: true },
  toId: { type: mongoose.Schema.Types.ObjectId, required: true },
  fromRole: { type: String, enum: ['student', 'teacher'], required: true },
  toRole: { type: String, enum: ['student', 'teacher'], required: true },
  rating: { type: Number, min: 1, max: 5, required: true },
  comment: { type: String },
  type: { type: String, enum: ['teaching', 'learning', 'general'], default: 'general' },
}, { timestamps: true });

export default mongoose.model('Feedback', feedbackSchema);
