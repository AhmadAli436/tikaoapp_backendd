import mongoose from 'mongoose';

const careerSkillSchema = new mongoose.Schema({
  name: { type: String, required: true },
  category: { type: String, required: true },
  demandLevel: { type: String, enum: ['high', 'medium', 'low'], default: 'medium' },
  relatedSubjects: [{ type: String }],
  marketTrend: { type: String, default: 'stable' },
  growthRate: { type: Number, default: 0 },
  salaryRange: { type: String },
  description: { type: String },
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

export default mongoose.model('CareerSkill', careerSkillSchema);
