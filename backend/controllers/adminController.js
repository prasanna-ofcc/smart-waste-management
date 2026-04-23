const asyncHandler = require('../utils/asyncHandler');
const { supabase } = require('../db/supabase');
const { createWorker, listWorkers, sanitizeUser } = require('../services/userService');
const { createZone, listZones, assignWorkerToZone, setWorkerZones } = require('../services/zoneService');
const { addBin, removeBin } = require('../services/binService');
const { mapSupabaseError } = require('../utils/errors');
const { logActivity } = require('../services/activityService');

const createWorkerAccount = asyncHandler(async (req, res) => {
  const { name, email, password, phone } = req.body;
  const worker = await createWorker({ name, email, password, phone });
  await logActivity({ userId: req.user.id, actionType: 'WORKER_CREATED', entityType: 'user', entityId: worker.id, metadata: {} });
  res.status(201).json(sanitizeUser(worker));
});

const getWorkers = asyncHandler(async (_req, res) => {
  const workers = await listWorkers();
  res.json(workers);
});

const getAdminEvents = asyncHandler(async (_req, res) => {
  const { data, error } = await supabase
    .from('worker_logs')
    .select('id,worker_id,bin_id,action,created_at')
    .eq('action', 'BIN_COLLECTED')
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) throw mapSupabaseError(error, 'Failed to fetch admin events.');

  const events = data.map((row) => ({
    id: row.id,
    workerId: row.worker_id,
    binLabel: row.bin_id,
    timestamp: row.created_at,
  }));

  res.json(events);
});

const getAdminStats = asyncHandler(async (_req, res) => {
  const [{ data: bins, error: binsError }, { data: requests, error: requestsError }, { data: workers, error: workersError }, { count: collectedCount, error: collectedError }] = await Promise.all([
    supabase.from('bins').select('id,status,fill_level'),
    supabase.from('requests').select('id,status'),
    supabase.from('users').select('id', { count: 'exact' }).eq('role', 'worker'),
    supabase.from('worker_logs').select('*', { count: 'exact', head: true }).eq('action', 'BIN_COLLECTED'),
  ]);

  if (binsError) throw mapSupabaseError(binsError, 'Failed to fetch bin stats.');
  if (requestsError) throw mapSupabaseError(requestsError, 'Failed to fetch request stats.');
  if (workersError) throw mapSupabaseError(workersError, 'Failed to fetch worker stats.');
  if (collectedError) throw mapSupabaseError(collectedError, 'Failed to fetch collection stats.');

  const totalBins = bins.length;
  const fullBins = bins.filter((b) => b.status === 'full').length;
  const emptyBins = bins.filter((b) => b.status === 'empty' || b.status === 'collected').length;
  const totalRequests = requests.length;
  const pendingRequests = requests.filter((r) => r.status === 'pending').length;

  res.json({
    totalBins,
    fullBins,
    emptyBins,
    totalCollected: collectedCount || 0,
    totalRequests,
    pendingRequests,
    workers: workers.length,
  });
});

const createZoneHandler = asyncHandler(async (req, res) => {
  const { name, centerLat, centerLng, radiusKm } = req.body;
  const zone = await createZone({
    name,
    centerLat,
    centerLng,
    radiusKm: radiusKm || 6,
    createdBy: req.user.id,
  });
  await logActivity({ userId: req.user.id, actionType: 'ZONE_CREATED', entityType: 'zone', entityId: zone.id, metadata: {} });
  res.status(201).json(zone);
});

const getZones = asyncHandler(async (_req, res) => {
  const zones = await listZones();
  res.json(zones);
});

const assignWorkerZone = asyncHandler(async (req, res) => {
  const { workerId, zoneId } = req.body;
  const result = await assignWorkerToZone({ workerId, zoneId, assignedBy: req.user.id });
  await logActivity({ userId: req.user.id, actionType: 'WORKER_ZONE_ASSIGNED', entityType: 'worker_zones', entityId: `${workerId}:${zoneId}`, metadata: {} });
  res.json(result);
});

const replaceWorkerZones = asyncHandler(async (req, res) => {
  const { workerId, zoneIds } = req.body;
  const result = await setWorkerZones({ workerId, zoneIds: zoneIds || [], assignedBy: req.user.id });
  await logActivity({ userId: req.user.id, actionType: 'WORKER_ZONES_REPLACED', entityType: 'users', entityId: workerId, metadata: { zoneIds } });
  res.json(result);
});

const addBinHandler = asyncHandler(async (req, res) => {
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

const removeBinHandler = asyncHandler(async (req, res) => {
  const bin = await removeBin({ binId: req.params.id, removedBy: req.user.id });
  req.app.locals.broadcast({ type: 'BIN_REMOVED', binId: req.params.id });
  res.json({ message: 'Bin removed.', bin });
});

module.exports = {
  createWorkerAccount,
  getWorkers,
  getAdminEvents,
  getAdminStats,
  createZoneHandler,
  getZones,
  assignWorkerZone,
  replaceWorkerZones,
  addBinHandler,
  removeBinHandler,
};
