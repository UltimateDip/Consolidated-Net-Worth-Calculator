const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const portfolioRoutes = require('./routes/portfolio.routes');
const errorHandler = require('./middlewares/errorHandler');

// Initialize environment variables if present
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api', portfolioRoutes);

app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
});

app.use(errorHandler);

// Start server
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
