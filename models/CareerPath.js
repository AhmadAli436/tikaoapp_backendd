import mongoose from 'mongoose';

const careerPathSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String },
  industry: { type: String },
  requiredSkills: [{ type: String }],
  recommendedCourses: [{ type: String }],
  difficulty: { type: String, enum: ['beginner', 'intermediate', 'advanced'], default: 'beginner' },
  industryGrowth: { type: Number, default: 0 },
  avgSalary: { type: String },
  icon: { type: String, default: '🎯' },
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

export default mongoose.model('CareerPath', careerPathSchema);
