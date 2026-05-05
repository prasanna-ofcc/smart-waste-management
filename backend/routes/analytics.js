const express = require('express');
const { authenticate, requireRole } = require('../middleware/auth');
const analyticsController = require('../controllers/analyticsController');

const router = express.Router();

router.use(authenticate, requireRole('admin'));
router.get('/workers/performance', analyticsController.workerPerformance);
router.get('/bins/usage', analyticsController.binUsage);
router.get('/requests/stats', analyticsController.requestStats);
router.get('/collections/summary', analyticsController.collectionSummary);

module.exports = router;
