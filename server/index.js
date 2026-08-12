require('dotenv').config();

const path = require('path');
const express = require('express');
const cors = require('cors');

const apiRouter = require('./src/routes/api');
const { processEmailQueueOnce } = require('./src/jobs/emailWorker');

const app = express();
const PORT = process.env.PORT || 3000;
const distPath = path.resolve(__dirname, '../dist');

const allowedOrigins = [
  process.env.FRONTEND_URL,
  /^http:\/\/localhost:\d+$/,
  /^http:\/\/127\.0\.0\.1:\d+$/,
].filter(Boolean);

app.use(cors({
  origin(origin, callback) {
    if (!origin) return callback(null, true);
    const allowed = allowedOrigins.some((entry) => (
      entry instanceof RegExp ? entry.test(origin) : entry === origin
    ));
    return callback(null, allowed);
  },
}));
app.use('/api/payments/stripe/webhook', express.raw({ type: 'application/json' }));
app.use(express.json({ limit: '2mb' }));

// API routes must be registered before static files and the SPA fallback.
app.use('/api', apiRouter);
app.use('/api', (req, res) => res.status(404).json({ status: 'error', error: 'API route not found' }));

app.use(express.static(distPath));

// Let React Router handle browser routes while never swallowing an API 404.
app.get(/^(?!\/api(?:\/|$)).*/, (req, res, next) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') return next();
  return res.sendFile(path.join(distPath, 'index.html'), (error) => {
    if (error) next(error);
  });
});

app.use((err, req, res, next) => {
  console.error('[server] unhandled error:', err);
  if (res.headersSent) return next(err);
  return res.status(err.status || 500).json({
    status: 'error',
    error: process.env.NODE_ENV === 'production' ? 'Internal server error' : (err.message || 'Internal server error'),
  });
});

if (process.env.NODE_ENV === 'production' && process.env.EMAIL_WORKER_ENABLED !== 'false') {
  try {
    const cron = require('node-cron');
    cron.schedule('*/10 * * * * *', () => {
      processEmailQueueOnce().catch((error) => console.error('[emailWorker] tick failed:', error.message));
    });
  } catch (error) {
    console.error('[emailWorker] failed to start:', error.message);
  }
}

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});

module.exports = app;
