import express from 'express';
import {
  saveOrUpdateShortFormProgress,
  getShortFormProgress,
  getShortFormReport,
  getShortFormAttemptStatusByChapter
} from '../controllers/shortFormProgressController.js';
import { authenticateToken } from '../controllers/authController.js';

const router = express.Router();

// PUT or POST depending on your client implementation
router.put('/progress', authenticateToken,saveOrUpdateShortFormProgress);

// Get specific short form progress
router.get('/progress/:userId/:shortFormId',authenticateToken, getShortFormProgress);

router.get('/shortform/report/:userId',authenticateToken, getShortFormReport);

router.get('/shortform/attempt-status',authenticateToken, getShortFormAttemptStatusByChapter);

export default router;
