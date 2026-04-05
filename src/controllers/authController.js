const jwt = require('jsonwebtoken');
const User = require('../models/User');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/AppError');

const signToken = id => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN
  });
};

const createSendToken = (user, statusCode, res) => {
  const token = signToken(user._id);

  // Remove sensitive fields from output
  user.password = undefined;
  user.companyCode = undefined;

  res.status(statusCode).json({
    status: 'success',
    token,
    data: {
      user
    }
  });
};

exports.register = catchAsync(async (req, res, next) => {
  const { name, email, password, role, companyCode, companyName } = req.body;

  if (!companyCode) {
    return next(new AppError('Please provide a company code!', 400));
  }
  if (!companyName) {
    return next(new AppError('Please provide a company name!', 400));
  }

  const newUser = await User.create({
    name,
    email,
    password,
    role: role || 'Viewer',
    companyCode: companyCode.toUpperCase().trim(),
    companyName: companyName.trim()
  });

  createSendToken(newUser, 201, res);
});

exports.login = catchAsync(async (req, res, next) => {
  const { email, password, companyName } = req.body;

  // 1) Check if email, password, and companyName exist
  if (!email || !password || !companyName) {
    return next(new AppError('Please provide company name, email and password!', 400));
  }

  // 2) Check if user exists & password is correct (match by email + companyName)
  const user = await User.findOne({
    email,
    companyName: companyName.trim()
  }).select('+password +isActive');

  if (!user || !(await user.correctPassword(password, user.password))) {
    return next(new AppError('Incorrect company name, email or password', 401));
  }

  if (!user.isActive) {
    return next(new AppError('User is deactivated. Contact an administrator.', 403));
  }

  // 3) If everything ok, send token to client
  createSendToken(user, 200, res);
});
