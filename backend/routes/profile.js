const express = require('express');
const { authenticate } = require('../middleware/auth');
const profileController = require('../controllers/profileController');

const router = express.Router();

router.get('/', authenticate, profileController.profile);
router.put('/', authenticate, profileController.update);

module.exports = router;