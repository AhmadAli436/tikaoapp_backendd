// routes/teacherMockTestRoutes.js
import express from 'express';
import { getMockTestAttemptDetails, getMockTestAttemptStatusBySubject, getTeacherMockTestReport, saveMockTestAttempt } from '../controllers/mockTestProgressController.js';
import { authenticateToken } from '../controllers/authController.js';


const router = express.Router();

router.post('/teacher-mocktest/attempt',authenticateToken, saveMockTestAttempt);
router.get('/teacher-mocktest/attempt/:userId/:subjectId/:mockTestId',authenticateToken, getMockTestAttemptDetails);
router.get('/teacher-mocktest/report/:userId',authenticateToken, getTeacherMockTestReport);
//get the status of the mocktest of subject
router.get('/mocktest/attempt-status',authenticateToken, getMockTestAttemptStatusBySubject);
export default router;
