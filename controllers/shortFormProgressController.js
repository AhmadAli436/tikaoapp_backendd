import mongoose from 'mongoose';
import ShortFormProgress from '../models/ShortFormProgress.js';
import ShortFormContent from '../models/ShortFormContent.js';
import Chapter from '../models/Chapter.js';
import Subject from '../models/Subject.js';
import Student from '../models/Student.js';

export const saveOrUpdateShortFormProgress = async (req, res) => {
  try {
    const {
      userId,
      shortFormId,
      chapterId,
      watchedClipIndexes = [],
      attemptedMcqIds = [],
      mcqAttempts = []
    } = req.body;

    if (!userId || !shortFormId || !chapterId) {
      return res.status(400).json({ message: 'Missing requireds fields' });
    }

    const shortForm = await ShortFormContent.findById(shortFormId).lean();
    if (!shortForm) return res.status(404).json({ message: 'Short form not found' });

    const totalClips = shortForm.sequence?.filter(seq => seq.type === 'clip').length || 0;
    const totalMcqs = shortForm.sequence?.filter(seq => seq.type === 'mcq').length || 0;
    const totalItems = totalClips + totalMcqs;

    const uniqueClips = [...new Set(watchedClipIndexes)];
    const uniqueMcqs = [...new Set(attemptedMcqIds.map(id => id.toString()))];

    const percentage = totalItems > 0
      ? ((uniqueClips.length + uniqueMcqs.length) / totalItems) * 100
      : 0;

    const isWatched = uniqueClips.length >= totalClips && uniqueMcqs.length >= totalMcqs;

    const correctCount = mcqAttempts.filter(a => a.isCorrect).length;
    const incorrectCount = mcqAttempts.length - correctCount;

    const updated = await ShortFormProgress.findOneAndUpdate(
      { userId, shortFormId, chapterId },
      {
        userId,
        shortFormId,
        chapterId,
        watchedClipIndexes: uniqueClips,
        attemptedMcqIds: uniqueMcqs,
        mcqAttempts,
        totalMcqsAttempted: mcqAttempts.length,
        correctCount,
        incorrectCount,
        isWatched,
        percentage,
        updatedAt: new Date(),
      },
      { upsert: true, new: true }
    );

    return res.status(200).json({ message: 'Progress saved', data: updated });
  } catch (error) {
    console.error('Error saving short form progress:', error);
    return res.status(500).json({ message: 'Internal server error', error: error.message });
  }
};

export const getShortFormProgress = async (req, res) => {
  try {
    const { userId, shortFormId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(userId) || !mongoose.Types.ObjectId.isValid(shortFormId)) {
      return res.status(400).json({ message: 'Invalid userId or shortFormId' });
    }

    const progress = await ShortFormProgress.findOne({ userId, shortFormId })
      .populate('chapterId', 'name')
      .populate('shortFormId', 'title')
      .lean();

    if (!progress) {
      return res.status(404).json({ message: 'Progress not found' });
    }

    return res.status(200).json({ message: 'Progress fetched', data: progress });
  } catch (error) {
    console.error('Error fetching progress:', error);
    return res.status(500).json({ message: 'Internal server error', error: error.message });
  }
};

