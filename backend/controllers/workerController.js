const asyncHandler = require('../utils/asyncHandler');
const { updateWorkerStatus, updateWorkerLocation, sanitizeUser, listWorkers } = require('../services/userService');
const { listBinsForWorker } = require('../services/binService');
const { listRequests, acceptRequest, completeRequest } = require('../services/requestService');

const listAllWorkers = asyncHandler(async (_req, res) => {
  const workers = await listWorkers();
  res.json(workers);
});

const workerBins = asyncHandler(async (req, res) => {
  const bins = await listBinsForWorker(req.user);
  res.json(bins);
});

const setStatus = asyncHandler(async (req, res) => {
  const { status } = req.body;
  const user = await updateWorkerStatus(req.user.id, status);
  const safe = sanitizeUser(user);
  req.app.locals.broadcast({ type: 'WORKER_UPDATED', worker: safe });
  res.json(safe);
});

const setLocation = asyncHandler(async (req, res) => {
  const { lat, lng } = req.body;
  const user = await updateWorkerLocation(req.user.id, lat, lng);
  const safe = sanitizeUser(user);
  req.app.locals.broadcast({ type: 'WORKER_MOVED', worker: safe });
  res.json(safe);
});

const workerRequests = asyncHandler(async (req, res) => {
  const requests = await listRequests({ role: 'worker', userId: req.user.id });
  res.json(requests);
});

const acceptWorkerRequest = asyncHandler(async (req, res) => {
  const request = await acceptRequest({ requestId: req.params.id, worker: req.user });
  req.app.locals.broadcast({ type: 'REQUEST_UPDATED', request });
  res.json(request);
});

const completeWorkerRequest = asyncHandler(async (req, res) => {
  const request = await completeRequest({ requestId: req.params.id, worker: req.user });
  req.app.locals.broadcast({ type: 'REQUEST_UPDATED', request });
  res.json(request);
});

module.exports = {
  listAllWorkers,
  setStatus,
  setLocation,
  workerRequests,
  workerBins,
  acceptWorkerRequest,
  completeWorkerRequest,
};
