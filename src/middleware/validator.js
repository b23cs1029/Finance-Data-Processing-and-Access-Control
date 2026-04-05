const { validationResult } = require('express-validator');
const AppError = require('../utils/AppError');

exports.validateRequest = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    // Format errors to a single string
    const extractedErrors = errors.array().map(err => err.msg);
    return next(new AppError(`Validation failed: ${extractedErrors.join('. ')}`, 400));
  }
  next();
};
