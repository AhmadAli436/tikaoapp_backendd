import express from 'express';
import {
  sendMessage,
  getConversations,
  getThreadMessages,
  submitFeedback,
  getFeedbackForUser,
  getAllMessagesAdmin,
  getAllFeedbackAdmin,
} from '../controllers/messagingController.js';
import { authenticateToken } from '../controllers/authController.js';

const router = express.Router();

router.post('/send', authenticateToken, sendMessage);
router.get('/conversations/:userId', authenticateToken, getConversations);
router.get('/thread/:threadId', authenticateToken, getThreadMessages);
router.post('/feedback', authenticateToken, submitFeedback);
router.get('/feedback/:userId', authenticateToken, getFeedbackForUser);
router.get('/admin/all', authenticateToken, getAllMessagesAdmin);
router.get('/admin/feedback', authenticateToken, getAllFeedbackAdmin);

export default router;
