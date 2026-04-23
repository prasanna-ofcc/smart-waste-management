const jwt = require('jsonwebtoken');
const { getUserById, sanitizeUser } = require('../services/userService');

const JWT_SECRET = process.env.JWT_SECRET || 'replace_this_secret';

async function authenticate(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ message: 'No token provided.' });

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET);

    const user = await getUserById(decoded.id);
    if (!user) return res.status(401).json({ message: 'Invalid user.' });

    req.user = sanitizeUser(user);
    return next();
  } catch {
    return res.status(401).json({ message: 'Invalid or expired token.' });
  }
}

const optionalAuth = async (req, _res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return next();
  try {
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await getUserById(decoded.id);
    req.user = sanitizeUser(user);
  } catch {
    req.user = null;
  }
  next();
};

const requireRole = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user?.role)) {
    return res.status(403).json({ message: 'Access denied.' });
  }
  return next();
};

module.exports = { authenticate, optionalAuth, requireRole };
