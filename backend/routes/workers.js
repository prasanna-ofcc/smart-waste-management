const express = require('express');
const { authenticate, requireRole } = require('../middleware/auth');
const workerController = require('../controllers/workerController');

const router = express.Router();

router.get('/', authenticate, requireRole('worker', 'admin'), workerController.listAllWorkers);
router.get('/bins', authenticate, requireRole('worker'), workerController.workerBins);
router.patch('/me/status', authenticate, requireRole('worker'), workerController.setStatus);
router.patch('/me/location', authenticate, requireRole('worker'), workerController.setLocation);
router.get('/me/requests', authenticate, requireRole('worker'), workerController.workerRequests);
router.patch('/requests/:id/accept', authenticate, requireRole('worker'), workerController.acceptWorkerRequest);
router.patch('/requests/:id/complete', authenticate, requireRole('worker', 'admin'), workerController.completeWorkerRequest);

module.exports = router;
