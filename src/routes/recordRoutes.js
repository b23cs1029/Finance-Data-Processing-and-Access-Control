const express = require('express');
const { body } = require('express-validator');
const recordController = require('../controllers/recordController');
const authController = require('../middleware/auth');
const { validateRequest } = require('../middleware/validator');

const router = express.Router();

// All routes after this middleware are protected
router.use(authController.protect);

// Analysts and Admins can read records
router.get('/', authController.restrictTo('Admin', 'Analyst'), recordController.getAllRecords);
router.get('/:id', authController.restrictTo('Admin', 'Analyst'), recordController.getRecord);

// Only Admins can modify/create records
router.use(authController.restrictTo('Admin'));

// Validation Rules
const recordValidationRules = [
  body('amount').isNumeric().withMessage('Amount must be a number'),
  body('type').isIn(['income', 'expense']).withMessage('Type must be either income or expense'),
  body('category').notEmpty().withMessage('Category is required')
];

router.post('/', recordValidationRules, validateRequest, recordController.createRecord);
router.patch('/:id', recordController.updateRecord);
router.delete('/:id', recordController.deleteRecord);

module.exports = router;
