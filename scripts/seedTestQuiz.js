/**
 * Seeds a sample AI quiz for mobile app testing.
 * Run: node scripts/seedTestQuiz.js
 */
import 'dotenv/config';
import mongoose from 'mongoose';
import AIQuizTest from '../models/AIQuizTest.js';

const TEST_QUIZ = {
  title: 'Gamification Test Quiz',
  subject: 'Mathematics',
  class: 'Class 10',
  topic: 'Algebra Basics',
  difficulty: 'easy',
  duration: 10,
  totalMarks: 5,
  generatedBy: 'seed-script',
  isActive: true,
  questions: [
    {
      question: 'What is 2 + 2?',
      options: ['4', '3', '5', '22'],
      correctAnswer: 0,
      explanation: '2 + 2 equals 4.',
    },
    {
      question: 'What is the value of x if x + 5 = 10?',
      options: ['5', '10', '15', '2'],
      correctAnswer: 0,
      explanation: 'x = 10 - 5 = 5.',
    },
    {
      question: 'Which is a prime number?',
      options: ['7', '4', '6', '8'],
      correctAnswer: 0,
      explanation: '7 is only divisible by 1 and itself.',
    },
    {
      question: 'What is 10 × 3?',
      options: ['30', '13', '33', '3'],
      correctAnswer: 0,
      explanation: '10 multiplied by 3 is 30.',
    },
    {
      question: 'What is the square of 5?',
      options: ['25', '10', '55', '15'],
      correctAnswer: 0,
      explanation: '5² = 25.',
    },
  ],
};

async function seed() {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    console.error('MONGO_URI is not set in .env');
    process.exit(1);
  }

  await mongoose.connect(uri);
  console.log('Connected to MongoDB');

  const existing = await AIQuizTest.findOne({ title: TEST_QUIZ.title });
  if (existing) {
    existing.questions = TEST_QUIZ.questions;
    existing.isActive = true;
    existing.difficulty = TEST_QUIZ.difficulty;
    existing.duration = TEST_QUIZ.duration;
    existing.totalMarks = TEST_QUIZ.totalMarks;
    await existing.save();
    console.log('Updated existing quiz:', existing._id.toString());
    console.log('Title:', existing.title);
  } else {
    const quiz = await AIQuizTest.create(TEST_QUIZ);
    console.log('Created new quiz:', quiz._id.toString());
    console.log('Title:', quiz.title);
  }

  console.log('\nAll correct answers are option A (first choice) for easy testing.');
  console.log('Earn 20 points per correct answer in the Rewards tab after submitting.');

  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
