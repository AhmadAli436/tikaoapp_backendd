import express from 'express';
import { getMockTestOverallProgress, getShortFormOverallProgress, getSubjectOverallProgress, getSubjectsProgressByClass } from '../progressService/progressService.js';
import { authenticateToken } from '../controllers/authController.js';

const router = express.Router();

// Subjects progress for user in a class
router.get('/subject/:classId/:userId',authenticateToken, getSubjectsProgressByClass);


router.get('/subject/overall-progress/:subjectId/:userId',authenticateToken, getSubjectOverallProgress);


router.get('/mockTest/:subjectId/:userId',authenticateToken, getMockTestOverallProgress);


router.get('/shortform/:chapterId/:userId',authenticateToken, getShortFormOverallProgress);

export default router;
