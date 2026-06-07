import mongoose from 'mongoose';
import Student from '../models/Student.js';
import Teacher from '../models/Teacher.js';
import QuizAttempt from '../models/QuizAttempt.js';
import Points from '../models/Points.js';
import MocktestPoints from '../models/MocktestPoints.js';
import PointTransaction from '../models/PointTransaction.js';
import VideoProgress from '../models/VideoProgress.js';

const QUIZ_POINTS_PER_CORRECT = 20;
import TeacherEarning from '../models/TeacherEarning.js';
import Notification from '../models/Notification.js';

export const getStudentDashboard = async (req, res) => {
  try {
    const { studentId } = req.query;
    if (!studentId || !mongoose.Types.ObjectId.isValid(studentId)) {
      return res.status(400).json({ success: false, message: 'Invalid studentId' });
    }

    const student = await Student.findById(studentId).lean();
    if (!student) return res.status(404).json({ success: false, message: 'Student not found' });

    const userId = student.userId;
    const [quizAttempts, videoProgress, points, mockPoints, unreadNotifs] = await Promise.all([
      QuizAttempt.find({ studentId }).sort({ submittedAt: -1 }).limit(10),
      userId ? VideoProgress.find({ userId }).lean() : [],
      userId ? Points.find({ userId }).lean() : [],
      userId ? MocktestPoints.find({ userId }).lean() : [],
      Notification.countDocuments({ recipientId: studentId, read: false }),
    ]);

    const quizAvg = quizAttempts.length
      ? Math.round(quizAttempts.reduce((s, a) => s + a.percentage, 0) / quizAttempts.length)
      : 0;
    const videosWatched = videoProgress.filter((v) => v.isWatched).length;
    const totalPoints = points.reduce((s, p) => s + (p.points || 0), 0)
      + mockPoints.reduce((s, p) => s + (p.points || 0), 0);

    return res.status(200).json({
      success: true,
      dashboard: {
        quizAverage: quizAvg,
        recentAttempts: quizAttempts.length,
        videosWatched,
        totalVideos: videoProgress.length,
        totalPoints,
        unreadNotifications: unreadNotifs,
        streak: Math.min(quizAttempts.length, 7),
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const getTeacherDashboardStats = async (req, res) => {
  try {
    const { teacherId } = req.query;
    if (!teacherId || !mongoose.Types.ObjectId.isValid(teacherId)) {
      return res.status(400).json({ success: false, message: 'Invalid teacherId' });
    }

    const teacher = await Teacher.findById(teacherId).lean();
    if (!teacher) return res.status(404).json({ success: false, message: 'Teacher not found' });

    const studentIds = teacher.students || [];
    const [students, attempts, earnings, unreadNotifs] = await Promise.all([
      Student.find({ _id: { $in: studentIds } }).select('name className').lean(),
      QuizAttempt.find({ studentId: { $in: studentIds } }).sort({ submittedAt: -1 }).limit(50),
      TeacherEarning.aggregate([
        { $match: { teacher: new mongoose.Types.ObjectId(teacherId) } },
        { $group: { _id: null, total: { $sum: '$totalEarning' } } },
      ]),
      Notification.countDocuments({ recipientId: teacherId, read: false }),
    ]);

    const classAvg = attempts.length
      ? Math.round(attempts.reduce((s, a) => s + a.percentage, 0) / attempts.length)
      : 0;

    return res.status(200).json({
      success: true,
      dashboard: {
        totalStudents: students.length,
        classAverage: classAvg,
        totalEarnings: earnings[0]?.total || 0,
        recentAttempts: attempts.length,
        unreadNotifications: unreadNotifs,
        referralCode: teacher.referralCode,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

async function resolveStudentId(id) {
  if (!id || !mongoose.Types.ObjectId.isValid(id)) return null;
  const objectId = new mongoose.Types.ObjectId(id);
  const byStudentDoc = await Student.findById(objectId).select('_id').lean();
  if (byStudentDoc) return byStudentDoc._id;
  const byAppUser = await Student.findOne({ userId: objectId }).select('_id').lean();
  if (byAppUser) return byAppUser._id;
  return objectId;
}

export const getGamificationStats = async (req, res) => {
  try {
    const { userId } = req.params;
    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ success: false, message: 'Invalid userId' });
    }

    const studentObjectId = await resolveStudentId(userId);
    if (!studentObjectId) {
      return res.status(404).json({ success: false, message: 'Student not found' });
    }

    const [points, mockPoints, transactions, quizAttempts] = await Promise.all([
      Points.find({ userId: studentObjectId }).lean(),
      MocktestPoints.find({ userId: studentObjectId }).lean(),
      PointTransaction.find({ userId: studentObjectId }).sort({ createdAt: -1 }).limit(10).lean(),
      QuizAttempt.find({ studentId: studentObjectId })
        .populate('quizId', 'title subject')
        .sort({ submittedAt: -1 })
        .limit(20)
        .lean(),
    ]);

    const mcqPoints = points.reduce((s, p) => s + (p.points || 0), 0);
    const mockTestPoints = mockPoints.reduce((s, p) => s + (p.points || 0), 0);
    const transactionPoints = transactions.reduce((s, t) => s + t.points, 0);
    const quizPoints = quizAttempts.reduce((s, a) => s + (a.score || 0) * QUIZ_POINTS_PER_CORRECT, 0);
    const quizCorrectAnswers = quizAttempts.reduce((s, a) => s + (a.score || 0), 0);

    const quizScorePoints = Math.max(quizPoints, transactionPoints);
    const totalPoints = mcqPoints + mockTestPoints + quizScorePoints;
    const correctAnswers =
      points.filter((p) => p.isCorrect).length
      + mockPoints.filter((p) => p.isCorrect).length
      + quizCorrectAnswers;

    const level = Math.max(1, Math.floor(totalPoints / 100) + 1);
    const xpInLevel = totalPoints % 100;

    const recentActivity = [
      ...transactions.map((t) => ({
        type: t.type === 'add' ? 'points_added' : 'points_redeemed',
        label: t.type === 'add' ? 'Points added' : 'Points redeemed',
        points: t.points,
        date: t.createdAt,
      })),
      ...quizAttempts.map((a) => ({
        type: 'quiz_completed',
        label: a.quizId?.title || 'AI Quiz completed',
        points: (a.score || 0) * QUIZ_POINTS_PER_CORRECT,
        score: a.score,
        totalMarks: a.totalMarks,
        percentage: a.percentage,
        date: a.submittedAt,
      })),
    ]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 10);

    return res.status(200).json({
      success: true,
      gamification: {
        totalPoints,
        mcqPoints,
        mockTestPoints,
        quizPoints: quizScorePoints,
        adjustedPoints: transactionPoints,
        correctAnswers,
        quizAttempts: quizAttempts.length,
        level,
        xpInLevel,
        xpToNextLevel: 100 - xpInLevel,
        recentTransactions: transactions,
        recentActivity,
        badges: [
          ...(quizAttempts.length >= 1 ? [{ name: 'Quiz Starter', icon: '🚀', desc: 'Completed your first AI quiz' }] : []),
          ...(mcqPoints >= 50 ? [{ name: 'MCQ Master', icon: '🎯', desc: '50+ MCQ points' }] : []),
          ...(mockTestPoints >= 30 ? [{ name: 'Test Champion', icon: '🏆', desc: '30+ mock test points' }] : []),
          ...(quizPoints >= 40 ? [{ name: 'Quiz Warrior', icon: '⚔️', desc: '40+ quiz points' }] : []),
          ...(correctAnswers >= 5 ? [{ name: 'Sharp Mind', icon: '🧠', desc: '5+ correct answers' }] : []),
          ...(totalPoints >= 100 ? [{ name: 'Rising Star', icon: '🌟', desc: '100+ total points' }] : []),
          ...(level >= 5 ? [{ name: 'Level 5 Hero', icon: '⚡', desc: 'Reached level 5' }] : []),
        ],
        milestones: [
          { target: 100, label: 'Bronze Learner', reached: totalPoints >= 100 },
          { target: 250, label: 'Silver Scholar', reached: totalPoints >= 250 },
          { target: 500, label: 'Gold Genius', reached: totalPoints >= 500 },
        ],
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const getTeacherEarningsHistory = async (req, res) => {
  try {
    const { teacherId } = req.params;
    if (!teacherId || !mongoose.Types.ObjectId.isValid(teacherId)) {
      return res.status(400).json({ success: false, message: 'Invalid teacherId' });
    }

    const records = await TeacherEarning.find({ teacher: teacherId })
      .sort({ date: -1 })
      .limit(24)
      .lean();

    const totalEarnings = records.reduce((s, r) => s + (r.totalEarning || 0), 0);

    return res.status(200).json({
      success: true,
      earnings: {
        totalEarnings,
        records: records.map((r) => ({
          _id: r._id,
          date: r.date,
          totalEarning: r.totalEarning,
          referralEarningAmount: r.referralEarningAmount || 0,
          salesAssistAmount: r.salesAssistAmount || 0,
          directSalesAmount: r.directSalesAmount || 0,
          offlineDoubtClassAmount: r.offlineDoubtClassAmount || 0,
        })),
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const getQuizUploadTracking = async (req, res) => {
  try {
    const { teacherId } = req.query;
    const filter = teacherId ? { createdByAdmin: teacherId } : {};
    const QuizAttemptModel = mongoose.model('QuizAttempt');
    const AIQuizTest = mongoose.model('AIQuizTest');

    const [quizzes, attempts] = await Promise.all([
      AIQuizTest.find().sort({ createdAt: -1 }).limit(20).lean(),
      QuizAttemptModel.find().sort({ submittedAt: -1 }).limit(50).lean(),
    ]);

    return res.status(200).json({
      success: true,
      tracking: {
        totalQuizzes: quizzes.length,
        totalAttempts: attempts.length,
        recentQuizzes: quizzes,
        recentAttempts: attempts.slice(0, 10),
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const getAdminAnalytics = async (req, res) => {
  try {
    const [totalStudents, totalTeachers, totalAttempts, totalNotifications] = await Promise.all([
      Student.countDocuments({ isApproved: true }),
      Teacher.countDocuments({ isApproved: true }),
      QuizAttempt.countDocuments(),
      Notification.countDocuments(),
    ]);

    const recentAttempts = await QuizAttempt.find()
      .sort({ submittedAt: -1 })
      .limit(10)
      .populate('quizId', 'title subject')
      .lean();

    const avgScoreAgg = await QuizAttempt.aggregate([
      { $group: { _id: null, avg: { $avg: '$percentage' } } },
    ]);

    return res.status(200).json({
      success: true,
      analytics: {
        totalStudents,
        totalTeachers,
        totalQuizAttempts: totalAttempts,
        totalNotifications,
        averageQuizScore: Math.round(avgScoreAgg[0]?.avg || 0),
        recentAttempts,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
