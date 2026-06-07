import mongoose from 'mongoose';
import CareerSkill from '../models/CareerSkill.js';
import CareerPath from '../models/CareerPath.js';
import QuizAttempt from '../models/QuizAttempt.js';
import VideoProgress from '../models/VideoProgress.js';
import MockTestAttempt from '../models/MockTestAttempt.js';
import Student from '../models/Student.js';

const DEFAULT_SKILLS = [
  { name: 'Data Analysis', category: 'Technology', demandLevel: 'high', relatedSubjects: ['Mathematics', 'Statistics'], marketTrend: 'rising', growthRate: 28, salaryRange: 'PKR 80,000 - 200,000/month' },
  { name: 'Communication', category: 'Soft Skills', demandLevel: 'high', relatedSubjects: ['English'], marketTrend: 'stable', growthRate: 12, salaryRange: 'All roles' },
  { name: 'Problem Solving', category: 'Core', demandLevel: 'high', relatedSubjects: ['Mathematics', 'Physics'], marketTrend: 'rising', growthRate: 18, salaryRange: 'All roles' },
  { name: 'Programming', category: 'Technology', demandLevel: 'high', relatedSubjects: ['Computer Science', 'Mathematics'], marketTrend: 'rising', growthRate: 32, salaryRange: 'PKR 100,000 - 350,000/month' },
  { name: 'Scientific Reasoning', category: 'STEM', demandLevel: 'medium', relatedSubjects: ['Physics', 'Chemistry', 'Biology'], marketTrend: 'stable', growthRate: 10, salaryRange: 'PKR 60,000 - 150,000/month' },
];

const DEFAULT_PATHS = [
  { title: 'Software Engineer', description: 'Build applications and systems', industry: 'Technology', requiredSkills: ['Programming', 'Problem Solving'], recommendedCourses: ['Computer Science', 'Data Structures'], difficulty: 'intermediate', industryGrowth: 25, avgSalary: 'PKR 1.2M - 3.6M/year', icon: '💻' },
  { title: 'Data Scientist', description: 'Analyze data for insights', industry: 'Technology', requiredSkills: ['Data Analysis', 'Programming', 'Mathematics'], recommendedCourses: ['Statistics', 'Machine Learning'], difficulty: 'advanced', industryGrowth: 35, avgSalary: 'PKR 1.5M - 4.5M/year', icon: '📊' },
  { title: 'Medical Professional', description: 'Healthcare and patient care', industry: 'Healthcare', requiredSkills: ['Scientific Reasoning', 'Communication'], recommendedCourses: ['Biology', 'Chemistry'], difficulty: 'advanced', industryGrowth: 15, avgSalary: 'PKR 1M - 5M/year', icon: '🏥' },
  { title: 'Business Analyst', description: 'Bridge business and technology', industry: 'Business', requiredSkills: ['Data Analysis', 'Communication'], recommendedCourses: ['Economics', 'Mathematics'], difficulty: 'intermediate', industryGrowth: 20, avgSalary: 'PKR 0.9M - 2.4M/year', icon: '📈' },
  { title: 'Content Creator', description: 'Digital media and education', industry: 'Media', requiredSkills: ['Communication', 'Creativity'], recommendedCourses: ['English', 'Arts'], difficulty: 'beginner', industryGrowth: 22, avgSalary: 'PKR 0.5M - 1.8M/year', icon: '🎬' },
];

const PATH_SALARY_PKR = Object.fromEntries(DEFAULT_PATHS.map((p) => [p.title, p.avgSalary]));
const SKILL_SALARY_PKR = Object.fromEntries(
  DEFAULT_SKILLS.filter((s) => s.salaryRange?.startsWith('PKR')).map((s) => [s.name, s.salaryRange]),
);

const toPkrPathSalary = (path) => ({
  ...path,
  avgSalary:
    PATH_SALARY_PKR[path.title]
    || (/(LPA|₹)/i.test(path.avgSalary || '') ? 'PKR 1M - 3M/year' : path.avgSalary),
});

const toPkrSkillSalary = (skill) => ({
  ...skill,
  salaryRange:
    SKILL_SALARY_PKR[skill.name]
    || (/(LPA|₹)/i.test(skill.salaryRange || '') ? 'PKR 80,000 - 200,000/month' : skill.salaryRange),
});

