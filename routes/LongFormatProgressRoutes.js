import express from 'express';
import {
  saveOrUpdateProgress,
  getProgressList,
  getUserProgressReport
} from '../controllers/longFromatProgresscontroller.js';
import { authenticateToken } from '../controllers/authController.js';

const router = express.Router();

router.put('/progress',authenticateToken, saveOrUpdateProgress);
router.get('/getprogress/:userId/:videoId',authenticateToken, getProgressList);
router.get('/video/report/user/:userId',authenticateToken, getUserProgressReport); // 🆕 New Route

export default router;
