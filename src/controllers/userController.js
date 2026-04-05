const User = require('../models/User');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/AppError');

// Get all users in the same company (Admin only)
exports.getAllUsers = catchAsync(async (req, res, next) => {
  const users = await User.find({
    companyName: req.user.companyName
  }).select('+isActive');

  res.status(200).json({
    status: 'success',
    results: users.length,
    data: {
      users
    }
  });
});

// Update user role (Admin only)
exports.updateUserRole = catchAsync(async (req, res, next) => {
  const { role } = req.body;

  if (!role || !['Viewer', 'Analyst', 'Admin'].includes(role)) {
    return next(new AppError('Please provide a valid role (Viewer, Analyst, Admin)', 400));
  }

  const user = await User.findOne({
    _id: req.params.id,
    companyName: req.user.companyName
  });

  if (!user) {
    return next(new AppError('No user found with that ID in your company', 404));
  }

  // Prevent self-demotion
  if (user._id.toString() === req.user._id.toString()) {
    return next(new AppError('You cannot change your own role', 400));
  }

  user.role = role;
  await user.save({ validateModifiedOnly: true });

  res.status(200).json({
    status: 'success',
    data: {
      user
    }
  });
});

// Toggle user active status (Admin only)
exports.toggleUserStatus = catchAsync(async (req, res, next) => {
  const user = await User.findOne({
    _id: req.params.id,
    companyName: req.user.companyName
  }).select('+isActive');

  if (!user) {
    return next(new AppError('No user found with that ID in your company', 404));
  }

  // Prevent self-deactivation
  if (user._id.toString() === req.user._id.toString()) {
    return next(new AppError('You cannot deactivate yourself', 400));
  }

  user.isActive = !user.isActive;
  await user.save({ validateModifiedOnly: true });

  res.status(200).json({
    status: 'success',
    data: {
      user
    }
  });
});

// Delete user (Admin only)
exports.deleteUser = catchAsync(async (req, res, next) => {
  const user = await User.findOne({
    _id: req.params.id,
    companyName: req.user.companyName
  });

  if (!user) {
    return next(new AppError('No user found with that ID in your company', 404));
  }

  // Prevent self-deletion
  if (user._id.toString() === req.user._id.toString()) {
    return next(new AppError('You cannot delete yourself', 400));
  }

  await User.findByIdAndDelete(req.params.id);

  res.status(204).json({
    status: 'success',
    data: null
  });
});