const ensureSeedData = async () => {
  await Promise.all(
    DEFAULT_SKILLS.map((skill) =>
      CareerSkill.findOneAndUpdate({ name: skill.name }, { $set: skill }, { upsert: true }),
    ),
  );
  await Promise.all(
    DEFAULT_PATHS.map((path) =>
      CareerPath.findOneAndUpdate({ title: path.title }, { $set: path }, { upsert: true }),
    ),
  );

  const legacySkills = await CareerSkill.find({ salaryRange: { $regex: /LPA|₹/i } }).lean();
  await Promise.all(
    legacySkills.map((skill) =>
      CareerSkill.updateOne(
        { _id: skill._id },
        { $set: { salaryRange: SKILL_SALARY_PKR[skill.name] || 'PKR 80,000 - 200,000/month' } },
      ),
    ),
  );

  const legacyPaths = await CareerPath.find({ avgSalary: { $regex: /LPA|₹/i } }).lean();
  await Promise.all(
    legacyPaths.map((path) =>
      CareerPath.updateOne(
        { _id: path._id },
        { $set: { avgSalary: PATH_SALARY_PKR[path.title] || 'PKR 1M - 3M/year' } },
      ),
    ),
  );
};

const getMasteryLevel = (pct) => {
  if (pct >= 80) return 'advanced';
  if (pct >= 60) return 'intermediate';
  return 'beginner';
};

