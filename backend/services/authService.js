const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { AppError } = require('../utils/errors');
const { getUserByEmail, getUserById, sanitizeUser, createPublicUser, updateUserPasswordHash, updateUserProfile } = require('./userService');
const { logActivity } = require('./activityService');
const { getAssignedZonesForWorker } = require('./zoneService');

const JWT_SECRET = process.env.JWT_SECRET || 'replace_this_secret';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '8h';

function signToken(user) {
  return jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

function looksLikeBcryptHash(value) {
  return typeof value === 'string' && /^\$2[aby]\$\d{2}\$/.test(value);
}

async function registerPublicUser({ name, email, password, phone }) {
  if (!name || !email || !password) {
    throw new AppError('Name, email, and password are required.', 400);
  }
  if (String(password).length < 6) {
    throw new AppError('Password must be at least 6 characters.', 400);
  }

  const user = await createPublicUser({ name, email, password, phone });
  const token = signToken(user);

  await logActivity({ userId: user.id, actionType: 'PUBLIC_REGISTERED', entityType: 'user', entityId: user.id, metadata: {} });

  return { token, user: sanitizeUser(user) };
}

async function login({ email, password }) {
  if (!email || !password) {
    throw new AppError('Email and password are required.', 400);
  }

  const user = await getUserByEmail(email);
  if (!user) throw new AppError('Invalid email or password.', 401);

  let isMatch = false;

  if (looksLikeBcryptHash(user.password_hash)) {
    isMatch = await bcrypt.compare(password, user.password_hash);
  } else if (typeof user.password_hash === 'string') {
    // Backward-compatibility for users inserted manually with plain-text passwords.
    isMatch = password === user.password_hash;
    if (isMatch) {
      const upgradedHash = await bcrypt.hash(password, 10);
      await updateUserPasswordHash(user.id, upgradedHash);
    }
  }

  if (!isMatch) throw new AppError('Invalid email or password.', 401);

  const token = signToken(user);
  await logActivity({ userId: user.id, actionType: 'USER_LOGGED_IN', entityType: 'user', entityId: user.id, metadata: {} });

  return { token, user: sanitizeUser(user) };
}

async function getProfile(id) {
  const user = await getUserById(id);
  if (!user) throw new AppError('User not found.', 404);

  const safeUser = sanitizeUser(user);
  const profile = {
    id: safeUser.id,
    name: safeUser.name,
    email: safeUser.email,
    phone: safeUser.phone,
    role: safeUser.role,
    profile_image: safeUser.profile_image || null,
  };

  if (safeUser.role === 'worker') {
    profile.assigned_zones = await getAssignedZonesForWorker(safeUser.id);
  }

  return profile;
}

async function updateProfile(id, payload) {
  const updated = await updateUserProfile({
    userId: id,
    name: payload.name,
    email: payload.email,
    phone: payload.phone,
    profileImage: payload.profile_image,
  });

  return sanitizeUser(updated);
}

module.exports = {
  JWT_SECRET,
  registerPublicUser,
  login,
  getProfile,
  updateProfile,
};
