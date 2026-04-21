const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const portfolioRoutes = require('./routes/portfolio.routes');
const requestLogger = require('./middlewares/requestLogger');
const logger = require('./utils/logger');
const errorHandler = require('./middlewares/errorHandler');

// Initialize environment variables if present
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());
app.use(requestLogger);

const authRoutes = require('./routes/auth.routes');
const { authMiddleware } = require('./middlewares/auth.middleware');

// Routes
// Public Auth Routes
app.use('/api/auth', authRoutes);

// Protected Portfolio Routes
app.use('/api', authMiddleware, portfolioRoutes);

app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
});

app.use(errorHandler);

// Start server
app.listen(PORT, () => {
    logger.info(`Server running on port ${PORT}`);
});
