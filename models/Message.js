import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema({
  senderId: { type: mongoose.Schema.Types.ObjectId, required: true },
  recipientId: { type: mongoose.Schema.Types.ObjectId, required: true },
  senderRole: { type: String, enum: ['student', 'teacher', 'admin'], required: true },
  recipientRole: { type: String, enum: ['student', 'teacher', 'admin'], required: true },
  content: { type: String, required: true },
  read: { type: Boolean, default: false },
  threadId: { type: String, required: true },
}, { timestamps: true });

messageSchema.index({ threadId: 1, createdAt: -1 });
messageSchema.index({ recipientId: 1, read: 1 });

export default mongoose.model('Message', messageSchema);
