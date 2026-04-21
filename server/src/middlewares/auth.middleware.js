const jwt = require('jsonwebtoken');
const { getGlobalDb } = require('../models/db');
const logger = require('../utils/logger');

const JWT_SECRET = process.env.JWT_SECRET || 'assetaura_offline_secret_key_99'; // Safe fallback for offline local app

const authMiddleware = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: No token provided' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    
    // Verify user still exists in DB
    const globalDb = getGlobalDb();
    const user = globalDb.prepare('SELECT id, username FROM users WHERE id = ?').get(decoded.id);

    if (!user) {
      return res.status(401).json({ error: 'Unauthorized: User no longer exists' });
    }

    // Inject user into request
    req.user = user;
    next();
  } catch (err) {
    logger.warn(`[Auth] Invalid token provided: ${err.message}`);
    return res.status(401).json({ error: 'Unauthorized: Invalid or expired token' });
  }
};

module.exports = {
  authMiddleware,
  JWT_SECRET
};
