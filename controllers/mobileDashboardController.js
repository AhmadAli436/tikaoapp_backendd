import mongoose from 'mongoose';
import Student from '../models/Student.js';
import Teacher from '../models/Teacher.js';
import QuizAttempt from '../models/QuizAttempt.js';
import Points from '../models/Points.js';
import MocktestPoints from '../models/MocktestPoints.js';
import VideoProgress from '../models/VideoProgress.js';
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

export const getGamificationStats = async (req, res) => {
  try {
    const { userId } = req.params;
    const [points, mockPoints] = await Promise.all([
      Points.find({ userId }).lean(),
      MocktestPoints.find({ userId }).lean(),
    ]);

    const mcqPoints = points.reduce((s, p) => s + (p.points || 0), 0);
    const mockTestPoints = mockPoints.reduce((s, p) => s + (p.points || 0), 0);
    const correctAnswers = points.filter((p) => p.isCorrect).length + mockPoints.filter((p) => p.isCorrect).length;

    return res.status(200).json({
      success: true,
      gamification: {
        totalPoints: mcqPoints + mockTestPoints,
        mcqPoints,
        mockTestPoints,
        correctAnswers,
        level: Math.floor((mcqPoints + mockTestPoints) / 100) + 1,
        badges: [
          ...(mcqPoints >= 50 ? [{ name: 'MCQ Master', icon: '🎯' }] : []),
          ...(mockTestPoints >= 30 ? [{ name: 'Test Champion', icon: '🏆' }] : []),
          ...(correctAnswers >= 20 ? [{ name: 'Sharp Mind', icon: '🧠' }] : []),
        ],
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
