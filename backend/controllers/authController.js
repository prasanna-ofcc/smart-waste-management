const asyncHandler = require('../utils/asyncHandler');
const authService = require('../services/authService');

const register = asyncHandler(async (req, res) => {
  const payload = await authService.registerPublicUser(req.body);
  res.status(201).json(payload);
});

const login = asyncHandler(async (req, res) => {
  const payload = await authService.login(req.body);
  res.json(payload);
});

const me = asyncHandler(async (req, res) => {
  const user = await authService.getProfile(req.user.id);
  res.json(user);
});

module.exports = { register, login, me };
