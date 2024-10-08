// app.js
require('dotenv').config(); // Load environment variables
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const connectDB = require('./services/db');
const config = require('./config/config');
const { redisClient } = require('./services/redisClient');
const fetchFinancialData = require('./services/dataService');
const authRoutes = require('./routes/authRoutes');
const dataRoutes = require('./routes/dataRoutes');

const app = express();

// Middleware
app.use(cors());
app.use(bodyParser.json());

// Routes
app.use('/api', authRoutes);
app.use('/api', dataRoutes);

// Root route
app.get('/', (req, res) => {
  res.send('Express server running...');
});

// Start the server
app.listen(config.port, async () => {
  try {
    await connectDB(); // Connect to MongoDB
    await redisClient.connect();
    console.log('Connected to MongoDB and Redis');
    console.log('Connected to Redis');
    console.log(`Server listening at http://localhost:${config.port}`);
    // Start fetching financial data at intervals
    fetchFinancialData();
  } catch (error) {
    console.error(`Error starting the server: ${error}`);
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({ message: 'Internal server error' });
  });
