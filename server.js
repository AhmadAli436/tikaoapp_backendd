// server.js
import 'dotenv/config';
import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import authRoutes from './routes/auth.js';
import progressRoutes from './routes/progressRoutes.js';
import studentRouter from './routes/studentRoutes.js';
import teacherRoutes from './routes/teacherRoutes.js';
import s3Routes from './routes/s3Routes.js';
import swaggerUi from 'swagger-ui-express';

import fs from 'fs';
const swaggerDocument = JSON.parse(fs.readFileSync('./swagger-output.json', 'utf-8'));

import contentLibraryRoutes from './routes/contentLibraryRoutes.js'
import refferalRoutes from './routes/refferalRoutes.js'
import LongFormatProgressRoutes from './routes/LongFormatProgressRoutes.js'
import ShortFormProgressRoutes from './routes/ShortFormProgressRoutes.js'
import mocktestProgressRoutes from './routes/mocktestProgressRoutes.js'
import progressSummaryRoutes from './routes/progressSummaryRoutes.js'
import earningsRoutes from './routes/earningsRoutes.js'
import teacherDashboardRoutes from './routes/teacherDashboardRoutes.js'
import studentDashboard  from './routes/studentDashboard.js'
import aiQuizRoutes from './routes/aiQuizRoutes.js'
// Import models to register them
import './models/AppUser.js';
import './models/Teacher.js';
import './models/Student.js';
import './models/Languages.js';
import './models/Class.js';
import './models/Subject.js';
import './models/Chapter.js';
import './models/LongFormatVideo.js';
import './models/Board.js';
import './models/AIQuizTest.js';
import './models/QuizAttempt.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());

app.use(express.static(join(__dirname, 'public')));

const PORT = process.env.PORT || 5000;

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.error('MongoDB connections error:', err));


app.use('/api/s3', s3Routes);
app.use('/api/auth', authRoutes);
app.use('/api/student', studentRouter);


//for content library progress/////////////
app.use('/api/Specific', progressRoutes);
app.use('/api/teacher', teacherRoutes);





app.use('/api/content',contentLibraryRoutes);
app.use('/api/verifyrefferal',refferalRoutes)
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

//progress reports routes
app.use('/api/Longprogress',LongFormatProgressRoutes)
app.use('/api/Shortprogress',ShortFormProgressRoutes)
app.use('/api/Mockprogress',mocktestProgressRoutes)
app.use('/api/ProgressSummary',progressSummaryRoutes)
//earning reports routes
app.use('/api/earnings', earningsRoutes);


//dashboard routes
app.use('/api/teacherdashboard', teacherDashboardRoutes);
app.use('/api/studentdashboard', studentDashboard);

//AI quiz routes
app.use('/api/ai-quiz', aiQuizRoutes);

//test route
app.get('/api/test', (req, res) => {
  res.send('hello i am test check backend');
});
app.use((req, res) => {
  res.status(404).json({ message: 'Endpoint not found' });
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));