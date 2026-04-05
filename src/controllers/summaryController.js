const Record = require('../models/Record');
const catchAsync = require('../utils/catchAsync');

// Main dashboard summary (company-scoped)
exports.getSummary = catchAsync(async (req, res, next) => {
  const matchStage = {
    companyName: req.user.companyName,
    isDeleted: { $ne: true }
  };

  // 1) Total Income & total Expenses
  const totals = await Record.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: '$type',
        totalAmount: { $sum: '$amount' }
      }
    }
  ]);

  let totalIncome = 0;
  let totalExpense = 0;

  totals.forEach(t => {
    if (t._id === 'income') totalIncome = t.totalAmount;
    if (t._id === 'expense') totalExpense = t.totalAmount;
  });

  const netBalance = totalIncome - totalExpense;

  // 2) Category-wise totals
  const categoryTotals = await Record.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: { type: '$type', category: '$category' },
        totalAmount: { $sum: '$amount' }
      }
    },
    { $sort: { totalAmount: -1 } }
  ]);

  const incomeCategories = categoryTotals.filter(c => c._id.type === 'income');
  const expenseCategories = categoryTotals.filter(c => c._id.type === 'expense');

  // 3) Recent Activity (last 10 records)
  const recentActivity = await Record.find(matchStage)
    .sort('-date')
    .limit(10)
    .populate('createdBy', 'name');

  // 4) Record counts
  const totalRecords = await Record.countDocuments(matchStage);

  res.status(200).json({
    status: 'success',
    data: {
      totalIncome,
      totalExpense,
      netBalance,
      totalRecords,
      categories: {
        income: incomeCategories,
        expense: expenseCategories
      },
      recentActivity
    }
  });
});

// Monthly trends (last 6 months, company-scoped)
exports.getMonthlyTrends = catchAsync(async (req, res, next) => {
  const now = new Date();
  const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);

  const matchStage = {
    companyName: req.user.companyName,
    isDeleted: { $ne: true },
    date: { $gte: sixMonthsAgo }
  };

  const trends = await Record.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: {
          year: { $year: '$date' },
          month: { $month: '$date' },
          type: '$type'
        },
        totalAmount: { $sum: '$amount' }
      }
    },
    {
      $sort: { '_id.year': 1, '_id.month': 1 }
    }
  ]);

  // Build a clean 6-month structure
  const months = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const year = d.getFullYear();
    const month = d.getMonth() + 1;
    const label = d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });

    const incomeEntry = trends.find(t => t._id.year === year && t._id.month === month && t._id.type === 'income');
    const expenseEntry = trends.find(t => t._id.year === year && t._id.month === month && t._id.type === 'expense');

    months.push({
      label,
      year,
      month,
      income: incomeEntry ? incomeEntry.totalAmount : 0,
      expense: expenseEntry ? expenseEntry.totalAmount : 0
    });
  }

  res.status(200).json({
    status: 'success',
    data: {
      trends: months
    }
  });
});
