// routes/referralRoutes.js

import express from 'express';
import { verifyReferralCode } from '../controllers/refferalController.js';
import { authenticateToken } from '../controllers/authController.js';

const router = express.Router();

router.post('/',authenticateToken, verifyReferralCode);

export default router;
