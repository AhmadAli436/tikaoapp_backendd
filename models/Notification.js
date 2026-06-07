import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema({
  title: { type: String, required: true },
  message: { type: String, required: true },
  recipientId: { type: mongoose.Schema.Types.ObjectId, required: true },
  recipientRole: { type: String, enum: ['student', 'teacher', 'admin'], default: 'student' },
  type: { type: String, enum: ['announcement', 'progress', 'message', 'system', 'career'], default: 'system' },
  read: { type: Boolean, default: false },
  metadata: { type: mongoose.Schema.Types.Mixed },
}, { timestamps: true });

notificationSchema.index({ recipientId: 1, createdAt: -1 });

export default mongoose.model('Notification', notificationSchema);
