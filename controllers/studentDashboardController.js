import mongoose from 'mongoose';
import Student from '../models/Student.js';
import Teacher from '../models/Teacher.js';

export const getSubjectsWithTeachersByStudent = async (req, res) => {
  try {
    const { studentId } = req.query;

    if (!studentId || !mongoose.Types.ObjectId.isValid(studentId)) {
      return res.status(400).json({ message: 'Invalid or missing studentId' });
    }

    // Fetch the student with assigned teachers populated
    const student = await Student.findById(studentId).lean();

    if (!student) {
      return res.status(404).json({ message: 'Student not found' });
    }

    const assigned = student.assignedTeachers || [];

    // If empty
    if (assigned.length === 0) {
      return res.status(200).json({ subjects: [] });
    }

    // Get all teacherIds in assignedTeachers
    const teacherIds = assigned.map(item => item.teacherId);

    // Fetch teacher names in one go
    const teachersMap = await Teacher.find({ _id: { $in: teacherIds } })
  .select('_id name avatarUrl')
  .lean()
  .then(teachers =>
    teachers.reduce((acc, t) => {
      acc[t._id.toString()] = {
        name: t.name,
        avatarUrl: t.avatarUrl || '',
      };
      return acc;
    }, {})
  );


    // Merge teacher name with subject data
    const result = assigned.map(entry => ({
      subjectId: entry.subjectId,
      subjectName: entry.subjectName,
      teacherId: entry.teacherId,
      teacherName: teachersMap[entry.teacherId?.toString()] || 'Unknown',
      teacherAvatarUrl: teachersMap[entry.teacherId?.toString()]?.avatarUrl || '',
    }));

    res.status(200).json({ subjects: result });
  } catch (error) {
    console.error('Error getting subject-teacher list:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};
