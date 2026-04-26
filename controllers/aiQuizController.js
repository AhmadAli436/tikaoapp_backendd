import mongoose from 'mongoose';
import AIQuizTest from '../models/AIQuizTest.js';
import QuizAttempt from '../models/QuizAttempt.js';

const getMasteryLevel = (percentage) => {
  if (percentage >= 80) return 'advanced';
  if (percentage >= 60) return 'intermediate';
  return 'beginner';
};

// Get all active quizzes
export const getAllQuizzes = async (req, res) => {
  try {
    console.log('Fetching all active AI quizzes...');
    const quizzes = await AIQuizTest.find({ isActive: true }).sort({ createdAt: -1 });
    console.log(`Found ${quizzes.length} active quizzes`);
    res.status(200).json({ success: true, quizzes });
  } catch (error) {
    console.error('Error fetching quizzes:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch quizzes', error: error.message });
  }
};

// Get quiz by ID
export const getQuizById = async (req, res) => {
  try {
    const quiz = await AIQuizTest.findById(req.params.id);
    if (!quiz) {
      return res.status(404).json({ success: false, message: 'Quiz not found' });
    }
    res.status(200).json({ success: true, quiz });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch quiz', error: error.message });
  }
};

// Submit quiz attempt
export const submitQuizAttempt = async (req, res) => {
  try {
    const { quizId, studentId, studentName, studentEmail, answers, timeTaken, startedAt, isAutoSubmitted } = req.body;

    const quiz = await AIQuizTest.findById(quizId);
    if (!quiz) {
      return res.status(404).json({ success: false, message: 'Quiz not found' });
    }

    let score = 0;
    const processedAnswers = answers.map((answer, index) => {
      const isCorrect = answer.selectedAnswer === quiz.questions[index].correctAnswer;
      if (isCorrect) score++;
      return {
        questionIndex: index,
        selectedAnswer: answer.selectedAnswer,
        isCorrect,
        timeTaken: answer.timeTaken
      };
    });

    const percentage = (score / quiz.totalMarks) * 100;

    const attempt = new QuizAttempt({
      quizId,
      studentId,
      studentName,
      studentEmail,
      answers: processedAnswers,
      score,
      totalMarks: quiz.totalMarks,
      percentage,
      timeTaken,
      startedAt,
      submittedAt: new Date(),
      isAutoSubmitted
    });

    await attempt.save();

    res.status(201).json({ success: true, attempt, score, percentage });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to submit quiz', error: error.message });
  }
};

// Get quiz attempts for a specific quiz
export const getQuizAttempts = async (req, res) => {
  try {
    const { quizId } = req.params;
    const attempts = await QuizAttempt.find({ quizId }).sort({ submittedAt: -1 });
    res.status(200).json({ success: true, attempts });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch attempts', error: error.message });
  }
};

// Get student's quiz attempts
export const getStudentQuizAttempts = async (req, res) => {
  try {
    const { studentId } = req.params;
    const attempts = await QuizAttempt.find({ studentId })
      .populate('quizId', 'title subject class topic difficulty')
      .sort({ submittedAt: -1 });
    res.status(200).json({ success: true, attempts });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch attempts', error: error.message });
  }
};

// Get teacher's students quiz attempts
export const getTeacherStudentsAttempts = async (req, res) => {
  try {
    const { teacherId } = req.params;
    
    // Convert teacherId to ObjectId
    const teacherObjectId = new mongoose.Types.ObjectId(teacherId);
    
    // Get students assigned to this teacher
    const Student = mongoose.model('Student');
    const students = await Student.find({
      $or: [
        { 'assignedTeachers.teacherId': teacherObjectId },
        { taggedTeacher: teacherObjectId }
      ]
    }).select('_id');
    
    console.log(`Found ${students.length} students for teacher ${teacherId}`);
    
    const studentIds = students.map(s => s._id);

    // Only show attempts from assigned students
    // If no students are assigned, return empty array
    if (studentIds.length === 0) {
      console.log('No students assigned to this teacher');
      return res.status(200).json({ success: true, attempts: [] });
    }

    const attempts = await QuizAttempt.find({ studentId: { $in: studentIds } })
      .populate('quizId', 'title subject class topic difficulty totalMarks')
      .populate('studentId', 'name email avatarUrl')
      .sort({ submittedAt: -1 });

    console.log(`Found ${attempts.length} quiz attempts from assigned students`);
    res.status(200).json({ success: true, attempts });
  } catch (error) {
    console.error('Error fetching teacher students attempts:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch attempts', error: error.message });
  }
};

