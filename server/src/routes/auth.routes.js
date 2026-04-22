const express = require('express');
const authController = require('../controllers/auth.controller');

const router = express.Router();

const { authMiddleware } = require('../middlewares/auth.middleware');

router.post('/register', authController.register);
router.post('/login', authController.login);
router.post('/change-password', authMiddleware, authController.changePassword);

module.exports = router;
