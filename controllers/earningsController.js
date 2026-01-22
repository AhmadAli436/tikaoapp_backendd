import TeacherEarning from '../models/TeacherEarning.js';
import Teacher from '../models/Teacher.js';
import archiver from 'archiver';
import { isValidObjectId } from 'mongoose';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { PassThrough } from 'stream';
import mongoose from 'mongoose';

export const getTeacherEarnings = async (req, res) => {
  try {
    const { month } = req.query;
    let earnings;

    if (month) {
      // Monthly view: Fetch earnings for the specified month
      const startDate = new Date(2025, month - 1, 1);
      const endDate = new Date(2025, month, 0);
      earnings = await TeacherEarning.find({
        date: { $gte: startDate, $lte: endDate },
      }).populate('teacher', 'name uid _id');
    } else {
      // View All: Aggregate earnings across all months by teacher
      earnings = await TeacherEarning.aggregate([
        {
          $lookup: {
            from: 'teachers',
            localField: 'teacher',
            foreignField: '_id',
            as: 'teacher',
          },
        },
        {
          $unwind: {
            path: '$teacher',
            preserveNullAndEmptyArrays: true,
          },
        },
        {
          $group: {
            _id: '$teacher._id', // Group by teacher ID
            uniqueId: { $first: '$teacher.uid' },
            teacherName: { $first: '$teacher.name' },
            totalEarning: { $sum: '$totalEarning' },
            referralEarningQty: { $sum: '$referralEarningQty' },
            referralEarningAmount: { $sum: '$referralEarningAmount' },
            salesAssistQty: { $sum: '$salesAssistQty' },
            salesAssistAmount: { $sum: '$salesAssistAmount' },
            directSalesQty: { $sum: '$directSalesQty' },
            directSalesAmount: { $sum: '$directSalesAmount' },
            offlineDoubtClassQty: { $sum: '$offlineDoubtClassQty' },
            offlineDoubtClassAmount: { $sum: '$offlineDoubtClassAmount' },
          },
        },
        {
          $project: {
            _id: '$_id',
            teacher: {
              _id: '$_id',
              uid: '$uniqueId',
              name: '$teacherName',
            },
            uniqueId: '$uniqueId',
            teacherName: '$teacherName',
            totalEarning: '$totalEarning',
            referralEarningQty: '$referralEarningQty',
            referralEarningAmount: '$referralEarningAmount',
            salesAssistQty: '$salesAssistQty',
            salesAssistAmount: '$salesAssistAmount',
            directSalesQty: '$directSalesQty',
            directSalesAmount: '$directSalesAmount',
            offlineDoubtClassQty: '$offlineDoubtClassQty',
            offlineDoubtClassAmount: '$offlineDoubtClassAmount',
          },
        },
      ]);
    }

    res.json({ data: earnings });
  } catch (error) {
    console.error('Error fetching earnings:', error);
    res.status(500).json({ message: 'Error fetching earnings' });
  }
};

export const getTeachers = async (req, res) => {
  try {
    const teachers = await Teacher.find({}, 'name uid _id');
    res.json({ data: teachers });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching teachers' });
  }
};