// Personalized Study Support for student app
export const getPersonalizedStudySupport = async (req, res) => {
  try {
    const { studentId } = req.params;
    const attempts = await QuizAttempt.find({ studentId })
      .populate('quizId', 'subject topic difficulty')
      .sort({ submittedAt: -1 })
      .limit(30);

    if (attempts.length === 0) {
      return res.status(200).json({
        success: true,
        support: {
          masteryLevel: 'beginner',
          weakTopics: [],
          nextActions: ['Attempt your first AI quiz', 'Start with easy-level quizzes'],
          recommendations: [],
        },
      });
    }

    const avgScore = attempts.reduce((sum, attempt) => sum + attempt.percentage, 0) / attempts.length;
    const weakTopicMap = new Map();
    const recommendations = [];

    attempts.forEach((attempt) => {
      const quiz = attempt.quizId;
      if (!quiz) return;
      if (attempt.percentage < 60) {
        const key = `${quiz.subject}::${quiz.topic}`;
        weakTopicMap.set(key, (weakTopicMap.get(key) || 0) + 1);
      }
      if (attempt.percentage < 70) {
        recommendations.push({
          quizId: quiz._id,
          subject: quiz.subject,
          topic: quiz.topic,
          suggestedDifficulty: 'easy',
        });
      }
    });

    const weakTopics = Array.from(weakTopicMap.entries())
      .map(([key, count]) => {
        const [subject, topic] = key.split('::');
        return { subject, topic, misses: count };
      })
      .sort((a, b) => b.misses - a.misses)
      .slice(0, 5);

    return res.status(200).json({
      success: true,
      support: {
        masteryLevel: getMasteryLevel(avgScore),
        weakTopics,
        nextActions: [
          'Revise top weak topic for 20 minutes',
          'Attempt one moderate quiz after revision',
          'Track daily score improvement',
        ],
        recommendations: recommendations.slice(0, 8),
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to fetch study support', error: error.message });
  }
};

// Teacher console assistant insights
export const getTeacherConsoleAssistant = async (req, res) => {
  try {
    const { teacherId } = req.params;
    const teacherObjectId = new mongoose.Types.ObjectId(teacherId);
    const Student = mongoose.model('Student');
    const students = await Student.find({
      $or: [{ 'assignedTeachers.teacherId': teacherObjectId }, { taggedTeacher: teacherObjectId }],
    }).select('_id name');

    const studentIds = students.map((s) => s._id);
    if (studentIds.length === 0) {
      return res.status(200).json({ success: true, insights: { alerts: [], actionItems: [] } });
    }

    const attempts = await QuizAttempt.find({ studentId: { $in: studentIds } })
      .populate('quizId', 'subject topic')
      .sort({ submittedAt: -1 })
      .limit(200);

    const lowPerformers = attempts.filter((a) => a.percentage < 50).slice(0, 10);
    const alerts = lowPerformers.map((a) => ({
      studentId: a.studentId,
      studentName: a.studentName,
      score: a.percentage,
      subject: a.quizId?.subject || 'Unknown',
      topic: a.quizId?.topic || 'Unknown',
      alert: 'Needs intervention',
    }));

    return res.status(200).json({
      success: true,
      insights: {
        alerts,
        actionItems: [
          'Schedule remedial session for students below 50%',
          'Assign easy quizzes for weak-topic recovery',
          'Review frequent wrong answers in teacher console',
        ],
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to fetch teacher assistant insights', error: error.message });
  }
};

// Admin analytics alerts
export const getAdminAnalyticsAlerts = async (_req, res) => {
  try {
    const totalAttempts = await QuizAttempt.countDocuments();
    const lowScoreAttempts = await QuizAttempt.countDocuments({ percentage: { $lt: 50 } });
    const autoSubmittedAttempts = await QuizAttempt.countDocuments({ isAutoSubmitted: true });

    const lowScoreRate = totalAttempts ? (lowScoreAttempts / totalAttempts) * 100 : 0;
    const autoSubmitRate = totalAttempts ? (autoSubmittedAttempts / totalAttempts) * 100 : 0;

    const alerts = [];
    if (lowScoreRate > 40) alerts.push({ type: 'performance', severity: 'high', message: 'Low score rate is above 40%' });
    if (autoSubmitRate > 20) alerts.push({ type: 'engagement', severity: 'medium', message: 'Auto-submission rate is above 20%' });
    if (alerts.length === 0) alerts.push({ type: 'system', severity: 'info', message: 'No critical analytics alerts' });

    return res.status(200).json({
      success: true,
      analytics: {
        totalAttempts,
        lowScoreAttempts,
        autoSubmittedAttempts,
        lowScoreRate: Number(lowScoreRate.toFixed(2)),
        autoSubmitRate: Number(autoSubmitRate.toFixed(2)),
      },
      alerts,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to fetch admin analytics alerts', error: error.message });
  }
};

export const getInteractiveGuide = async (req, res) => {
  try {
    const { role = 'student' } = req.query;
    const guideByRole = {
      student: [
        'Open AI Mock Tests.',
        'Attempt personalized recommended quizzes.',
        'Review mistakes and retry weak topics.',
      ],
      teacher: [
        'Review students attempts.',
        'Check assistant alerts.',
        'Assign recovery quizzes.',
      ],
      admin: [
        'Monitor analytics alerts.',
        'Run automation commands for quality control.',
        'Track completion and engagement trends.',
      ],
    };
    res.status(200).json({ success: true, steps: guideByRole[role] || guideByRole.student });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch guide', error: error.message });
  }
};

export const aiChatbotAssistant = async (req, res) => {
  try {
    const { message, role = 'student' } = req.body;
    if (!message) return res.status(400).json({ success: false, message: 'message is required' });
    const canned = `(${role}) Assistant: Focus on one weak topic, attempt one practice quiz, then review explanations.`;
    res.status(200).json({ success: true, reply: canned });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to respond', error: error.message });
  }
};

export const executeAutomationCommand = async (req, res) => {
  try {
    const { command } = req.body;
    if (!command) return res.status(400).json({ success: false, message: 'command is required' });
    return res.status(200).json({ success: true, executed: command });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to execute automation command', error: error.message });
  }
};