export const getPerformanceAnalysis = async (req, res) => {
  try {
    const { studentId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(studentId)) {
      return res.status(400).json({ success: false, message: 'Invalid student ID' });
    }

    const student = await Student.findById(studentId).lean();
    const userId = student?.userId;

    const [quizAttempts, videoProgress, mockAttempts] = await Promise.all([
      QuizAttempt.find({ studentId }).populate('quizId', 'subject topic difficulty').sort({ submittedAt: -1 }).limit(50),
      userId ? VideoProgress.find({ userId }).lean() : [],
      MockTestAttempt.find({ userId: userId || studentId }).lean(),
    ]);

    const quizAvg = quizAttempts.length
      ? quizAttempts.reduce((s, a) => s + a.percentage, 0) / quizAttempts.length
      : 0;
    const videoCompletion = videoProgress.length
      ? (videoProgress.filter((v) => v.isWatched).length / videoProgress.length) * 100
      : 0;
    const mockAvg = mockAttempts.length
      ? mockAttempts.reduce((s, a) => s + (a.percentage || 0), 0) / mockAttempts.length
      : 0;

    const subjectScores = {};
    quizAttempts.forEach((a) => {
      const subj = a.quizId?.subject || 'General';
      if (!subjectScores[subj]) subjectScores[subj] = { total: 0, count: 0 };
      subjectScores[subj].total += a.percentage;
      subjectScores[subj].count += 1;
    });

    const subjectBreakdown = Object.entries(subjectScores).map(([subject, data]) => ({
      subject,
      averageScore: Math.round(data.total / data.count),
      attempts: data.count,
    }));

    const overallScore = Math.round((quizAvg * 0.5 + videoCompletion * 0.25 + mockAvg * 0.25));

    return res.status(200).json({
      success: true,
      analysis: {
        overallScore,
        masteryLevel: getMasteryLevel(overallScore),
        quizAverage: Math.round(quizAvg),
        videoCompletion: Math.round(videoCompletion),
        mockTestAverage: Math.round(mockAvg),
        totalQuizAttempts: quizAttempts.length,
        totalVideosWatched: videoProgress.filter((v) => v.isWatched).length,
        totalMockAttempts: mockAttempts.length,
        subjectBreakdown,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const getPersonalizedSuggestions = async (req, res) => {
  try {
    await ensureSeedData();
    const { studentId } = req.params;

    const attempts = await QuizAttempt.find({ studentId })
      .populate('quizId', 'subject topic')
      .sort({ submittedAt: -1 })
      .limit(30);

    const skills = await CareerSkill.find({ isActive: true }).lean();
    const weakSubjects = new Set();
    attempts.filter((a) => a.percentage < 60).forEach((a) => {
      if (a.quizId?.subject) weakSubjects.add(a.quizId.subject);
    });

    const suggestions = skills
      .filter((skill) => skill.relatedSubjects.some((s) => !weakSubjects.has(s) || skill.demandLevel === 'high'))
      .slice(0, 6)
      .map((skill) => ({
        skill: skill.name,
        category: skill.category,
        reason: weakSubjects.size > 0
          ? `Strong demand skill — complements your ${Array.from(weakSubjects).slice(0, 2).join(', ')} focus areas`
          : 'High market demand skill aligned with your profile',
        demandLevel: skill.demandLevel,
        marketTrend: skill.marketTrend,
      }));

    return res.status(200).json({ success: true, suggestions });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const getCareerPathGuidance = async (req, res) => {
  try {
    await ensureSeedData();
    const { studentId } = req.params;

    const attempts = await QuizAttempt.find({ studentId }).populate('quizId', 'subject').limit(30);
    const avgScore = attempts.length
      ? attempts.reduce((s, a) => s + a.percentage, 0) / attempts.length
      : 50;

    const paths = await CareerPath.find({ isActive: true }).lean();
    const ranked = paths.map((path) => {
      let matchScore = 50;
      if (avgScore >= 75 && path.difficulty === 'advanced') matchScore += 25;
      else if (avgScore >= 55 && path.difficulty === 'intermediate') matchScore += 25;
      else if (avgScore < 55 && path.difficulty === 'beginner') matchScore += 25;
      matchScore += Math.min(path.industryGrowth / 2, 20);
      return toPkrPathSalary({ ...path, matchScore: Math.min(Math.round(matchScore), 99) });
    }).sort((a, b) => b.matchScore - a.matchScore);

    return res.status(200).json({ success: true, careerPaths: ranked.slice(0, 5) });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const getTeacherInsights = async (req, res) => {
  try {
    const { teacherId } = req.params;
    const teacherObjectId = new mongoose.Types.ObjectId(teacherId);

    const students = await Student.find({
      $or: [{ 'assignedTeachers.teacherId': teacherObjectId }, { taggedTeacher: teacherObjectId }],
    }).select('_id name className');

    const studentIds = students.map((s) => s._id);
    const attempts = await QuizAttempt.find({ studentId: { $in: studentIds } })
      .populate('quizId', 'subject topic')
      .sort({ submittedAt: -1 })
      .limit(100);

    const studentPerformance = students.map((student) => {
      const studentAttempts = attempts.filter((a) => a.studentId.toString() === student._id.toString());
      const avg = studentAttempts.length
        ? studentAttempts.reduce((s, a) => s + a.percentage, 0) / studentAttempts.length
        : 0;
      return {
        studentId: student._id,
        name: student.name,
        className: student.className,
        averageScore: Math.round(avg),
        attempts: studentAttempts.length,
        status: avg >= 70 ? 'on-track' : avg >= 50 ? 'needs-attention' : 'at-risk',
      };
    });

    const classAvg = studentPerformance.length
      ? Math.round(studentPerformance.reduce((s, p) => s + p.averageScore, 0) / studentPerformance.length)
      : 0;

    return res.status(200).json({
      success: true,
      insights: {
        totalStudents: students.length,
        classAverage: classAvg,
        atRiskCount: studentPerformance.filter((p) => p.status === 'at-risk').length,
        studentPerformance,
        recommendations: [
          'Schedule doubt sessions for at-risk students',
          'Assign easy-level quizzes for weak performers',
          'Share career guidance resources with high performers',
        ],
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const getMarketTrends = async (req, res) => {
  try {
    await ensureSeedData();
    const skills = await CareerSkill.find({ isActive: true }).sort({ growthRate: -1 }).lean();
    const paths = await CareerPath.find({ isActive: true }).sort({ industryGrowth: -1 }).lean();

    const trends = skills.map((skill) => {
      const normalized = toPkrSkillSalary(skill);
      return {
        name: normalized.name,
        category: normalized.category,
        demandLevel: normalized.demandLevel,
        marketTrend: normalized.marketTrend,
        growthRate: normalized.growthRate,
        salaryRange: normalized.salaryRange,
      };
    });

    const topCareers = paths.slice(0, 5).map((p) => {
      const normalized = toPkrPathSalary(p);
      return {
        title: normalized.title,
        industry: normalized.industry,
        growth: normalized.industryGrowth,
        avgSalary: normalized.avgSalary,
      };
    });

    return res.status(200).json({ success: true, trends, topCareers });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// Admin CRUD
export const getAllSkills = async (_req, res) => {
  await ensureSeedData();
  const skills = await CareerSkill.find().sort({ createdAt: -1 }).lean();
  res.json({ success: true, skills: skills.map(toPkrSkillSalary) });
};

export const createSkill = async (req, res) => {
  const skill = await CareerSkill.create(req.body);
  res.status(201).json({ success: true, skill });
};

export const updateSkill = async (req, res) => {
  const skill = await CareerSkill.findByIdAndUpdate(req.params.id, req.body, { new: true });
  res.json({ success: true, skill });
};

export const deleteSkill = async (req, res) => {
  await CareerSkill.findByIdAndDelete(req.params.id);
  res.json({ success: true, message: 'Skill deleted' });
};

export const getAllPaths = async (_req, res) => {
  await ensureSeedData();
  const paths = await CareerPath.find().sort({ createdAt: -1 }).lean();
  res.json({ success: true, paths: paths.map(toPkrPathSalary) });
};

export const createPath = async (req, res) => {
  const path = await CareerPath.create(req.body);
  res.status(201).json({ success: true, path });
};

export const updatePath = async (req, res) => {
  const path = await CareerPath.findByIdAndUpdate(req.params.id, req.body, { new: true });
  res.json({ success: true, path });
};

export const deletePath = async (req, res) => {
  await CareerPath.findByIdAndDelete(req.params.id);
  res.json({ success: true, message: 'Path deleted' });
};
