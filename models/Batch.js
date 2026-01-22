import mongoose from 'mongoose';

const batchSchema = new mongoose.Schema({
  name: { type: String, required: true },
  boardId: { type: mongoose.Schema.Types.ObjectId, ref: 'Board', required: true },
  classId: { type: mongoose.Schema.Types.ObjectId, ref: 'Class', required: true },
  subjectIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Subject', required: true }],
  chapterIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Chapter', required: true }],
  teacherId: { type: mongoose.Schema.Types.ObjectId, ref: 'Teacher', required: true },
  thumbnail: { type: String },
  students: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Student' }],
});

export default mongoose.model('Batch', batchSchema);