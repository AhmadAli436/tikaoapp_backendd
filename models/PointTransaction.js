import mongoose from 'mongoose';

const pointTransactionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'AppUser', required: true },
  points: { type: Number, required: true },
  type: { type: String, enum: ['add', 'burn'], required: true },
}, { timestamps: true });

pointTransactionSchema.index({ userId: 1, createdAt: -1 });

export default mongoose.model('PointTransaction', pointTransactionSchema);
