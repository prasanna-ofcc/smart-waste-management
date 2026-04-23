const asyncHandler = require('../utils/asyncHandler');
const { createRequest, listRequests, completeRequest } = require('../services/requestService');

const create = asyncHandler(async (req, res) => {
  const payload = {
    userId: req.user?.id || null,
    type: req.body.type,
    locationLat: Number(req.body.locationLat),
    locationLng: Number(req.body.locationLng),
    address: req.body.address,
    description: req.body.description,
  };

  const request = await createRequest(payload);
  req.app.locals.broadcast({ type: 'REQUEST_ADDED', request });
  res.status(201).json(request);
});

const list = asyncHandler(async (req, res) => {
  const requests = await listRequests({ role: req.user.role, userId: req.user.id });
  res.json(requests);
});

const completeByAdmin = asyncHandler(async (req, res) => {
  const request = await completeRequest({ requestId: req.params.id, worker: req.user });
  req.app.locals.broadcast({ type: 'REQUEST_UPDATED', request });
  res.json(request);
});

module.exports = { create, list, completeByAdmin };
