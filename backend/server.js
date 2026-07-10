const express = require('express');
const cors = require('cors');
require('dotenv').config();

const healthRouter = require('./routers/health');
const trackRouter = require('./routers/track');
const authRouter = require('./routers/auth');
const keysRouter = require('./routers/keys');
const customersRouter = require('./routers/customers'); 

// Initialize the nightly cron job scheduler
require('./workers/scheduler');

const app = express();
const PORT = process.env.PORT || 8000;

// Middleware
app.use(cors({ origin: 'http://localhost:3000' }));
app.use(express.json());

// Routes
app.use('/api', healthRouter);
app.use('/api', authRouter);
app.use('/api', keysRouter);
app.use('/api', customersRouter); // Registered under /api (e.g. /api/overview, /api/customers)
app.use('/v1', trackRouter);

app.get('/', (req, res) => {
  res.json({ message: 'Welcome to ChurnShield API. Endpoints available under /api and /v1' });
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});