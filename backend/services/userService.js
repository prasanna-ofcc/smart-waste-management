const bcrypt = require('bcryptjs');
const { supabase } = require('../db/supabase');
const { AppError, mapSupabaseError } = require('../utils/errors');

function isMissingColumnError(error, columnName) {
  const msg = String(error?.message || '').toLowerCase();
  return msg.includes('could not find') && msg.includes(String(columnName).toLowerCase()) && msg.includes('column');
}

function sanitizeUser(user) {
  if (!user) return null;
  const { password_hash, ...safe } = user;
  return safe;
}

async function getUserById(id) {
  const { data, error } = await supabase.from('users').select('*').eq('id', id).maybeSingle();
  if (error) throw mapSupabaseError(error, 'Failed to fetch user.');
  return data;
}

async function getUserByEmail(email) {
  const { data, error } = await supabase.from('users').select('*').eq('email', String(email).toLowerCase()).maybeSingle();
  if (error) throw mapSupabaseError(error, 'Failed to fetch user.');
  return data;
}

async function createPublicUser({ name, email, password, phone = '' }) {
  const existing = await getUserByEmail(email);
  if (existing) throw new AppError('Email already registered.', 409);

  const passwordHash = await bcrypt.hash(password, 10);
  const payload = {
    name,
    email: String(email).toLowerCase(),
    password_hash: passwordHash,
    phone,
    role: 'public',
    worker_status: 'inactive',
  };

  const { data, error } = await supabase.from('users').insert(payload).select('*').single();
  if (error) throw mapSupabaseError(error, 'Failed to create user.');
  return data;
}

async function createWorker({ name, email, password, phone = '' }) {
  const existing = await getUserByEmail(email);
  if (existing) throw new AppError('Email already registered.', 409);

  const passwordHash = await bcrypt.hash(password, 10);
  const payload = {
    name,
    email: String(email).toLowerCase(),
    password_hash: passwordHash,
    phone,
    role: 'worker',
    worker_status: 'inactive',
  };

  const { data, error } = await supabase.from('users').insert(payload).select('*').single();
  if (error) throw mapSupabaseError(error, 'Failed to create worker.');
  return data;
}

async function listWorkers() {
  const { data, error } = await supabase
    .from('users')
    .select('id,name,email,phone,role,worker_status,location_lat,location_lng,created_at,updated_at')
    .eq('role', 'worker')
    .order('created_at', { ascending: false });

  if (error) throw mapSupabaseError(error, 'Failed to fetch workers.');
  return data;
}

async function updateWorkerStatus(workerId, status) {
  const { data, error } = await supabase
    .from('users')
    .update({ worker_status: status, updated_at: new Date().toISOString() })
    .eq('id', workerId)
    .eq('role', 'worker')
    .select('*')
    .single();

  if (error) throw mapSupabaseError(error, 'Failed to update worker status.');
  return data;
}

async function updateWorkerLocation(workerId, lat, lng) {
  const { data, error } = await supabase
    .from('users')
    .update({ location_lat: lat, location_lng: lng, updated_at: new Date().toISOString() })
    .eq('id', workerId)
    .eq('role', 'worker')
    .select('*')
    .single();

  if (error) throw mapSupabaseError(error, 'Failed to update worker location.');
  return data;
}

async function updateUserPasswordHash(userId, passwordHash) {
  const { data, error } = await supabase
    .from('users')
    .update({ password_hash: passwordHash, updated_at: new Date().toISOString() })
    .eq('id', userId)
    .select('*')
    .single();

  if (error) throw mapSupabaseError(error, 'Failed to update user password.');
  return data;
}

async function updateUserProfile({ userId, name, email, phone, profileImage }) {
  const existing = await getUserById(userId);
  if (!existing) throw new AppError('User not found.', 404);

  const patch = {
    updated_at: new Date().toISOString(),
  };

  if (typeof name === 'string' && name.trim()) patch.name = name.trim();
  if (typeof phone === 'string') patch.phone = phone.trim();
  if (typeof profileImage === 'string') patch.profile_image = profileImage.trim();

  if (typeof email === 'string' && email.trim()) {
    const normalizedEmail = email.trim().toLowerCase();
    const conflict = await getUserByEmail(normalizedEmail);
    if (conflict && conflict.id !== userId) {
      throw new AppError('Email already in use.', 409);
    }
    patch.email = normalizedEmail;
  }

  const { data, error } = await supabase
    .from('users')
    .update(patch)
    .eq('id', userId)
    .select('*')
    .single();

  if (error) {
    if (isMissingColumnError(error, 'profile_image')) {
      throw new AppError('profile_image column is missing. Run backend/db/schema.sql migration.', 500);
    }
    throw mapSupabaseError(error, 'Failed to update user profile.');
  }
  return data;
}

module.exports = {
  sanitizeUser,
  getUserById,
  getUserByEmail,
  createPublicUser,
  createWorker,
  listWorkers,
  updateWorkerStatus,
  updateWorkerLocation,
  updateUserPasswordHash,
  updateUserProfile,
};