export const uploadEarnings = async (req, res) => {
  try {
    const { earnings } = req.body;
    const teachers = await Teacher.find({ uid: { $in: earnings.map(e => e.uniqueId) } });

    const earningsData = earnings.map(earning => {
      const teacher = teachers.find(t => t.uid === earning.uniqueId);
      const date = new Date(earning.date);
      const year = date.getFullYear();
      const month = date.getMonth() + 1;

      return {
        uniqueId: earning.uniqueId,
        date: date,
        year: year,
        month: month,
        teacherName: earning.teacherName,
        referralEarningQty: earning.referralEarningQty,
        referralEarningAmount: earning.referralEarningAmount,
        salesAssistQty: earning.salesAssistQty,
        salesAssistAmount: earning.salesAssistAmount,
        directSalesQty: earning.directSalesQty,
        directSalesAmount: earning.directSalesAmount,
        offlineDoubtClassQty: earning.offlineDoubtClassQty,
        offlineDoubtClassAmount: earning.offlineDoubtClassAmount,
        totalEarning: earning.totalEarning,
        teacher: teacher?._id,
      };
    });

    // Process each earning entry
    for (const earning of earningsData) {
      const existingEarning = await TeacherEarning.findOne({
        teacher: earning.teacher,
        year: earning.year,
        month: earning.month,
      });

      if (existingEarning) {
        // Update existing record for the same teacher and month
        await TeacherEarning.updateOne(
          { _id: existingEarning._id },
          {
            $set: {
              referralEarningQty: earning.referralEarningQty,
              referralEarningAmount: earning.referralEarningAmount,
              salesAssistQty: earning.salesAssistQty,
              salesAssistAmount: earning.salesAssistAmount,
              directSalesQty: earning.directSalesQty,
              directSalesAmount: earning.directSalesAmount,
              offlineDoubtClassQty: earning.offlineDoubtClassQty,
              offlineDoubtClassAmount: earning.offlineDoubtClassAmount,
              totalEarning: earning.totalEarning,
              date: earning.date,
              uniqueId: earning.uniqueId,
              teacherName: earning.teacherName,
            },
          }
        );
      } else {
        // Insert new record for a different month
        await TeacherEarning.create(earning);
      }
    }

    res.status(201).json({ message: 'Earnings processed successfully' });
  } catch (error) {
    console.error('Error uploading earnings:', error);
    res.status(500).json({ message: 'Error uploading earnings' });
  }
};

export const deleteEarning = async (req, res) => {
  try {
    const { id } = req.params;
    await TeacherEarning.findByIdAndDelete(id);
    res.json({ message: 'Earning deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting earning' });
  }
};

