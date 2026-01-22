// controllers/saveMockTestAttempt.js
import mongoose from 'mongoose';
import Subject from '../models/Subject.js';
import MockTest from '../models/MockTest.js';
import MockTestAttempt from '../models/MockTestAttempt.js';
import ShortFormProgress from '../models/ShortFormProgress.js';
import Student from '../models/Student.js';

export const saveMockTestAttempt = async (req, res) => {
  try {
    const { userId, subjectId, mockTestId, mcqAttempts } = req.body;

    if (!userId || !subjectId || !mockTestId || !Array.isArray(mcqAttempts)) {
      return res.status(400).json({ message: 'Missing or invalid fields' });
    }

    const [subject, mockTest] = await Promise.all([
      Subject.findById(subjectId).lean(),
      MockTest.findById(mockTestId).populate('mcqs.mcqId', 'correctOption').lean(),
    ]);

    if (!subject) return res.status(404).json({ message: 'Subject not found' });
    if (!mockTest) return res.status(404).json({ message: 'Mock test not found' });

    const existingAttempt = await MockTestAttempt.findOne({ userId, mockTestId, subjectId }).lean();

    if (existingAttempt) {
      const alreadyAttemptedIds = new Set(existingAttempt.mcqAttempts.map(a => a.mcqId.toString()));
      const duplicate = mcqAttempts.some(a => alreadyAttemptedIds.has(a.mcqId));
      if (duplicate) return res.status(400).json({ message: 'One or more MCQs already attempted' });
    }

    const correctAnswerMap = new Map();
    for (const mcq of mockTest.mcqs) {
      if (mcq.mcqId?.correctOption) {
        correctAnswerMap.set(mcq.mcqId._id.toString(), mcq.mcqId.correctOption);
      }
    }

    let correctCount = 0, incorrectCount = 0;
    const processedAttempts = mcqAttempts.map(({ mcqId, selectedOption }) => {
      const correctOption = correctAnswerMap.get(mcqId.toString());
      const isCorrect = selectedOption === correctOption;
      isCorrect ? correctCount++ : incorrectCount++;
      return {
        mcqId,
        selectedOption,
        isCorrect,
        incorrectOption: isCorrect ? null : selectedOption,
      };
    });

    const updatedAttempt = await MockTestAttempt.findOneAndUpdate(
      { userId, mockTestId, subjectId },
      {
        userId, subjectId, mockTestId,
        isAttempted: true,
        mcqAttempts: processedAttempts,
        correctCount,
        incorrectCount,
        totalMcqsAttempted: processedAttempts.length,
      },
      { upsert: true, new: true }
    );

    res.status(200).json({
      message: 'Mock test attempt saved',
      data: updatedAttempt
    });
  } catch (error) {
    console.error('Attempt Save Error:', error);
    res.status(500).json({ message: 'Internal Server Error', error: error.message });
  }
};

export const getMockTestAttemptDetails = async (req, res) => {
  try {
    const { userId, subjectId, mockTestId } = req.params;

    const attempt = await MockTestAttempt.findOne({ userId, subjectId, mockTestId }).lean();
    if (!attempt) return res.status(404).json({ message: 'Attempt not found' });

    res.status(200).json({
      message: 'Attempt retrieved',
      data: attempt
    });
  } catch (error) {
    console.error('Fetch Attempt Error:', error);
    res.status(500).json({ message: 'Internal Server Error', error: error.message });
  }
};


