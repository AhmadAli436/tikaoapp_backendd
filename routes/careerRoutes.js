import express from 'express';
import {
  getPerformanceAnalysis,
  getPersonalizedSuggestions,
  getCareerPathGuidance,
  getTeacherInsights,
  getMarketTrends,
  getAllSkills,
  createSkill,
  updateSkill,
  deleteSkill,
  getAllPaths,
  createPath,
  updatePath,
  deletePath,
} from '../controllers/careerController.js';
import { authenticateToken } from '../controllers/authController.js';

const router = express.Router();

router.get('/students/:studentId/performance', authenticateToken, getPerformanceAnalysis);
router.get('/students/:studentId/suggestions', authenticateToken, getPersonalizedSuggestions);
router.get('/students/:studentId/career-paths', authenticateToken, getCareerPathGuidance);
router.get('/teachers/:teacherId/insights', authenticateToken, getTeacherInsights);
router.get('/market-trends', authenticateToken, getMarketTrends);

router.get('/skills', authenticateToken, getAllSkills);
router.post('/skills', authenticateToken, createSkill);
router.put('/skills/:id', authenticateToken, updateSkill);
router.delete('/skills/:id', authenticateToken, deleteSkill);

router.get('/paths', authenticateToken, getAllPaths);
router.post('/paths', authenticateToken, createPath);
router.put('/paths/:id', authenticateToken, updatePath);
router.delete('/paths/:id', authenticateToken, deletePath);

export default router;
