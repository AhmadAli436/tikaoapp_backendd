import express from 'express';
import {
  getAllQuizzes,
  getQuizById,
  submitQuizAttempt,
  getQuizAttempts,
  getStudentQuizAttempts,
  getTeacherStudentsAttempts,
  getPersonalizedStudySupport,
  getTeacherConsoleAssistant,
  getAdminAnalyticsAlerts,
  getInteractiveGuide,
  aiChatbotAssistant,
  executeAutomationCommand,
} from '../controllers/aiQuizController.js';

const router = express.Router();

// Get all active quizzes
router.get('/quizzes', getAllQuizzes);

// Get quiz by ID
router.get('/quizzes/:id', getQuizById);

// Submit quiz attempt
router.post('/quizzes/attempt', submitQuizAttempt);

// Get attempts for a specific quiz
router.get('/quizzes/:quizId/attempts', getQuizAttempts);

// Get student's quiz attempts
router.get('/students/:studentId/attempts', getStudentQuizAttempts);

// Get teacher's students attempts
router.get('/teachers/:teacherId/students-attempts', getTeacherStudentsAttempts);
router.get('/students/:studentId/personalized-support', getPersonalizedStudySupport);
router.get('/teachers/:teacherId/assistant', getTeacherConsoleAssistant);
router.get('/admin/analytics-alerts', getAdminAnalyticsAlerts);
router.get('/guide', getInteractiveGuide);
router.post('/assistant/chat', aiChatbotAssistant);
router.post('/automation/execute', executeAutomationCommand);

export default router;
