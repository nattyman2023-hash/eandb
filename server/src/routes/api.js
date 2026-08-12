const express = require('express');

const authRoutes = require('./auth');
const queryRoutes = require('./query');
const storageRoutes = require('./storage');
const functionsRoutes = require('./functions');
const resourceRoutes = require('./resources');
const paymentsRoutes = require('./payments');

const router = express.Router();

router.get('/health', (req, res) => res.json({ status: 'ok' }));
router.use('/auth', authRoutes);
router.use('/query', queryRoutes);
router.use('/storage', storageRoutes);
router.use('/payments', paymentsRoutes);
router.post('/bookings', (req, res, next) => {
  req.url = '/create-booking';
  return functionsRoutes(req, res, next);
});
router.use('/functions', functionsRoutes);
router.use('/', resourceRoutes);

module.exports = router;
