const express = require('express');
const summaryController = require('../controllers/summaryController');
const authController = require('../middleware/auth');

const router = express.Router();

// Protect all summary routes
router.use(authController.protect);

// Viewers, Analysts, and Admins can all view dashboard summaries
router.get('/', authController.restrictTo('Viewer', 'Analyst', 'Admin'), summaryController.getSummary);
router.get('/trends', authController.restrictTo('Analyst', 'Admin'), summaryController.getMonthlyTrends);

// Analytics — Analyst + Admin only
router.get('/analytics', authController.restrictTo('Analyst', 'Admin'), summaryController.getAnalytics);

module.exports = router;
