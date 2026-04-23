const { supabase } = require('../db/supabase');
const { AppError, mapSupabaseError } = require('../utils/errors');
const { getWorkerZoneIds } = require('./zoneService');
const { logActivity, logWorker } = require('./activityService');

const FILL_DURATION_MINUTES = 20;
const COLLECTION_RADIUS_METERS = 10;
const ALLOWED_BIN_STATUSES = new Set(['empty', 'full', 'collected']);

function toRad(v) {
  return (v * Math.PI) / 180;
}

function distanceMeters(aLat, aLng, bLat, bLng) {
  const R = 6371000;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

function isMissingColumnError(error, columnName) {
  const msg = String(error?.message || '').toLowerCase();
  return msg.includes('column') && msg.includes(String(columnName).toLowerCase()) && (msg.includes('schema cache') || msg.includes('does not exist'));
}

function isMissingTableError(error, tableName) {
  const msg = String(error?.message || '').toLowerCase();
  return msg.includes('could not find the table') && msg.includes(String(tableName).toLowerCase());
}

function computeFillLevel(fillStartedAt) {
  if (!fillStartedAt) return 100;
  const elapsedMs = Date.now() - new Date(fillStartedAt).getTime();
  const level = Math.floor((elapsedMs / (FILL_DURATION_MINUTES * 60 * 1000)) * 100);
  return Math.max(0, Math.min(100, level));
}

async function listBinsForUser(user) {
  let query = supabase.from('bins').select('*').order('created_at', { ascending: false });

  if (user.role === 'worker') {
    const zoneIds = await getWorkerZoneIds(user.id);
    if (!zoneIds.length) return [];
    query = query.in('zone_id', zoneIds);
  }

  const { data, error } = await query;
  if (error) throw mapSupabaseError(error, 'Failed to fetch bins.');
  return data;
}

async function addBin({ label, location, lat, lng, zoneId, createdBy }) {
  const parsedLat = Number(lat);
  const parsedLng = Number(lng);
  const normalizedLocation = typeof location === 'string' ? location.trim() : '';

  if ((!Number.isFinite(parsedLat) || !Number.isFinite(parsedLng)) && !normalizedLocation) {
    throw new AppError('Provide either a location string or valid lat and lng to add a bin.', 400);
  }

  let resolvedZoneId = zoneId;
  if (!resolvedZoneId) {
    if (!Number.isFinite(parsedLat) || !Number.isFinite(parsedLng)) {
      throw new AppError('zone_id is required when lat/lng are not provided.', 400);
    }

    const { data: zones, error: zoneError } = await supabase
      .from('zones')
      .select('id,center_lat,center_lng')
      .order('created_at', { ascending: true });

    if (zoneError) throw mapSupabaseError(zoneError, 'Failed to resolve bin zone.');
    if (!zones?.length) throw new AppError('No zones available. Create a zone before adding bins.', 400);

    const toRad = (v) => (v * Math.PI) / 180;
    const distanceKm = (aLat, aLng, bLat, bLng) => {
      const R = 6371;
      const dLat = toRad(bLat - aLat);
      const dLng = toRad(bLng - aLng);
      const x = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
      return 2 * R * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
    };

    const nearestZone = zones.reduce((best, zone) => {
      const d = distanceKm(parsedLat, parsedLng, zone.center_lat, zone.center_lng);
      if (!best || d < best.distance) return { id: zone.id, distance: d };
      return best;
    }, null);

    resolvedZoneId = nearestZone.id;
  }

  const { data: zoneExists, error: zoneLookupError } = await supabase
    .from('zones')
    .select('id')
    .eq('id', resolvedZoneId)
    .maybeSingle();

  if (zoneLookupError) throw mapSupabaseError(zoneLookupError, 'Failed to validate zone.');
  if (!zoneExists) throw new AppError('Zone not found for this bin.', 400);

  const payload = {
    label: label || normalizedLocation || `BIN-${Date.now()}`,
    location: normalizedLocation || null,
    lat: Number.isFinite(parsedLat) ? parsedLat : null,
    lng: Number.isFinite(parsedLng) ? parsedLng : null,
    zone_id: resolvedZoneId,
    status: 'empty',
    fill_level: 0,
    fill_started_at: new Date().toISOString(),
    created_by: createdBy,
  };

  let inserted = await supabase.from('bins').insert(payload).select('*').single();

  if (inserted.error && isMissingColumnError(inserted.error, 'location')) {
    const legacyPayload = {
      ...payload,
      label: payload.label || payload.location || `BIN-${Date.now()}`,
    };
    delete legacyPayload.location;

    if (!Number.isFinite(parsedLat) || !Number.isFinite(parsedLng)) {
      throw new AppError('This database schema requires lat and lng for bins. Provide lat/lng or run db/schema.sql migration.', 400);
    }

    inserted = await supabase.from('bins').insert(legacyPayload).select('*').single();
  }

  if (inserted.error) {
    throw mapSupabaseError(inserted.error, 'Failed to add bin.');
  }

  const data = inserted.data;

  await logActivity({ userId: createdBy, actionType: 'BIN_CREATED', entityType: 'bin', entityId: data.id, metadata: { zoneId: resolvedZoneId } });
  return data;
}

async function removeBin({ binId, removedBy }) {
  const { data, error } = await supabase.from('bins').delete().eq('id', binId).select('*').single();
  if (error) throw mapSupabaseError(error, 'Failed to remove bin.');

  await logActivity({ userId: removedBy, actionType: 'BIN_REMOVED', entityType: 'bin', entityId: binId, metadata: {} });
  return data;
}

async function collectBin({ binId, worker }) {
  const { data: bin, error: binError } = await supabase.from('bins').select('*').eq('id', binId).single();
  if (binError) throw mapSupabaseError(binError, 'Failed to load bin.');

  if (bin.status !== 'full') {
    throw new AppError('Bin already collected or not ready for collection.', 409);
  }

  if (!Number.isFinite(Number(bin.lat)) || !Number.isFinite(Number(bin.lng))) {
    throw new AppError('Bin does not have valid GPS coordinates.', 400);
  }

  const workerLat = Number(worker.location_lat);
  const workerLng = Number(worker.location_lng);
  if (!Number.isFinite(workerLat) || !Number.isFinite(workerLng)) {
    throw new AppError('Worker location unavailable. Share live location before collecting.', 400);
  }

  const proximityMeters = distanceMeters(workerLat, workerLng, Number(bin.lat), Number(bin.lng));
  if (proximityMeters > COLLECTION_RADIUS_METERS) {
    throw new AppError('Move closer to the bin to collect.', 400);
  }

  const { error: collectionsTableCheckError } = await supabase.from('collections').select('id').limit(1);
  if (collectionsTableCheckError) {
    if (isMissingTableError(collectionsTableCheckError, 'collections')) {
      throw new AppError('Collections table not found. Run backend/db/schema.sql to enable collection logging.', 500);
    }
    throw mapSupabaseError(collectionsTableCheckError, 'Failed to validate collection storage.');
  }

  if (worker.role === 'worker') {
    const zoneIds = await getWorkerZoneIds(worker.id);
    if (!zoneIds.includes(bin.zone_id)) {
      throw new AppError('You can only collect bins in your assigned zones.', 403);
    }
  }

  const nowIso = new Date().toISOString();
  const { data, error } = await supabase
    .from('bins')
    .update({
      status: 'empty',
      fill_level: 0,
      fill_started_at: nowIso,
      last_collected_at: nowIso,
      updated_at: nowIso,
    })
    .eq('id', binId)
    .eq('status', 'full')
    .select('*')
    .single();

  if (error) {
    const msg = String(error.message || '').toLowerCase();
    if (msg.includes('json object requested') || msg.includes('no rows')) {
      throw new AppError('Bin already collected or not ready for collection.', 409);
    }
    throw mapSupabaseError(error, 'Failed to update bin status.');
  }

  const { error: collectionError } = await supabase.from('collections').insert({
    bin_id: bin.id,
    worker_id: worker.id,
    collected_at: nowIso,
    worker_lat: workerLat,
    worker_lng: workerLng,
    bin_lat: Number(bin.lat),
    bin_lng: Number(bin.lng),
    distance_meters: Math.round(proximityMeters * 100) / 100,
  });

  if (collectionError) throw mapSupabaseError(collectionError, 'Failed to save collection record.');

  await logWorker({ workerId: worker.id, action: 'BIN_COLLECTED', binId: binId, details: { zoneId: bin.zone_id } });
  await logActivity({
    userId: worker.id,
    actionType: 'BIN_COLLECTED',
    entityType: 'bin',
    entityId: binId,
    metadata: { zoneId: bin.zone_id, distanceMeters: Math.round(proximityMeters * 100) / 100 },
  });

  return data;
}

async function updateBinStatus({ binId, status, fillLevel, updatedBy, user }) {
  if (!ALLOWED_BIN_STATUSES.has(status)) {
    throw new AppError('Invalid status. Allowed values: empty, full, collected.', 400);
  }
  if (!Number.isInteger(fillLevel) || fillLevel < 0 || fillLevel > 100) {
    throw new AppError('fillLevel must be an integer between 0 and 100.', 400);
  }

  const { data: currentBin, error: currentBinError } = await supabase.from('bins').select('id,zone_id').eq('id', binId).single();
  if (currentBinError) throw mapSupabaseError(currentBinError, 'Failed to validate bin.');

  if (user?.role === 'worker') {
    const zoneIds = await getWorkerZoneIds(user.id);
    if (!zoneIds.includes(currentBin.zone_id)) {
      throw new AppError('You can only update bins in your assigned zones.', 403);
    }
  }

  const patch = {
    status,
    fill_level: fillLevel,
    updated_at: new Date().toISOString(),
  };

  if (status === 'collected') {
    patch.last_collected_at = new Date().toISOString();
    patch.fill_level = 0;
    patch.fill_started_at = new Date().toISOString();
  }

  const { data, error } = await supabase.from('bins').update(patch).eq('id', binId).select('*').single();
  if (error) {
    const msg = String(error.message || '').toLowerCase();
    if (status === 'collected' && msg.includes('bins_status_check')) {
      throw new AppError('This database schema currently allows only empty/full statuses. Run backend/db/schema.sql to enable collected status.', 500);
    }
    throw mapSupabaseError(error, 'Failed to update bin status.');
  }

  await logActivity({ userId: updatedBy, actionType: 'BIN_STATUS_UPDATED', entityType: 'bin', entityId: binId, metadata: { status, fillLevel } });
  return data;
}

async function listNearbyBins({ lat, lng, radiusKm = 6 }) {
  const { data, error } = await supabase.from('bins').select('*');
  if (error) throw mapSupabaseError(error, 'Failed to fetch nearby bins.');

  const toRad = (v) => (v * Math.PI) / 180;
  const distanceKm = (aLat, aLng, bLat, bLng) => {
    const R = 6371;
    const dLat = toRad(bLat - aLat);
    const dLng = toRad(bLng - aLng);
    const x = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
  };

  return data.filter(
    (bin) =>
      Number.isFinite(Number(bin.lat)) &&
      Number.isFinite(Number(bin.lng)) &&
      distanceKm(lat, lng, Number(bin.lat), Number(bin.lng)) <= radiusKm
  );
}

async function runBinFillSimulationTick() {
  const { data, error } = await supabase
    .from('bins')
    .select('*')
    .not('fill_started_at', 'is', null)
    .neq('status', 'full');

  if (error) throw mapSupabaseError(error, 'Failed to run fill simulation tick.');

  const changedBins = [];

  for (const bin of data) {
    const computedLevel = computeFillLevel(bin.fill_started_at);
    const computedStatus = computedLevel >= 100 ? 'full' : 'empty';

    if (computedLevel === bin.fill_level && computedStatus === bin.status) continue;

    const patch = {
      fill_level: computedLevel,
      status: computedStatus,
      updated_at: new Date().toISOString(),
      fill_started_at: computedLevel >= 100 ? null : bin.fill_started_at,
    };

    const { data: updated, error: updateError } = await supabase.from('bins').update(patch).eq('id', bin.id).select('*').single();
    if (updateError) throw mapSupabaseError(updateError, 'Failed during fill simulation update.');

    changedBins.push(updated);

    if (computedLevel >= 100) {
      await supabase.from('bin_fill_events').insert({
        bin_id: bin.id,
        fill_duration_seconds: FILL_DURATION_MINUTES * 60,
      });
    }
  }

  return changedBins;
}

module.exports = {
  FILL_DURATION_MINUTES,
  COLLECTION_RADIUS_METERS,
  listBinsForUser,
  addBin,
  removeBin,
  collectBin,
  updateBinStatus,
  listNearbyBins,
  runBinFillSimulationTick,
};