export const getShortFormReport = async (req, res) => {
  try {
    const { userId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: 'Invalid userId' });
    }

    // 1. Get student's classId
    const student = await Student.findOne({ userId }).lean();
    if (!student) {
      return res.status(404).json({ message: 'Student not found' });
    }
    const classId = student.classId;

    // 2. Get all subjects in this class
    const allSubjects = await Subject.find({ class: classId }).lean();

    // 3. Get all chapters for these subjects
    const allChapters = await Chapter.find({ subject: { $in: allSubjects.map(s => s._id) } }).lean();

    // Map chapters by subjectId
    const chaptersBySubject = {};
    allSubjects.forEach(sub => { chaptersBySubject[sub._id.toString()] = []; });
    allChapters.forEach(ch => { chaptersBySubject[ch.subject.toString()].push(ch._id.toString()); });

    // 4. Precompute totals for each subject
    const subjectStats = {};
    for (const subject of allSubjects) {
      const subjectId = subject._id.toString();
      const chapters = chaptersBySubject[subjectId] || [];

      let totalVideos = 0;
      let totalMcqs = 0;

      // Get all shortform contents for these chapters
      const shortForms = await ShortFormContent.find({ chapterId: { $in: chapters } }).lean();

      for (const sf of shortForms) {
        totalVideos += sf.sequence.filter(s => s.type === 'clip').length;
        totalMcqs += sf.sequence.filter(s => s.type === 'mcq').length;
      }

      subjectStats[subjectId] = {
        subjectId,
        totalChapters: new Set(chapters),
        completedChapters: 0,
        totalVideos,
        videosWatched: 0,
        totalMcqs,
        mcqsAttempted: 0,
        correctMcqs: 0,
        incorrectMcqs: 0,
      };
    }

    // 5. Get user progresses
    const progresses = await ShortFormProgress.find({ userId }).lean();

    // 6. Aggregate progress by chapterId to avoid double counting
    const chapterProgressMap = new Map();

    for (const progress of progresses) {
      const chapterId = progress.chapterId?.toString();
      if (!chapterId) continue;

      if (!chapterProgressMap.has(chapterId)) {
        chapterProgressMap.set(chapterId, {
          watchedClips: new Set(),
          attemptedMcqs: new Set(),
          correctMcqs: 0,
          incorrectMcqs: 0,
          shortFormIds: new Set(),
        });
      }

      const chProgress = chapterProgressMap.get(chapterId);

      (progress.watchedClipIndexes || []).forEach(idx => chProgress.watchedClips.add(idx));
      (progress.attemptedMcqIds || []).forEach(id => chProgress.attemptedMcqs.add(id.toString()));
      chProgress.correctMcqs += progress.correctCount || 0;
      chProgress.incorrectMcqs += progress.incorrectCount || 0;
      chProgress.shortFormIds.add(progress.shortFormId.toString());
    }

    // 7. Now apply chapter progress to subject stats
    for (const [chapterId, chProgress] of chapterProgressMap.entries()) {
      const subjectId = Object.keys(chaptersBySubject).find(sid => chaptersBySubject[sid].includes(chapterId));
      if (!subjectId) continue;

      // Get shortform contents related to this chapter progress
      const shortForms = await ShortFormContent.find({ _id: { $in: Array.from(chProgress.shortFormIds) } }).lean();

      let totalClipsInChapter = 0;
      let totalMcqsInChapter = 0;
      shortForms.forEach(sf => {
        totalClipsInChapter += sf.sequence.filter(s => s.type === 'clip').length;
        totalMcqsInChapter += sf.sequence.filter(s => s.type === 'mcq').length;
      });

      const chapterCompleted = (chProgress.watchedClips.size >= totalClipsInChapter) && (chProgress.attemptedMcqs.size >= totalMcqsInChapter);

      const stats = subjectStats[subjectId];
      if (chapterCompleted) stats.completedChapters++;

      stats.videosWatched += chProgress.watchedClips.size;
      stats.mcqsAttempted += chProgress.attemptedMcqs.size;
      stats.correctMcqs += chProgress.correctMcqs;
      stats.incorrectMcqs += chProgress.incorrectMcqs;
    }

    // 8. Build subject reports
    const subjectReports = allSubjects.map(subj => {
      const stat = subjectStats[subj._id.toString()];
      const attempted = stat.mcqsAttempted;
      const correct = stat.correctMcqs;

      return {
        subjectId: stat.subjectId,
        subjectName: subj.name,
        totalChapters: stat.totalChapters.size,
        completedChapters: stat.completedChapters,
        totalVideos: stat.totalVideos,
        videosWatched: stat.videosWatched,
        totalMcqs: stat.totalMcqs,
        mcqsAttempted: stat.mcqsAttempted,
        correctMcqs: stat.correctMcqs,
        incorrectMcqs: stat.incorrectMcqs,
        accuracyPercentage: attempted > 0 ? Math.round((correct / attempted) * 100) : 0,
        progressPercentage:
          stat.totalVideos + stat.totalMcqs > 0
            ? Math.round(((stat.videosWatched + stat.mcqsAttempted) / (stat.totalVideos + stat.totalMcqs)) * 100)
            : 0,
      };
    });

    // 9. Calculate overall totals
    const totalChaptersSet = new Set();
    let totalVideos = 0,
      totalVideosWatched = 0,
      totalMcqs = 0,
      totalMcqsAttempted = 0,
      correctMcqs = 0,
      incorrectMcqs = 0,
      totalChaptersCompleted = 0;

    for (const stat of Object.values(subjectStats)) {
      stat.totalChapters.forEach(ch => totalChaptersSet.add(ch));
      totalVideos += stat.totalVideos;
      totalVideosWatched += stat.videosWatched;
      totalMcqs += stat.totalMcqs;
      totalMcqsAttempted += stat.mcqsAttempted;
      correctMcqs += stat.correctMcqs;
      incorrectMcqs += stat.incorrectMcqs;
      totalChaptersCompleted += stat.completedChapters;
    }

    const overallAccuracy = totalMcqsAttempted > 0 ? Math.round((correctMcqs / totalMcqsAttempted) * 100) : 0;
    const overallProgress =
      totalVideos + totalMcqs > 0
        ? Math.round(((totalVideosWatched + totalMcqsAttempted) / (totalVideos + totalMcqs)) * 100)
        : 0;

    return res.status(200).json({
      overall: {
        totalChapters: totalChaptersSet.size,
        completedChapters: totalChaptersCompleted,
        totalVideos,
        watchedVideos: totalVideosWatched,
        totalMcqs,
        attemptedMcqs: totalMcqsAttempted,
        correctMcqs,
        incorrectMcqs,
        accuracyPercentage: overallAccuracy,
        progressPercentage: overallProgress,
      },
      subjects: subjectReports,
    });
  } catch (error) {
    console.error('Error generating short form report:', error);
    return res.status(500).json({ message: 'Internal server error', error: error.message });
  }
};



export const getShortFormAttemptStatusByChapter = async (req, res) => {
  try {
    const { userId, chapterId } = req.query;

    if (!mongoose.Types.ObjectId.isValid(userId) || !mongoose.Types.ObjectId.isValid(chapterId)) {
      return res.status(400).json({ message: 'Invalid userId or chapterId' });
    }

    // Fetch all shortforms for the chapter
    const shortForms = await ShortFormContent.find({ chapterId })
      .select('_id title thumbnailUrl')
      .lean();

    if (!shortForms.length) {
      return res.status(404).json({ message: 'No shortforms found for this chapter' });
    }

    // Fetch all progress for the user in this chapter
    const progresses = await ShortFormProgress.find({ userId, chapterId }).select('shortFormId').lean();
    const attemptedSet = new Set(progresses.map(p => p.shortFormId.toString()));

    const result = shortForms.map(sf => ({
      shortFormId: sf._id,
      title: sf.title,
      thumbnailUrl: sf.thumbnailUrl,
      isAttempted: attemptedSet.has(sf._id.toString())
    }));

    return res.status(200).json({ data: result });
  } catch (error) {
    console.error('Error fetching shortform attempt status:', error);
    return res.status(500).json({ message: 'Internal server error', error: error.message });
  }
};
