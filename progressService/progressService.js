import Chapter from "../models/Chapter.js";
import Subject from "../models/Subject.js";
import VideoProgress from "../models/VideoProgress.js"
import MockTest from "../models/MockTest.js";
import MockTestAttempt from "../models/MockTestAttempt.js";
import mongoose from 'mongoose';
import ShortFormContent from "../models/ShortFormContent.js";
import ShortFormProgress from "../models/ShortFormProgress.js";

// Helper to calculate chapter progress for a user
async function getChapterProgress(userId, chapterId) {
  const videos = await VideoProgress.find({ userId, chapterId }).lean();
  if (!videos.length) return 0;

  const totalPercent = videos.reduce((acc, vid) => acc + (vid.progress || 0), 0);
  return totalPercent / videos.length;
}
export async function getSubjectOverallProgress(req, res) {
  const { subjectId, userId } = req.params;

  try {
    const chapters = await Chapter.find({ subject: subjectId }).lean();
    if (!chapters.length) return res.json({ progress: 0 });

    const progresses = await Promise.all(
      chapters.map(ch => getChapterProgress(userId, ch._id))
    );

    const validProgresses = progresses.filter(p => !isNaN(p));
    const avgProgress = validProgresses.length
      ? validProgresses.reduce((a, b) => a + b, 0) / validProgresses.length
      : 0;

    res.json({ progress: Math.round(avgProgress) });
  } catch (error) {
    res.status(500).json({ message: 'Failed to get overall subject progress', error: error.message });
  }
}



export async function getSubjectsProgressByClass(req, res) {
  const { classId, userId } = req.params;

  try {
    if (!mongoose.Types.ObjectId.isValid(classId) || !mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: 'Invalid classId or userId' });
    }

    // 1. Fetch subjects for this class
    const subjects = await Subject.find({ class: classId }).lean();
    console.log('Subjects found:', subjects.length);

    if (!subjects.length) return res.json([]);

    // 2. Calculate progress for each subject
    const results = await Promise.all(subjects.map(async subject => {
      // Fetch chapters for this subject
      const chapters = await Chapter.find({ subject: subject._id }).lean();
      console.log(`Subject ${subject.name}: Chapters found:`, chapters.length);

      if (!chapters.length) {
        return {
          subjectId: subject._id,
          subjectName: subject.name,
          progress: 0
        };
      }

      // Calculate each chapter's progress
      const progresses = await Promise.all(
        chapters.map(ch => getChapterProgress(userId, ch._id))
      );

      // Filter out NaN just in case
      const validProgresses = progresses.filter(p => !isNaN(p));
      const avgProgress = validProgresses.length
        ? validProgresses.reduce((a, b) => a + b, 0) / validProgresses.length
        : 0;

      return {
        subjectId: subject._id,
        subjectName: subject.name,
        progress: Math.round(avgProgress)
      };
    }));

    res.json(results);
  } catch (error) {
    console.error('Error fetching subject progress:', error);
    res.status(500).json({
      message: 'Failed to fetch subjects progress',
      error: error.message
    });
  }
}
///moccktest overall

export const getMockTestOverallProgress = async (req, res) => {
  try {
    const { subjectId, userId } = req.params;

    // Fetch all mock tests of the subject
    const mockTests = await MockTest.find({ subject: subjectId }).lean();
    if (!mockTests.length) return res.json({ progressPercentage: 0 });

    // Fetch all attempts by the user for this subject
    const allAttempts = await MockTestAttempt.find({ userId, subjectId }).lean();

    // Sum total MCQs in subject
    const totalMcqsInSubject = mockTests.reduce((sum, test) => {
      const count = Array.isArray(test.mcqs) ? test.mcqs.length : 0;
      return sum + count;
    }, 0);

    // Sum total MCQs attempted by user in this subject
    const totalMcqsAttempted = allAttempts.reduce((sum, attempt) => {
      return sum + (attempt.totalMcqsAttempted || 0);
    }, 0);

    // Calculate overall progress percentage
    const progressPercentage = totalMcqsInSubject
      ? Math.round((totalMcqsAttempted / totalMcqsInSubject) * 100)
      : 0;

    res.json({ progressPercentage });

  } catch (error) {
    console.error('Mock Test Progress Error:', error);
    res.status(500).json({
      message: 'Failed to get mock test progress',
      error: error.message
    });
  }
};

//shortform

export const getShortFormOverallProgress = async (req, res) => {
  try {
    const { chapterId, userId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(userId) || !mongoose.Types.ObjectId.isValid(chapterId)) {
      return res.status(400).json({ message: 'Invalid userId or chapterId' });
    }

    // Get all shortform contents for this chapter
    const shortForms = await ShortFormContent.find({ chapterId }).lean();
    if (!shortForms.length) return res.json({ progressPercentage: 0 });

    // Sum total clips and MCQs in all shortforms for this chapter
    let totalVideos = 0;
    let totalMcqs = 0;

    shortForms.forEach(sf => {
      totalVideos += sf.sequence.filter(s => s.type === 'clip').length;
      totalMcqs += sf.sequence.filter(s => s.type === 'mcq').length;
    });

    // Get user's progress entries for this chapter's shortforms
    const shortFormIds = shortForms.map(sf => sf._id.toString());
    const progresses = await ShortFormProgress.find({
      userId,
      shortFormId: { $in: shortFormIds }
    }).lean();

    let videosWatched = 0;
    let mcqsAttempted = 0;

    progresses.forEach(progress => {
      videosWatched += new Set(progress.watchedClipIndexes || []).size;
      mcqsAttempted += new Set(progress.attemptedMcqIds?.map(id => id.toString()) || []).size;
    });

    // Calculate overall progress percentage
    const totalContent = totalVideos + totalMcqs;
    const progressPercentage = totalContent
      ? Math.round(((videosWatched + mcqsAttempted) / totalContent) * 100)
      : 0;

    res.json({ progressPercentage });

  } catch (error) {
    console.error('ShortForm Progress Error:', error);
    res.status(500).json({ message: 'Failed to get shortform progress', error: error.message });
  }
};
