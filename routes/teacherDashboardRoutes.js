import express from 'express';
import { getAssignedStudents, getClasswiseCountByTeacher, getTeacherLastMonthEarnings, getTeacherReferralCode } from '../controllers/teacherDashboardController.js';
import { authenticateToken } from '../controllers/authController.js';

const router = express.Router();



//get total no of students count and list of assigned students
router.get('/teacher/assigned-students',authenticateToken, getAssignedStudents);


//get the earning report using teavher id last month report
router.get('/teacher/earnings/last-month',authenticateToken, getTeacherLastMonthEarnings);

//get the refferal code of the teacher
router.get('/teacher/referral-code',authenticateToken, getTeacherReferralCode);


//get the graph classwise students counts
router.get('/teacher/classwise-students-count',authenticateToken, getClasswiseCountByTeacher);

export default router;
