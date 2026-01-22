import mongoose from 'mongoose';

const appUserSchema = new mongoose.Schema({
  mobile: { type: String, required: true, unique: true },
  role: { type: String, enum: ['teacher', 'student'], default: null },
  isApproved: { type: Boolean, default: false },
}, { collection: 'appusers' });

export default mongoose.model('AppUser', appUserSchema);