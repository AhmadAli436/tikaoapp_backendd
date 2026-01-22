import TeacherEarning from "../models/TeacherEarning.js";
import Teacher from "../models/Teacher.js";
import Student from "../models/Student.js";
import mongoose from 'mongoose';

export const getAssignedStudents = async (req, res) => {
  try {
    const { teacherId } = req.query;

    if (!teacherId || !mongoose.Types.ObjectId.isValid(teacherId)) {
      return res.status(400).json({ message: 'Invalid or missing teacherId' });
    }

    // Find teacher and get student IDs
    const teacher = await Teacher.findById(teacherId).lean();
    if (!teacher) {
      return res.status(404).json({ message: 'Teacher not found' });
    }

    const studentIds = teacher.students || [];

    // Fetch detailed student info including assignedTeachers
    const students = await Student.find({
      _id: { $in: studentIds },
    })
      .select('name mobile email avatarUrl className boardName createdAt assignedTeachers')
      .lean();

    // Add relevant subjects for this teacher
    const studentsWithSubjects = students.map(student => {
      const subjectsForTeacher = (student.assignedTeachers || [])
        .filter(assign => assign.teacherId?.toString() === teacherId)
        .map(assign => assign.subjectName);

      return {
        ...student,
        subjects: subjectsForTeacher
      };
    });

    res.status(200).json({
      totalStudents: studentsWithSubjects.length,
      students: studentsWithSubjects,
    });
  } catch (error) {
    console.error('Error fetching assigned students:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};


export const getTeacherLastMonthEarnings = async (req, res) => {
  try {
    const { teacherId } = req.query;

    if (!teacherId || !mongoose.Types.ObjectId.isValid(teacherId)) {
      return res.status(400).json({ message: 'Invalid or missing teacherId' });
    }

    const now = new Date();
    const firstDayOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const firstDayOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastDayOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);

    const earnings = await TeacherEarning.aggregate([
      {
        $match: {
          teacher: new mongoose.Types.ObjectId(teacherId),
          date: {
            $gte: firstDayOfLastMonth,
            $lte: lastDayOfLastMonth
          }
        }
      },
      {
        $group: {
          _id: null,
          totalEarning: { $sum: '$totalEarning' },
          referralEarningAmount: { $sum: '$referralEarningAmount' },
          salesAssistAmount: { $sum: '$salesAssistAmount' },
          directSalesAmount: { $sum: '$directSalesAmount' },
          offlineDoubtClassAmount: { $sum: '$offlineDoubtClassAmount' },
        }
      }
    ]);

    const summary = earnings[0] || {
      totalEarning: 0,
      referralEarningAmount: 0,
      salesAssistAmount: 0,
      directSalesAmount: 0,
      offlineDoubtClassAmount: 0,
    };

    res.json({
      data: {
        month: `${firstDayOfLastMonth.toLocaleString('default', { month: 'long' })} ${firstDayOfLastMonth.getFullYear()}`,
        ...summary,
      }
    });
  } catch (error) {
    console.error('Error fetching last month earnings:', error);
    res.status(500).json({ message: 'Error fetching earnings' });
  }
};

export const getTeacherReferralCode = async (req, res) => {
  try {
    const { teacherId } = req.query;

    if (!teacherId || !mongoose.Types.ObjectId.isValid(teacherId)) {
      return res.status(400).json({ message: 'Invalid or missing teacherId' });
    }

    const teacher = await Teacher.findById(teacherId).select('referralCode').lean();

    if (!teacher) {
      return res.status(404).json({ message: 'Teacher not found' });
    }

    res.status(200).json({ referralCode: teacher.referralCode });
  } catch (error) {
    console.error('Error fetching referral code:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const getClasswiseCountByTeacher = async (req, res) => {
  try {
    const { teacherId } = req.query;

    if (!teacherId || !mongoose.Types.ObjectId.isValid(teacherId)) {
      return res.status(400).json({ message: 'Invalid or missing teacherId' });
    }

    // Get the teacher's student IDs
    const teacher = await Teacher.findById(teacherId).select('students').lean();
    if (!teacher) {
      return res.status(404).json({ message: 'Teacher not found' });
    }

    const studentIds = teacher.students;

    if (!studentIds || studentIds.length === 0) {
      return res.status(200).json({ data: [] }); // No students assigned
    }

    // Aggregate classwise count
    const result = await Student.aggregate([
      {
        $match: {
          _id: { $in: studentIds },
        },
      },
      {
        $group: {
          _id: '$className',
          count: { $sum: 1 },
        },
      },
      {
        $project: {
          className: '$_id',
          count: 1,
          _id: 0,
        },
      },
    ]);

    res.status(200).json({ data: result });
  } catch (error) {
    console.error('Error getting classwise count:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};