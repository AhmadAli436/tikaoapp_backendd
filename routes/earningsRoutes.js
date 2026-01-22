import express from 'express';
import { getTeacherEarnings, uploadEarnings, deleteEarning, getTeachers, downloadReports, getTeacherEarning } from '../controllers/earningsController.js';
import { authenticateToken } from '../controllers/authController.js';

const router = express.Router();

router.get('/teachers',authenticateToken, getTeacherEarnings);
router.get('/teachers/list',authenticateToken, getTeachers); // Fetch teacher list
router.get('/singleteacherreport',authenticateToken, getTeacherEarning);

router.post('/upload',authenticateToken, uploadEarnings);
router.post('/download-reports',authenticateToken, downloadReports);
router.delete('/:id',authenticateToken, deleteEarning);

export default router;