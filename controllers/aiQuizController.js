import mongoose from 'mongoose';
import AIQuizTest from '../models/AIQuizTest.js';
import QuizAttempt from '../models/QuizAttempt.js';

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
