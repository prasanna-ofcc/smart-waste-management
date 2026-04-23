const express = require('express');
const { authenticate, requireRole } = require('../middleware/auth');
const adminController = require('../controllers/adminController');

const router = express.Router();

router.use(authenticate, requireRole('admin'));

router.get('/workers', adminController.getWorkers);
router.post('/workers', adminController.createWorkerAccount);
router.get('/events', adminController.getAdminEvents);
router.get('/stats', adminController.getAdminStats);

router.get('/zones', adminController.getZones);
router.post('/zones', adminController.createZoneHandler);
router.post('/zones/assign', adminController.assignWorkerZone);
router.put('/zones/assignments', adminController.replaceWorkerZones);

router.post('/bins', adminController.addBinHandler);
router.delete('/bins/:id', adminController.removeBinHandler);

module.exports = router;
