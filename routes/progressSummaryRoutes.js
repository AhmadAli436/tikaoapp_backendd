import express from 'express';
import {
  getUnifiedProgressReport,
} from '../controllers/progressSummaryController.js'; // adjust the path as needed
import { authenticateToken } from '../controllers/authController.js';

const router = express.Router();

// Unified progress report combining long-form + short-form
router.get('/user/:userId/unified-progress',authenticateToken, getUnifiedProgressReport);

export default router;
