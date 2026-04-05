const Record = require('../models/Record');
const catchAsync = require('../utils/catchAsync');

exports.getSummary = catchAsync(async (req, res, next) => {
  const matchStage = {}; // You could add filters here like by year/month

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

  // 3) Recent Activity (last 5 records)
  const recentActivity = await Record.find(matchStage)
    .sort('-date')
    .limit(5)
    .populate('createdBy', 'name');

  res.status(200).json({
    status: 'success',
    data: {
      totalIncome,
      totalExpense,
      netBalance,
      categories: {
        income: incomeCategories,
        expense: expenseCategories
      },
      recentActivity
    }
  });
});
