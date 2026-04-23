const express = require('express');
const { authenticate, requireRole } = require('../middleware/auth');
const binController = require('../controllers/binController');

const router = express.Router();

router.get('/', authenticate, binController.listBins);
router.get('/nearby', authenticate, binController.nearby);
router.post('/', authenticate, requireRole('admin'), binController.create);
router.delete('/:id', authenticate, requireRole('admin'), binController.remove);
router.post('/:id/collect', authenticate, requireRole('worker'), binController.collect);
router.patch('/:id/status', authenticate, requireRole('worker', 'admin'), binController.patchStatus);

module.exports = router;
