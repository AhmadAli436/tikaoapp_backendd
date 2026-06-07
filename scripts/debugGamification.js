import 'dotenv/config';
import mongoose from 'mongoose';
import QuizAttempt from '../models/QuizAttempt.js';
import PointTransaction from '../models/PointTransaction.js';
import Student from '../models/Student.js';

async function main() {
  await mongoose.connect(process.env.MONGO_URI);
  const attempts = await QuizAttempt.find().sort({ submittedAt: -1 }).limit(5).lean();
  const txs = await PointTransaction.find().sort({ createdAt: -1 }).limit(10).lean();
  const students = await Student.find().select('_id userId name mobile').limit(5).lean();

  console.log('Recent quiz attempts:', attempts.length);
  attempts.forEach((a) => console.log(' -', a.studentId, a.studentName, 'score', a.score, a.submittedAt));
  console.log('\nRecent point transactions:', txs.length);
  txs.forEach((t) => console.log(' -', t.userId, t.points, t.type, t.createdAt));
  console.log('\nSample students:');
  students.forEach((s) => console.log(' - student._id:', s._id, 'userId:', s.userId, s.name));

  await mongoose.disconnect();
}

main().catch(console.error);
