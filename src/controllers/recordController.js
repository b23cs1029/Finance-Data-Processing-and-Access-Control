const Record = require('../models/Record');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/AppError');

// Create a Record (Admin only)
exports.createRecord = catchAsync(async (req, res, next) => {
  const newRecord = await Record.create({
    amount: req.body.amount,
    type: req.body.type,
    category: req.body.category,
    date: req.body.date || Date.now(),
    notes: req.body.notes,
    createdBy: req.user.id,
    companyName: req.user.companyName
  });

  res.status(201).json({
    status: 'success',
    data: {
      record: newRecord
    }
  });
});

// Get all records (scoped to company, with filtering & pagination)
exports.getAllRecords = catchAsync(async (req, res, next) => {
  // Base filter: same company, not deleted
  const filter = {
    companyName: req.user.companyName,
    isDeleted: { $ne: true }
  };

  // Optional filters
  if (req.query.type && ['income', 'expense'].includes(req.query.type)) {
    filter.type = req.query.type;
  }
  if (req.query.category) {
    filter.category = { $regex: req.query.category, $options: 'i' };
  }
  if (req.query.dateFrom || req.query.dateTo) {
    filter.date = {};
    if (req.query.dateFrom) filter.date.$gte = new Date(req.query.dateFrom);
    if (req.query.dateTo) filter.date.$lte = new Date(req.query.dateTo);
  }

  // Sorting
  const sortBy = req.query.sort || '-date';

  // Pagination
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 10));
  const skip = (page - 1) * limit;

  // Get total count for pagination metadata
  const total = await Record.countDocuments(filter);
  const totalPages = Math.ceil(total / limit);

  const records = await Record.find(filter)
    .populate('createdBy', 'name email')
    .sort(sortBy)
    .skip(skip)
    .limit(limit);

  res.status(200).json({
    status: 'success',
    results: records.length,
    data: {
      records,
      pagination: {
        page,
        limit,
        total,
        totalPages
      }
    }
  });
});

// Get single record
exports.getRecord = catchAsync(async (req, res, next) => {
  const record = await Record.findOne({
    _id: req.params.id,
    companyName: req.user.companyName,
    isDeleted: { $ne: true }
  }).populate('createdBy', 'name email');

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

// Update record (Admin only)
exports.updateRecord = catchAsync(async (req, res, next) => {
  // Only allow updating specific fields
  const allowedFields = ['amount', 'type', 'category', 'date', 'notes'];
  const updateData = {};
  allowedFields.forEach(field => {
    if (req.body[field] !== undefined) updateData[field] = req.body[field];
  });

  const record = await Record.findOneAndUpdate(
    {
      _id: req.params.id,
      companyName: req.user.companyName,
      isDeleted: { $ne: true }
    },
    updateData,
    { new: true, runValidators: true }
  );

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

// Soft delete record (Admin only)
exports.deleteRecord = catchAsync(async (req, res, next) => {
  const record = await Record.findOneAndUpdate(
    {
      _id: req.params.id,
      companyName: req.user.companyName,
      isDeleted: { $ne: true }
    },
    { isDeleted: true },
    { new: true }
  );

  if (!record) {
    return next(new AppError('No record found with that ID', 404));
  }

  res.status(200).json({
    status: 'success',
    message: 'Record deleted successfully'
  });
});