export const getTeacherMockTestReport = async (req, res) => {
  try {
    const { userId } = req.params;

    // 1. Get student's classId
    const student = await Student.findOne({ userId }).lean();
    if (!student) {
      return res.status(404).json({ message: "Student not found" });
    }
    const classId = student.classId;

    // 2. Get all subjects for this class
    const subjects = await Subject.find({ class: classId }).lean();

    // 3. Get all mock test attempts by this user
    const allAttempts = await MockTestAttempt.find({ userId }).lean();

    // Initialize overall counters
    let totalMockTests = 0;
    let totalMockTestsAttempted = 0;
    let totalMcqsAttempted = 0;
    let totalCorrect = 0;
    let totalMcqsAvailable = 0;

    const subjectsReport = [];

    // 4. For each subject
    for (const subject of subjects) {
      const subjectId = subject._id;

      // Fetch all mock tests in this subject
      const mockTests = await MockTest.find({ subject: subjectId }).lean();

      // Attempts for this subject
      const subjectAttempts = allAttempts.filter(
        a => a.subjectId.toString() === subjectId.toString()
      );

      // Unique attempted mock test IDs
      const attemptedMockTests = new Set(
        subjectAttempts.map(a => a.mockTestId.toString())
      );

      // Count MCQs attempted & correct answers
      const mcqsAttempted = subjectAttempts.reduce(
        (sum, a) => sum + (a.totalMcqsAttempted || 0),
        0
      );
      const correct = subjectAttempts.reduce(
        (sum, a) => sum + (a.correctCount || 0),
        0
      );

      // Count total MCQs in all mock tests in this subject
      const totalMcqsInSubject = mockTests.reduce((sum, test) => {
        const count = Array.isArray(test.mcqs) ? test.mcqs.length : 0;
        return sum + count;
      }, 0);

      // Update overall stats
      totalMockTests += mockTests.length;
      totalMockTestsAttempted += attemptedMockTests.size;
      totalMcqsAttempted += mcqsAttempted;
      totalCorrect += correct;
      totalMcqsAvailable += totalMcqsInSubject;

      // Subject report
      subjectsReport.push({
        subjectId: subject._id,
        subjectName: subject.name,
        totalMockTests: mockTests.length,
        attemptedMockTests: attemptedMockTests.size,
        totalMcqs: totalMcqsInSubject,
        mcqsAttempted,
        accuracy: mcqsAttempted ? Math.round((correct / mcqsAttempted) * 100) : 0,
        progressPercentage: totalMcqsInSubject
          ? Math.round((mcqsAttempted / totalMcqsInSubject) * 100)
          : 0
      });
    }

    // 5. Calculate overall stats
    const overallAccuracy = totalMcqsAttempted
      ? Math.round((totalCorrect / totalMcqsAttempted) * 100)
      : 0;
    const overallProgress = totalMcqsAvailable
      ? Math.round((totalMcqsAttempted / totalMcqsAvailable) * 100)
      : 0;

    // 6. Send final report
    res.status(200).json({
      overall: {
        totalMockTests,
        attemptedMockTests: totalMockTestsAttempted,
        totalMcqs: totalMcqsAvailable,
        mcqsAttempted: totalMcqsAttempted,
        accuracy: overallAccuracy,
        progressPercentage: overallProgress
      },
      subjects: subjectsReport
    });

  } catch (error) {
    console.error("Report Error:", error);
    res.status(500).json({
      message: "Internal Server Error",
      error: error.message
    });
  }
};



//get the  status of the all mocktests of the subjects
export const getMockTestAttemptStatusBySubject = async (req, res) => {
  try {
    const { userId, subjectId } = req.query;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: 'Invalid userId' });
    }

    if (!mongoose.Types.ObjectId.isValid(subjectId)) {
      return res.status(400).json({ message: 'Invalid subjectId' });
    }

    // Get all mock tests for this subject
    const mockTests = await MockTest.find({ subject: subjectId })
      .populate('subject', 'name')
      .lean();

    // Get all attempted mock test IDs (only presence matters)
    const attempts = await MockTestAttempt.find({ userId, subjectId })
      .select('mockTestId')
      .lean();

    const attemptedSet = new Set(
      attempts.map(a => a.mockTestId.toString())
    );

    // Build response (true if present in Set, else false)
    const mockTestStatus = mockTests.map(test => ({
      mockTestId: test._id,
      title: test.title,
      subject: test.subject?.name || 'Unknown',
      isAttempted: attemptedSet.has(test._id.toString())
    }));

    return res.status(200).json({ data: mockTestStatus });
  } catch (error) {
    console.error('Error fetching mock test attempt status by subject:', error);
    return res.status(500).json({ message: 'Internal server error', error: error.message });
  }
};
