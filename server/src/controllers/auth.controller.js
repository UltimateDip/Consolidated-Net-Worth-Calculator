const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { getGlobalDb, getUserDb } = require('../models/db');
const asyncHandler = require('../utils/asyncHandler');
const { JWT_SECRET } = require('../middlewares/auth.middleware');
const logger = require('../utils/logger');

class AuthController {

  // POST /api/auth/register
  register = asyncHandler(async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    if (username.length < 3) {
      return res.status(400).json({ error: 'Username must be at least 3 characters' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    const globalDb = getGlobalDb();

    // Check if user already exists
    const existingUser = globalDb.prepare('SELECT id FROM users WHERE username = ?').get(username);
    if (existingUser) {
      return res.status(409).json({ error: 'Username already taken' });
    }

    // Hash password & save
    const hash = await bcrypt.hash(password, 10);
    const result = globalDb.prepare('INSERT INTO users (username, password_hash) VALUES (?, ?)').run(username, hash);

    logger.info(`[Auth] Registered new user: ${username}`);

    // Pre-initialize their tenant databases
    getUserDb(username);

    // Generate Token (2 hours)
    const token = jwt.sign({ id: result.lastInsertRowid, username }, JWT_SECRET, { expiresIn: '2h' });

    res.json({
      success: true,
      token,
      user: { id: result.lastInsertRowid, username }
    });
  });

  // POST /api/auth/login
  login = asyncHandler(async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    const globalDb = getGlobalDb();
    const user = globalDb.prepare('SELECT * FROM users WHERE username = ?').get(username);

    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    logger.info(`[Auth] User logged in: ${username}`);

    // Ensure tenant DB exists (just in case)
    getUserDb(username);

    // Generate token (2 hours)
    const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '2h' });

    res.json({
      success: true,
      token,
      user: { id: user.id, username: user.username }
    });
  });

  // POST /api/auth/change-password
  changePassword = asyncHandler(async (req, res) => {
    const { currentPassword, newPassword } = req.body;
    const username = req.user.username; // Provided by authMiddleware

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Current and new passwords are required' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'New password must be at least 6 characters' });
    }

    const globalDb = getGlobalDb();
    const user = globalDb.prepare('SELECT * FROM users WHERE username = ?').get(username);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const isMatch = await bcrypt.compare(currentPassword, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    const hash = await bcrypt.hash(newPassword, 10);
    globalDb.prepare('UPDATE users SET password_hash = ? WHERE username = ?').run(hash, username);

    logger.info(`[Auth] User changed password: ${username}`);
    res.json({ success: true, message: 'Password updated successfully' });
  });

}

module.exports = new AuthController();
