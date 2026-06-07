import express from 'express';
import {
  getStudentDashboard,
  getTeacherDashboardStats,
  getGamificationStats,
  getQuizUploadTracking,
  getAdminAnalytics,
} from '../controllers/mobileDashboardController.js';
import { authenticateToken } from '../controllers/authController.js';

const router = express.Router();

router.get('/student', authenticateToken, getStudentDashboard);
router.get('/teacher', authenticateToken, getTeacherDashboardStats);
router.get('/gamification/:userId', authenticateToken, getGamificationStats);
router.get('/quiz-tracking', authenticateToken, getQuizUploadTracking);
router.get('/admin-analytics', authenticateToken, getAdminAnalytics);

export default router;
