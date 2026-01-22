import mongoose from 'mongoose';
import Chapter from '../models/Chapter.js';
import LongFormatVideo from '../models/LongFormatVideo.js';
import MCQ from '../models/MCQ.js';
import Subject from '../models/Subject.js';
import ShortFormContent from '../models/ShortFormContent.js';
import MockTest from '../models/MockTest.js';
import Class from '../models/Class.js';

export const getChaptersBySubject = async (req, res) => {
  try {
    const { subjectId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(subjectId)) {
      return res.status(400).json({ message: 'Invalid subject ID' });
    }

    const subject = await Subject.findById(subjectId).select('name').lean();
    if (!subject) return res.status(404).json({ message: 'Subject not found' });

    const chapters = await Chapter.find({ subject: subjectId })
      .select('name shortContent longContent thumbnail')
      .lean();

    const chapterIds = chapters.map(ch => ch._id);
    const chapterNameMap = new Map(chapters.map(ch => [ch._id.toString(), ch.name]));

    const [mcqs, longFormatVideos, shortFormContents, subjectMockTests] = await Promise.all([
      MCQ.find({ chapter: { $in: chapterIds } }).lean(),
      LongFormatVideo.find({ chapterId: { $in: chapterIds } })
        .populate('timestamps.mcq', 'question options correctOption type questionImage')
        .lean(),
      ShortFormContent.find({ chapterId: { $in: chapterIds } }).lean(),
      MockTest.find({ subject: subjectId })
        .populate({ path: 'mcqs.mcqId', select: 'question options correctOption type questionImage' })
        .lean(),
    ]);

    const mcqMap = new Map(mcqs.map(mcq => [mcq._id.toString(), mcq]));

    const enrichedShortFormContents = shortFormContents.map(content => {
      const enrichedContent = { ...content };
      if (Array.isArray(content.sequence)) {
        enrichedContent.sequence = content.sequence.map(seq => {
          if (seq.type === 'mcq' && seq.mcqId) {
            return { ...seq, mcq: mcqMap.get(seq.mcqId.toString()) || null };
          }
          return seq;
        });
      }
      enrichedContent.chapterName = chapterNameMap.get(content.chapterId?.toString()) || null;
      return enrichedContent;
    });

    const enrichedChapters = chapters.map(chapter => {
      const chapterId = chapter._id.toString();
      return {
        _id: chapter._id,
        name: chapter.name,
        shortContent: chapter.shortContent || null,
        longContent: chapter.longContent || null,
        thumbnail: chapter.thumbnail || null,
        subject: { _id: subjectId, name: subject.name },
        mcqs: mcqs.filter(mcq => mcq.chapter?.toString() === chapterId),
        longFormatVideos: longFormatVideos.filter(video => video.chapterId?.toString() === chapterId),
        shortFormContents: enrichedShortFormContents.filter(content => content.chapterId?.toString() === chapterId),
      };
    });

    return res.status(200).json({
      subject: { _id: subjectId, name: subject.name },
      mockTests: subjectMockTests,
      chapters: enrichedChapters,
    });
  } catch (error) {
    console.error('Error fetching subject data:', error);
    return res.status(500).json({
      message: 'Server error while fetching subject data',
      error: error.message,
    });
  }
};

export const getSubjectsByClass = async (req, res) => {
  try {
    const { classId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(classId)) {
      return res.status(400).json({ message: 'Invalid class ID' });
    }

    const subjects = await Subject.find({ class: classId })
      .populate('class', 'name')
      .populate('mockTest')
      .lean();

    if (!subjects.length) {
      return res.status(404).json({ message: 'No subjects found for this class' });
    }

    res.status(200).json({ message: 'Subjects retrieved successfully', data: subjects });
  } catch (error) {
    console.error('Error fetching subjects:', error);
    res.status(500).json({ message: 'Server error while fetching subjects' });
  }
};


export const getClasses = async (req, res) => {
  try {
    const classes = await Class.find().lean();
    if (!classes.length) {
      return res.status(404).json({ message: 'No classes found' });
    }
    res.status(200).json({ message: 'Classes retrieved successfully', data: classes });
  } catch (error) {
    console.error('Error fetching classes:', error);
    res.status(500).json({ message: 'Server error while fetching classes' });
  }
};
