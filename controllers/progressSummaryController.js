import mongoose from 'mongoose';
import VideoProgress from '../models/VideoProgress.js';
import ShortFormProgress from '../models/ShortFormProgress.js';
import ShortFormContent from '../models/ShortFormContent.js';
import Chapter from '../models/Chapter.js';
import Subject from '../models/Subject.js';
import Student from '../models/Student.js';

export const getUnifiedProgressReport = async (req, res) => {
  try {
    const { userId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: "Invalid userId" });
    }

    // 1️⃣ Get student + classId
    const student = await Student.findOne({ userId }).lean();
    if (!student) {
      return res.status(404).json({ message: "Student not found" });
    }
    const classId = student.classId;

    // 2️⃣ Get all subjects for class
    const allSubjects = await Subject.find({ class: classId }).lean();
    if (!allSubjects.length) {
      return res.status(404).json({ message: "No subjects found for this class" });
    }
    const subjectIds = allSubjects.map(s => s._id);

    // 3️⃣ Get all chapters & mapping
    const allChapters = await Chapter.find({ subject: { $in: subjectIds } })
      .populate("subject", "name")
      .lean();

    const chapterSubjectMap = {};
    const subjectChapterMap = {};
    allSubjects.forEach(s => {
      subjectChapterMap[s._id.toString()] = [];
    });

    allChapters.forEach(ch => {
      const sid = ch.subject._id.toString();
      chapterSubjectMap[ch._id.toString()] = sid;
      subjectChapterMap[sid].push(ch._id.toString());
    });

    // 4️⃣ Precompute total MCQs for each chapter (only once)
    const shortFormsAll = await ShortFormContent.find({
      chapterId: { $in: allChapters.map(ch => ch._id) },
    }).lean();

    const chapterMcqTotalMap = {};
    shortFormsAll.forEach(sf => {
      const mcqCount = sf.sequence.filter(s => s.type === "mcq").length;
      chapterMcqTotalMap[sf.chapterId.toString()] =
        (chapterMcqTotalMap[sf.chapterId.toString()] || 0) + mcqCount;
    });

    // 5️⃣ Init per-subject stats
    const statsMap = {};
    allSubjects.forEach(s => {
      const subjectId = s._id.toString();
      statsMap[subjectId] = {
        subjectId,
        subjectName: s.name,
        totalChapters: new Set(subjectChapterMap[subjectId]),
        completedChapters: new Set(),
        totalVideos: 0,
        videosWatched: 0,
        totalMcqs: subjectChapterMap[subjectId]
          .map(chId => chapterMcqTotalMap[chId] || 0)
          .reduce((a, b) => a + b, 0),
        mcqsAttempted: 0,
        correctMcqs: 0,
        incorrectMcqs: 0,
        totalWatchTime: 0,
        totalTime: 0,
      };
    });

    // 6️⃣ Long Form Progress
    const longFormProgresses = await VideoProgress.find({ userId }).lean();
    for (const progress of longFormProgresses) {
      const chapterId = progress.chapterId?.toString();
      const subjectId = chapterSubjectMap[chapterId];
      if (!subjectId) continue;

      const stat = statsMap[subjectId];
      stat.totalVideos += 1;
      stat.videosWatched += progress.isWatched ? 1 : 0;

      stat.mcqsAttempted += progress.mcqsAttempted || 0;
      stat.correctMcqs += progress.correctMcqs || 0;
      stat.incorrectMcqs += (progress.mcqsAttempted || 0) - (progress.correctMcqs || 0);

      stat.totalWatchTime += progress.resumeTime || 0;
      stat.totalTime += progress.totalTime || 0;

      if (progress.isWatched) stat.completedChapters.add(chapterId);
    }

    // 7️⃣ Short Form Progress
    const shortFormProgresses = await ShortFormProgress.find({ userId }).lean();
    const shortFormIds = shortFormProgresses.map(p => p.shortFormId);
    const shortFormContents = await ShortFormContent.find({
      _id: { $in: shortFormIds },
    }).lean();

    const shortFormMap = {};
    shortFormContents.forEach(sf => {
      shortFormMap[sf._id.toString()] = sf;
    });

    for (const progress of shortFormProgresses) {
      const chapterId = progress.chapterId?.toString();
      const subjectId = chapterSubjectMap[chapterId];
      if (!subjectId) continue;

      const shortForm = shortFormMap[progress.shortFormId?.toString()];
      if (!shortForm) continue;

      const clips = shortForm.sequence.filter(s => s.type === "clip");
      const mcqs = shortForm.sequence.filter(s => s.type === "mcq");

      const watchedClips = new Set(progress.watchedClipIndexes || []).size;
      const attemptedMcqs = new Set(
        (progress.attemptedMcqIds || []).map(id => id.toString())
      ).size;

      const correct = progress.correctCount || 0;
      const incorrect = progress.incorrectCount || 0;

      const stat = statsMap[subjectId]; // ✅ FIX: declared stat here
      stat.totalVideos += clips.length;
      stat.videosWatched += watchedClips;

      stat.mcqsAttempted += attemptedMcqs;
      stat.correctMcqs += correct;
      stat.incorrectMcqs += incorrect;

      if (clips.length) {
        let totalClipDuration = 0;
        let watchedClipDuration = 0;
        clips.forEach((clip, idx) => {
          const dur = clip.duration || 0;
          totalClipDuration += dur;
          if (progress.watchedClipIndexes?.includes(idx)) {
            watchedClipDuration += dur;
          }
        });
        stat.totalWatchTime += watchedClipDuration;
        stat.totalTime += totalClipDuration;
      }

      const chapterCompleted =
        watchedClips >= clips.length && attemptedMcqs >= mcqs.length;
      if (chapterCompleted) stat.completedChapters.add(chapterId);
    }

    // 8️⃣ Build reports
    const subjectReports = [];
    let overallChaptersSet = new Set();
    let overallCompletedChaptersSet = new Set();
    let totalVideos = 0, videosWatched = 0, totalMcqs = 0, mcqsAttempted = 0, correctMcqs = 0, incorrectMcqs = 0;
    let totalWatchTime = 0, totalTime = 0;

    for (const stat of Object.values(statsMap)) {
      const totalChapters = stat.totalChapters.size;
      const completedChapters = stat.completedChapters.size;

      stat.totalChapters.forEach(ch => overallChaptersSet.add(ch));
      stat.completedChapters.forEach(ch => overallCompletedChaptersSet.add(ch));

      totalVideos += stat.totalVideos;
      videosWatched += stat.videosWatched;
      totalMcqs += stat.totalMcqs;
      mcqsAttempted += stat.mcqsAttempted;
      correctMcqs += stat.correctMcqs;
      incorrectMcqs += stat.incorrectMcqs;
      totalWatchTime += stat.totalWatchTime;
      totalTime += stat.totalTime;

      subjectReports.push({
        subjectId: stat.subjectId,
        subjectName: stat.subjectName,
        totalChapters,
        completedChapters,
        totalVideos: stat.totalVideos,
        videosWatched: stat.videosWatched,
        totalMcqs: stat.totalMcqs,
        mcqsAttempted: stat.mcqsAttempted,
        correctMcqs: stat.correctMcqs,
        incorrectMcqs: stat.incorrectMcqs,
        totalWatchTime: stat.totalWatchTime,
        totalTime: stat.totalTime,
        accuracyPercentage:
          stat.mcqsAttempted > 0
            ? Math.round((stat.correctMcqs / stat.mcqsAttempted) * 100)
            : 0,
        progressPercentage:
          totalChapters > 0
            ? Math.round((completedChapters / totalChapters) * 100)
            : 0,
      });
    }

    // 9️⃣ Overall summary
    const overallTotalChapters = overallChaptersSet.size;
    const overallCompletedChapters = overallCompletedChaptersSet.size;
    const courseCompletionPercentage =
      overallTotalChapters > 0
        ? Math.round((overallCompletedChapters / overallTotalChapters) * 100)
        : 0;
    const accuracyPercentage =
      mcqsAttempted > 0
        ? Math.round((correctMcqs / mcqsAttempted) * 100)
        : 0;

    return res.status(200).json({
      overall: {
        totalChapters: overallTotalChapters,
        completedChapters: overallCompletedChapters,
        courseCompletionPercentage,
        totalVideos,
        videosWatched,
        totalMcqs,
        mcqsAttempted,
        correctMcqs,
        incorrectMcqs,
        accuracyPercentage,
        totalWatchTime,
        totalTime,
      },
      subjects: subjectReports,
    });
  } catch (error) {
    console.error("❌ Error generating unified progress report:", error);
    return res.status(500).json({ message: "Internal server error", error: error.message });
  }
};
