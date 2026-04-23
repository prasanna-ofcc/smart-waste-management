const asyncHandler = require('../utils/asyncHandler');
const { getWorkerPerformance, getBinUsage, getRequestStats } = require('../services/analyticsService');

const workerPerformance = asyncHandler(async (_req, res) => {
  const stats = await getWorkerPerformance();
  res.json(stats);
});

const binUsage = asyncHandler(async (_req, res) => {
  const stats = await getBinUsage();
  res.json(stats);
});

const requestStats = asyncHandler(async (_req, res) => {
  const stats = await getRequestStats();
  res.json(stats);
});

module.exports = { workerPerformance, binUsage, requestStats };
