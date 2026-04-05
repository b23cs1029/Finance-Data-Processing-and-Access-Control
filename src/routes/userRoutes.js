const express = require('express');
const userController = require('../controllers/userController');
const authController = require('../middleware/auth');

const router = express.Router();

// All routes are protected and Admin-only
router.use(authController.protect);
router.use(authController.restrictTo('Admin'));

router.get('/', userController.getAllUsers);
router.patch('/:id/role', userController.updateUserRole);
router.patch('/:id/status', userController.toggleUserStatus);
router.delete('/:id', userController.deleteUser);

module.exports = router;
