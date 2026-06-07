/**
 * Backfill PointTransaction records from existing quiz attempts.
 * Run: node scripts/backfillQuizPoints.js
 */
import 'dotenv/config';
import mongoose from 'mongoose';
import QuizAttempt from '../models/QuizAttempt.js';
import PointTransaction from '../models/PointTransaction.js';

const POINTS_PER_CORRECT = 20;

async function main() {
  await mongoose.connect(process.env.MONGO_URI);

  const attempts = await QuizAttempt.find({ score: { $gt: 0 } }).sort({ submittedAt: 1 }).lean();
  let created = 0;
  let skipped = 0;

  for (const attempt of attempts) {
    const points = attempt.score * POINTS_PER_CORRECT;
    const studentId = attempt.studentId;

    const existing = await PointTransaction.findOne({
      userId: studentId,
      points,
      type: 'add',
      createdAt: {
        $gte: new Date(new Date(attempt.submittedAt).getTime() - 60000),
        $lte: new Date(new Date(attempt.submittedAt).getTime() + 60000),
      },
    });

    if (existing) {
      skipped++;
      continue;
    }

    await PointTransaction.create({
      userId: studentId,
      points,
      type: 'add',
      createdAt: attempt.submittedAt,
    });
    created++;
    console.log(`+${points} pts for ${attempt.studentName || studentId} (score ${attempt.score})`);
  }

  console.log(`\nDone. Created ${created}, skipped ${skipped} (already existed).`);
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
