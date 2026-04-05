const Record = require('../models/Record');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/AppError');

// Create a Record (Admin, Analyst sometimes? requirement says Admin can create. Analyst read only? 
// Original Spec: "An admin may be allowed full management access. An analyst may be allowed to read records and access summaries. A viewer should not be able to create or modify records."
// Therefore, only Admin creates records. Analyst or Viewer only read.)

exports.createRecord = catchAsync(async (req, res, next) => {
  const newRecord = await Record.create({
    amount: req.body.amount,
    type: req.body.type,
    category: req.body.category,
    date: req.body.date || Date.now(),
    notes: req.body.notes,
    createdBy: req.user.id
  });

  res.status(201).json({
    status: 'success',
    data: {
      record: newRecord
    }
  });
});

exports.getAllRecords = catchAsync(async (req, res, next) => {
  // Filtering
  const queryObj = { ...req.query };
  const excludedFields = ['page', 'sort', 'limit', 'fields'];
  excludedFields.forEach(el => delete queryObj[el]);

  // Advanced Filtering (e.g., date[gte]=2023-01-01)
  let queryStr = JSON.stringify(queryObj);
  queryStr = queryStr.replace(/\b(gte|gt|lte|lt)\b/g, match => `$${match}`);

  let query = Record.find(JSON.parse(queryStr)).populate('createdBy', 'name email');

  // Sorting
  if (req.query.sort) {
    const sortBy = req.query.sort.split(',').join(' ');
    query = query.sort(sortBy);
  } else {
    query = query.sort('-date');
  }

  // Pagination
  const page = req.query.page * 1 || 1;
  const limit = req.query.limit * 1 || 100;
  const skip = (page - 1) * limit;
  query = query.skip(skip).limit(limit);

  const records = await query;

  res.status(200).json({
    status: 'success',
    results: records.length,
    data: {
      records
    }
  });
});

exports.getRecord = catchAsync(async (req, res, next) => {
  const record = await Record.findById(req.params.id).populate('createdBy', 'name email');

  if (!record) {
    return next(new AppError('No record found with that ID', 404));
  }

  res.status(200).json({
    status: 'success',
    data: {
      record
    }
  });
});

exports.updateRecord = catchAsync(async (req, res, next) => {
  const record = await Record.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true
  });

  if (!record) {
    return next(new AppError('No record found with that ID', 404));
  }

  res.status(200).json({
    status: 'success',
    data: {
      record
    }
  });
});

exports.deleteRecord = catchAsync(async (req, res, next) => {
  const record = await Record.findByIdAndDelete(req.params.id);

  if (!record) {
    return next(new AppError('No record found with that ID', 404));
  }

  res.status(204).json({
    status: 'success',
    data: null
  });
});
