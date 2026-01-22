// middleware/ValidateOtp.js
const validateOTP = (req, res, next) => {
  const { otp } = req.body;
  if (otp === '1234') {
    next();
  } else {
    return res.status(400).json({ message: 'Invalid OTP' });
  }
};

export default validateOTP;