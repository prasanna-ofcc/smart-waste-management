const asyncHandler = require('../utils/asyncHandler');
const { getProfile, updateProfile } = require('../services/authService');

const profile = asyncHandler(async (req, res) => {
  const user = await getProfile(req.user.id);
  res.json(user);
});

const update = asyncHandler(async (req, res) => {
  const user = await updateProfile(req.user.id, req.body || {});
  res.json(user);
});

module.exports = { profile, update };