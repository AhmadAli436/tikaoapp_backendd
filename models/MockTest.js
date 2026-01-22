import mongoose from 'mongoose';

const mockTestSchema = new mongoose.Schema({
  title: { type: String, required: true },
  thumbnail: { type: String },
  difficulty: { type: String, enum: ['easy', 'moderate', 'hard'], required: true },
  timer: { type: Number, required: true },
  mcqs: [{
    mcqId: { type: mongoose.Schema.Types.ObjectId, ref: 'MCQ', required: true },
    timer: { type: Number, default: null },
  }],
  subject: { type: mongoose.Schema.Types.ObjectId, ref: 'Subject', required: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

export default mongoose.model('MockTest', mockTestSchema);