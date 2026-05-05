const asyncHandler = require('../utils/asyncHandler');
const { listBinsForUser, collectBin, updateBinStatus, listNearbyBins, optimizeCollectionRoute, addBin, removeBin } = require('../services/binService');

const listBins = asyncHandler(async (req, res) => {
  const bins = await listBinsForUser(req.user);
  res.json(bins);
});

const collect = asyncHandler(async (req, res) => {
  const bin = await collectBin({ binId: req.params.id, worker: req.user });
  req.app.locals.broadcast({ type: 'BIN_UPDATED', bin });
  res.json({ message: 'Bin collected.', bin });
});

const patchStatus = asyncHandler(async (req, res) => {
  const { status, fillLevel } = req.body;
  const bin = await updateBinStatus({
    binId: req.params.id,
    status,
    fillLevel,
    updatedBy: req.user.id,
    user: req.user,
  });
  req.app.locals.broadcast({ type: 'BIN_UPDATED', bin });
  res.json(bin);
});

const nearby = asyncHandler(async (req, res) => {
  const lat = Number(req.query.lat);
  const lng = Number(req.query.lng);
  const radiusKm = req.query.radiusKm ? Number(req.query.radiusKm) : 6;
  const bins = await listNearbyBins({ lat, lng, radiusKm });
  res.json(bins);
});

const optimizeRoute = asyncHandler(async (req, res) => {
  const workerLat = req.query.workerLat;
  const workerLng = req.query.workerLng;
  const result = await optimizeCollectionRoute({ worker: req.user, workerLat, workerLng });
  res.json(result);
});

const create = asyncHandler(async (req, res) => {
  const { label, location, lat, lng, zone_id, zoneId } = req.body;
  const bin = await addBin({
    label,
    location,
    lat,
    lng,
    zoneId: zone_id || zoneId,
    createdBy: req.user.id,
  });
  req.app.locals.broadcast({ type: 'BIN_ADDED', bin });
  res.status(201).json(bin);
});

const remove = asyncHandler(async (req, res) => {
  const bin = await removeBin({ binId: req.params.id, removedBy: req.user.id });
  req.app.locals.broadcast({ type: 'BIN_REMOVED', binId: req.params.id });
  res.json({ message: 'Bin removed.', bin });
});

module.exports = { listBins, collect, patchStatus, nearby, optimizeRoute, create, remove };
