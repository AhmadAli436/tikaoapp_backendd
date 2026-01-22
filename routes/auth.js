import express from 'express';
import {
  sendOTP,
  verifyOTP,
  selectRole,
  welcome,
  studentDetails,
  checkTeacherApproval,
  getUserDetails,
  authenticateToken,
} from '../controllers/authController.js';

const router = express.Router();
//<<<<<<<<<<<<<<<<<<<<<new flow routes >>>>>>>>>>>>>>>>>>>>>>>>>>>>>
router.post('/send-otp', sendOTP);
router.post('/verify-otp', verifyOTP);
router.put('/select-role', authenticateToken, selectRole);

//<<<<<<<<<<<<<<<<<<<<<end here >>>>>>>>>>>>>>>>>>>>>>>>>>>>>

router.get('/welcome/:userId', authenticateToken, welcome);
router.post('/student-details', authenticateToken, studentDetails);
router.get('/teacher-approval/:userId', authenticateToken, checkTeacherApproval);
router.get('/user/:userId', authenticateToken, getUserDetails);

export default router;