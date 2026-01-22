
import Student from '../models/Student.js';
import Teacher from '../models/Teacher.js';

export const verifyReferralCode = async (req, res) => {
  try {
    const { studentId, referralCode } = req.body;

    if (!referralCode || !studentId) {
      return res.status(400).json({ message: 'studentId and referralCode are required' });
    }

    const teacher = await Teacher.findOne({ referralCode });

    if (!teacher) {
      return res.status(404).json({ message: 'Invalid referral code' });
    }

    const student = await Student.findByIdAndUpdate(
      studentId,
      { 
        taggedTeacher: teacher._id,
        affiliatedReferralCode: referralCode // Save referral code
      },
      { new: true }
    );

    return res.status(200).json({
      message: 'Referral code verified and teacher tagged successfully',
      teacherId: teacher._id,
      studentId: student._id,
    });

  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Server error', details: error.message });
  }
};