export const downloadReports = async (req, res) => {
  try {
    const { earningIds, month } = req.body;

    if (!Array.isArray(earningIds) || earningIds.length === 0) {
      return res.status(400).json({ success: false, message: 'Earning IDs must be a non-empty array.' });
    }

    if (!earningIds.every(id => isValidObjectId(id))) {
      return res.status(400).json({ success: false, message: 'Invalid earning ID format.' });
    }

    let earnings;
    if (month) {
      // Monthly view: Fetch earnings for the specified month
      const startDate = new Date(2025, month - 1, 1);
      const endDate = new Date(2025, month, 0);
      earnings = await TeacherEarning.find({
        _id: { $in: earningIds },
        date: { $gte: startDate, $lte: endDate },
      }).populate('teacher', 'uid name').lean();
    } else {
      // View All: Fetch earnings by IDs and aggregate if necessary
      earnings = await TeacherEarning.find({ _id: { $in: earningIds } })
        .populate('teacher', 'uid name')
        .lean();
    }

    if (earnings.length === 0) {
      return res.status(404).json({ success: false, message: 'No earnings found.' });
    }

    const archive = archiver('zip', { zlib: { level: 9 } });
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename=teacher_reports_${month ? `month_${month}` : 'all'}.zip`);
    archive.pipe(res);

    for (const earning of earnings) {
      const teacherName = earning.teacher?.name || earning.teacherName || 'Unknown';
      const teacherUid = earning.teacher?.uid || earning.uniqueId || 'N/A';
      const date = earning.date ? earning.date.toISOString().split('T')[0] : 'N/A';

      const referralTotal = earning.referralEarningQty * earning.referralEarningAmount;
      const salesAssistTotal = earning.salesAssistQty * earning.salesAssistAmount;
      const directSalesTotal = earning.directSalesQty * earning.directSalesAmount;
      const offlineDoubtClassTotal = earning.offlineDoubtClassQty * earning.offlineDoubtClassAmount;
      const grandTotal = referralTotal + salesAssistTotal + directSalesTotal + offlineDoubtClassTotal;

      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage([595.28, 841.89]); // A4 size
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

      const title = month
        ? `Instaowl Teacher Report - Month ${month}`
        : 'Instaowl Teacher Report - All Time';
      page.drawText(title, {
        x: 150,
        y: 800,
        size: 18,
        font: boldFont,
        color: rgb(0.2, 0.4, 0.8),
      });

      let y = 760;
      const lineHeight = 20;

      const drawRow = (label, value, isHeader = false) => {
        page.drawText(label, {
          x: 50,
          y,
          size: 11,
          font: isHeader ? boldFont : font,
        });
        page.drawText(value, {
          x: 300,
          y,
          size: 11,
          font: isHeader ? boldFont : font,
        });
        y -= lineHeight;
      };

      drawRow('Teacher Name:', teacherName);
      drawRow('UID:', teacherUid);
      if (month) drawRow('Date:', date);

      y -= 20;
      drawRow('Category', 'Qty | Rate | Total', true);

      const rowData = [
        ['Referral', earning.referralEarningQty, earning.referralEarningAmount, referralTotal],
        ['Sales Assist', earning.salesAssistQty, earning.salesAssistAmount, salesAssistTotal],
        ['Direct Sales', earning.directSalesQty, earning.directSalesAmount, directSalesTotal],
        ['Offline Doubt Class', earning.offlineDoubtClassQty, earning.offlineDoubtClassAmount, offlineDoubtClassTotal]
      ];

      for (const [label, qty, rate, total] of rowData) {
        drawRow(label, `${qty} x INR ${rate.toFixed(2)} = INR ${total.toFixed(2)}`);
      }

      y -= 20;
      drawRow('Grand Total:', `INR ${grandTotal.toFixed(2)}`, true);

      const pdfBytes = await pdfDoc.save();

      archive.append(Buffer.from(pdfBytes), {
        name: `report_${teacherUid}_${month ? `month_${month}` : 'all'}_${earning._id}.pdf`
      });
    }

    await archive.finalize();
  } catch (error) {
    console.error('PDF generation failed:', error);
    if (!res.headersSent) {
      res.status(500).json({ success: false, message: 'PDF generation error', error: error.message });
    }
  }
};
//get single teacher earning
export const getTeacherEarning = async (req, res) => {
  try {
    const { month, teacherId } = req.query;
    let earnings;

    // Build base match filter
    const matchFilter = {};
    if (teacherId && mongoose.Types.ObjectId.isValid(teacherId)) {
      matchFilter.teacher = new mongoose.Types.ObjectId(teacherId);
    }

    if (month) {
      // Monthly view: Fetch earnings for the specified month & teacher
      const startDate = new Date(2025, month - 1, 1);
      const endDate = new Date(2025, month, 0);

      matchFilter.date = { $gte: startDate, $lte: endDate };

      earnings = await TeacherEarning.find(matchFilter)
        .populate('teacher', 'name uid _id')
        .lean();
    } else {
      // View All: Aggregate earnings across all months, optionally filtered by teacher
      const pipeline = [];

      if (Object.keys(matchFilter).length) {
        pipeline.push({ $match: matchFilter });
      }

      pipeline.push(
        {
          $lookup: {
            from: 'teachers',
            localField: 'teacher',
            foreignField: '_id',
            as: 'teacher',
          },
        },
        { $unwind: { path: '$teacher', preserveNullAndEmptyArrays: true } },
        {
          $group: {
            _id: '$teacher._id', // Group by teacher ID
            uniqueId: { $first: '$teacher.uid' },
            teacherName: { $first: '$teacher.name' },
            totalEarning: { $sum: '$totalEarning' },
            referralEarningQty: { $sum: '$referralEarningQty' },
            referralEarningAmount: { $sum: '$referralEarningAmount' },
            salesAssistQty: { $sum: '$salesAssistQty' },
            salesAssistAmount: { $sum: '$salesAssistAmount' },
            directSalesQty: { $sum: '$directSalesQty' },
            directSalesAmount: { $sum: '$directSalesAmount' },
            offlineDoubtClassQty: { $sum: '$offlineDoubtClassQty' },
            offlineDoubtClassAmount: { $sum: '$offlineDoubtClassAmount' },
          },
        },
        {
          $project: {
            _id: 1,
            teacher: {
              _id: '$_id',
              uid: '$uniqueId',
              name: '$teacherName',
            },
            totalEarning: 1,
            referralEarningQty: 1,
            referralEarningAmount: 1,
            salesAssistQty: 1,
            salesAssistAmount: 1,
            directSalesQty: 1,
            directSalesAmount: 1,
            offlineDoubtClassQty: 1,
            offlineDoubtClassAmount: 1,
          },
        }
      );

      earnings = await TeacherEarning.aggregate(pipeline);
    }

    res.json({ data: earnings });
  } catch (error) {
    console.error('Error fetching earnings:', error);
    res.status(500).json({ message: 'Error fetching earnings' });
  }
};

