const express = require('express');
const summaryController = require('../controllers/summaryController');
const authController = require('../middleware/auth');

const router = express.Router();

// Protect all summary routes
router.use(authController.protect);

// Viewers, Analysts, and Admins can all view dashboard summaries
router.get('/', authController.restrictTo('Viewer', 'Analyst', 'Admin'), summaryController.getSummary);

module.exports = router;
