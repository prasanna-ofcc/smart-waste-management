const express = require('express');
const { authenticate, optionalAuth, requireRole } = require('../middleware/auth');
const requestController = require('../controllers/requestController');

const router = express.Router();

router.post('/', optionalAuth, requestController.create);
router.get('/', authenticate, requestController.list);
router.patch('/:id/complete', authenticate, requireRole('admin'), requestController.completeByAdmin);

module.exports = router;
