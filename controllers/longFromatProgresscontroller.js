import mongoose from 'mongoose';
import VideoProgress from '../models/VideoProgress.js';
import Chapter from '../models/Chapter.js';
import Subject from '../models/Subject.js';
import Student from '../models/Student.js';

export const saveOrUpdateProgress = async (req, res) => {
  try {
    const { userId, videoId, chapterId, resumeTime, totalTime } = req.body;

    if (!userId || !videoId || !chapterId || resumeTime == null || !totalTime) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    const progress = Math.min((resumeTime / totalTime) * 100, 100);
    const isWatched = progress >= 95;

    const updateData = {
      userId,
      videoId,
      chapterId,
      resumeTime,
      totalTime,
      progress,
      isWatched,
      updatedAt: new Date(),
    };

    const updated = await VideoProgress.findOneAndUpdate(
      { userId, videoId, chapterId },
      updateData,
      { upsert: true, new: true }
    );

    return res.status(200).json({ message: 'Progress saved', data: updated });
  } catch (error) {
    console.error('❌ Error saving progress:', error);
    return res.status(500).json({ message: 'Internal server error', error: error.message });
  }
};

export const getProgressList = async (req, res) => {
  try {
    const { userId, videoId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(userId) || !mongoose.Types.ObjectId.isValid(videoId)) {
      return res.status(400).json({ message: 'Invalid userId or videoId' });
    }

    const progressList = await VideoProgress.find({ userId, videoId }).lean();

    if (!progressList.length) {
      return res.status(200).json({ message: 'No progress found', data: [] });
    }

    return res.status(200).json({ data: progressList });
  } catch (error) {
    console.error('❌ Error fetching progress:', error);
    return res.status(500).json({ message: 'Internal server error', error: error.message });
  }
};

export const getUserProgressReport = async (req, res) => {
  try {
    const { userId } = req.params;

    // Validate userId
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: 'Invalid userId' });
    }

    // 1. Get student's classId
    const student = await Student.findOne({ userId }).lean();
    if (!student) {
      return res.status(404).json({ message: "Student not found" });
    }
    const classId = student.classId;

    // 2. Get all subjects for this class
    const allSubjects = await Subject.find({ class: classId })
      .select('_id name')
      .lean();
    if (!allSubjects.length) {
      return res.status(404).json({ message: 'No subjects found for this class' });
    }

    // 3. Get all chapters for these subjects (real total chapter counts)
    const allChaptersForSubjects = await Chapter.find({
      subject: { $in: allSubjects.map(s => s._id) }
    }).select('_id subject').lean();

    const subjectChapterCountMap = {};
    allChaptersForSubjects.forEach(ch => {
      const subjectId = ch.subject.toString();
      if (!subjectChapterCountMap[subjectId]) {
        subjectChapterCountMap[subjectId] = 0;
      }
      subjectChapterCountMap[subjectId]++;
    });

    // 4. Get all video progress records for this user
    const progresses = await VideoProgress.find({ userId }).lean();
    const chapterIds = progresses.map(p => p.chapterId);

    // 5. Fetch chapters that have progress and map to subjects
    const chaptersWithProgress = await Chapter.find({ _id: { $in: chapterIds } })
      .populate('subject', 'name')
      .select('_id subject')
      .lean();

    const chapterSubjectMap = {};
    chaptersWithProgress.forEach(chap => {
      if (chap.subject && typeof chap.subject === 'object') {
        chapterSubjectMap[chap._id.toString()] = {
          subjectId: chap.subject._id.toString(),
          subjectName: chap.subject.name
        };
      }
    });

    // 6. Build progress stats per subject
    const subjectProgressMap = {};
    progresses.forEach(p => {
      const subjectInfo = chapterSubjectMap[p.chapterId?.toString()];
      if (!subjectInfo) return;

      const { subjectId, subjectName } = subjectInfo;

      if (!subjectProgressMap[subjectId]) {
        subjectProgressMap[subjectId] = {
          subjectId,
          subjectName,
          totalWatchedTime: 0,
          totalTime: 0,
          completedChapters: 0
        };
      }

      subjectProgressMap[subjectId].totalWatchedTime += p.resumeTime || 0;
      subjectProgressMap[subjectId].totalTime += p.totalTime || 0;
      subjectProgressMap[subjectId].completedChapters += p.isWatched ? 1 : 0;
    });

    // 7. Create final subject reports
    const subjectReports = allSubjects.map(subj => {
      const progress = subjectProgressMap[subj._id.toString()];
      const totalChapters = subjectChapterCountMap[subj._id.toString()] || 0;

      if (progress) {
        return {
          subjectId: subj._id,
          subjectName: subj.name,
          totalWatchedTime: progress.totalWatchedTime,
          totalTime: progress.totalTime,
          totalChapters,
          completedChapters: progress.completedChapters,
          // Percentage based on completed chapters
          progressPercentage: totalChapters > 0
            ? Number(((progress.completedChapters / totalChapters) * 100).toFixed(2))
            : 0
        };
      }

      // Subject with no progress yet
      return {
        subjectId: subj._id,
        subjectName: subj.name,
        totalWatchedTime: 0,
        totalTime: 0,
        totalChapters,
        completedChapters: 0,
        progressPercentage: 0
      };
    });

    // 8. Compute overall stats using real total chapter counts
    const overallWatchedTime = subjectReports.reduce((sum, s) => sum + s.totalWatchedTime, 0);
    const overallTotalTime = subjectReports.reduce((sum, s) => sum + s.totalTime, 0);
    const overallChapters = allChaptersForSubjects.length;
    const overallCompleted = subjectReports.reduce((sum, s) => sum + s.completedChapters, 0);

    // Overall percentage also based on completed chapters
    const overallProgressPercentage = overallChapters > 0
      ? Number(((overallCompleted / overallChapters) * 100).toFixed(2))
      : 0;

    // 9. Send final response
    return res.status(200).json({
      data: {
        overall: {
          totalWatchedTime: overallWatchedTime,
          totalTime: overallTotalTime,
          totalChapters: overallChapters,
          completedChapters: overallCompleted,
          progressPercentage: overallProgressPercentage
        },
        subjects: subjectReports
      }
    });

  } catch (error) {
    console.error('❌ Error generating user progress report:', error);
    return res.status(500).json({
      message: 'Internal server error',
      error: error.message
    });
  }
};
