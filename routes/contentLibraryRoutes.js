import express from 'express';
import { getClasses,getChaptersBySubject, getSubjectsByClass  } from '../controllers/contentLibraryController.js';
import { authenticateToken } from '../controllers/authController.js';

const router = express.Router();

router.get('/subject/:subjectId/chapters',authenticateToken, getChaptersBySubject);
router.get('/classes',authenticateToken, getClasses);
router.get('/subjects/:classId',authenticateToken, getSubjectsByClass);

export default router;
