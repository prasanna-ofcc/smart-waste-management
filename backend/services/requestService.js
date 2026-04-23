const { supabase } = require('../db/supabase');
const { AppError, mapSupabaseError } = require('../utils/errors');
const { getWorkerZoneIds } = require('./zoneService');
const { logActivity, logWorker } = require('./activityService');

async function createRequest({ userId = null, type, locationLat, locationLng, address = '', description = '' }) {
  const payload = {
    user_id: userId,
    request_type: type,
    location_lat: locationLat,
    location_lng: locationLng,
    address,
    description,
    status: 'pending',
  };

  const { data, error } = await supabase.from('requests').insert(payload).select('*').single();
  if (error) throw mapSupabaseError(error, 'Failed to create request.');

  await logActivity({
    userId,
    actionType: 'REQUEST_CREATED',
    entityType: 'request',
    entityId: data.id,
    metadata: { type },
  });

  return data;
}

async function listRequests({ role, userId }) {
  let query = supabase.from('requests').select('*').order('created_at', { ascending: false });

  if (role === 'public') {
    query = query.eq('user_id', userId);
  }

  if (role === 'worker') {
    query = query.or(`accepted_by.eq.${userId},status.eq.pending`);
  }

  const { data, error } = await query;
  if (error) throw mapSupabaseError(error, 'Failed to fetch requests.');
  return data;
}

async function acceptRequest({ requestId, worker }) {
  const { data: request, error: requestError } = await supabase.from('requests').select('*').eq('id', requestId).single();
  if (requestError) throw mapSupabaseError(requestError, 'Failed to load request.');

  if (request.status !== 'pending') {
    throw new AppError('Only pending requests can be accepted.', 400);
  }

  const zoneIds = await getWorkerZoneIds(worker.id);
  if (!zoneIds.length) throw new AppError('Worker has no assigned zone.', 403);

  const { data: zones, error: zonesError } = await supabase
    .from('zones')
    .select('id,center_lat,center_lng,radius_km')
    .in('id', zoneIds);

  if (zonesError) throw mapSupabaseError(zonesError, 'Failed to validate worker zones.');

  const toRad = (v) => (v * Math.PI) / 180;
  const distanceKm = (aLat, aLng, bLat, bLng) => {
    const R = 6371;
    const dLat = toRad(bLat - aLat);
    const dLng = toRad(bLng - aLng);
    const x = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
  };

  const insideAnyZone = zones.some((zone) => distanceKm(request.location_lat, request.location_lng, zone.center_lat, zone.center_lng) <= zone.radius_km);

  if (!insideAnyZone) {
    throw new AppError('Request is outside worker assigned zones.', 403);
  }

  const nowIso = new Date().toISOString();
  const { data, error } = await supabase
    .from('requests')
    .update({
      status: 'accepted',
      accepted_by: worker.id,
      accepted_at: nowIso,
      updated_at: nowIso,
    })
    .eq('id', requestId)
    .select('*')
    .single();

  if (error) throw mapSupabaseError(error, 'Failed to accept request.');

  await logWorker({ workerId: worker.id, action: 'REQUEST_ACCEPTED', requestId, details: { requestType: request.request_type } });
  await logActivity({ userId: worker.id, actionType: 'REQUEST_ACCEPTED', entityType: 'request', entityId: requestId, metadata: {} });

  return data;
}

async function completeRequest({ requestId, worker }) {
  const { data: request, error: requestError } = await supabase.from('requests').select('*').eq('id', requestId).single();
  if (requestError) throw mapSupabaseError(requestError, 'Failed to load request.');

  if (worker.role !== 'admin' && request.accepted_by !== worker.id) {
    throw new AppError('Only assigned worker can complete this request.', 403);
  }

  const nowIso = new Date().toISOString();
  const { data, error } = await supabase
    .from('requests')
    .update({
      status: 'completed',
      completed_by: worker.id,
      completed_at: nowIso,
      updated_at: nowIso,
    })
    .eq('id', requestId)
    .select('*')
    .single();

  if (error) throw mapSupabaseError(error, 'Failed to complete request.');

  await logWorker({ workerId: worker.id, action: 'REQUEST_COMPLETED', requestId, details: { requestType: request.request_type } });
  await logActivity({ userId: worker.id, actionType: 'REQUEST_COMPLETED', entityType: 'request', entityId: requestId, metadata: {} });

  return data;
}

module.exports = {
  createRequest,
  listRequests,
  acceptRequest,
  completeRequest,
};
