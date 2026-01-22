// routes/studentRoutes.js or similar

import express from 'express';
import { getSubjectsWithTeachersByStudent } from '../controllers/studentDashboardController.js';
import { authenticateToken } from '../controllers/authController.js';

const router = express.Router();

router.get('/student/subjects-with-teachers', authenticateToken,getSubjectsWithTeachersByStudent);

export default router;
