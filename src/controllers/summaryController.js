const Record = require('../models/Record');
const catchAsync = require('../utils/catchAsync');

// Main dashboard summary (company-scoped, role-aware)
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

  // Viewer gets only the basics
  if (req.user.role === 'Viewer') {
    return res.status(200).json({
      status: 'success',
      data: {
        totalIncome,
        totalExpense,
        netBalance
      }
    });
  }

  // 2) Category-wise totals (Analyst + Admin)
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

// ============================================
// ANALYTICS (Analyst + Admin only)
// ============================================
exports.getAnalytics = catchAsync(async (req, res, next) => {
  const now = new Date();
  const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);

  const companyMatch = {
    companyName: req.user.companyName,
    isDeleted: { $ne: true }
  };

  const recentMatch = {
    ...companyMatch,
    date: { $gte: sixMonthsAgo }
  };

  // ---- 1) Monthly breakdown (income + expense per month) ----
  const monthlyRaw = await Record.aggregate([
    { $match: recentMatch },
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
    { $sort: { '_id.year': 1, '_id.month': 1 } }
  ]);

  // Build 6-month structure with profit & margin
  const monthlyData = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const year = d.getFullYear();
    const month = d.getMonth() + 1;
    const label = d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });

    const inc = monthlyRaw.find(t => t._id.year === year && t._id.month === month && t._id.type === 'income');
    const exp = monthlyRaw.find(t => t._id.year === year && t._id.month === month && t._id.type === 'expense');

    const income = inc ? inc.totalAmount : 0;
    const expense = exp ? exp.totalAmount : 0;
    const profit = income - expense;
    const margin = income > 0 ? Math.round((profit / income) * 10000) / 100 : 0;

    monthlyData.push({ label, year, month, income, expense, profit, margin });
  }

  // ---- 2) Expense mean trend (cumulative rolling average) ----
  const expenseValues = monthlyData.map(m => m.expense);
  const meanTrend = [];
  let runningSum = 0;
  for (let i = 0; i < expenseValues.length; i++) {
    runningSum += expenseValues[i];
    meanTrend.push(Math.round((runningSum / (i + 1)) * 100) / 100);
  }

  // ---- 3) Statistical measures on ALL expense amounts ----
  const allExpenses = await Record.find({
    ...companyMatch,
    type: 'expense'
  }).select('amount').lean();

  const amounts = allExpenses.map(r => r.amount).sort((a, b) => a - b);
  const n = amounts.length;

  let mean = 0;
  let median = 0;
  let mode = 0;
  let variability = 0; // standard deviation

  if (n > 0) {
    // Mean
    const sum = amounts.reduce((acc, v) => acc + v, 0);
    mean = Math.round((sum / n) * 100) / 100;

    // Median
    if (n % 2 === 0) {
      median = Math.round(((amounts[n / 2 - 1] + amounts[n / 2]) / 2) * 100) / 100;
    } else {
      median = amounts[Math.floor(n / 2)];
    }

    // Mode (most frequent amount)
    const freq = {};
    let maxFreq = 0;
    amounts.forEach(a => {
      freq[a] = (freq[a] || 0) + 1;
      if (freq[a] > maxFreq) {
        maxFreq = freq[a];
        mode = a;
      }
    });
    // If every value appears once, mode is 0 (no mode)
    if (maxFreq === 1) mode = 0;

    // Standard Deviation (population)
    const squaredDiffs = amounts.map(a => Math.pow(a - mean, 2));
    const avgSquaredDiff = squaredDiffs.reduce((acc, v) => acc + v, 0) / n;
    variability = Math.round(Math.sqrt(avgSquaredDiff) * 100) / 100;
  }

  res.status(200).json({
    status: 'success',
    data: {
      monthly: monthlyData,
      meanTrend,
      statistics: {
        mean,
        median,
        mode,
        variability,
        sampleSize: n
      }
    }
  });
});
