const { supabase } = require('../db/supabase');
const { mapSupabaseError } = require('../utils/errors');

let workerZoneTableCache = null;

function isMissingTableError(error) {
  const msg = String(error?.message || '').toLowerCase();
  return msg.includes("could not find the table") || msg.includes('does not exist');
}

async function getWorkerZoneTable() {
  if (workerZoneTableCache) return workerZoneTableCache;

  const checks = ['worker_zones', 'workers_zones'];
  for (const table of checks) {
    const { error } = await supabase.from(table).select('worker_id').limit(1);
    if (!error) {
      workerZoneTableCache = table;
      return workerZoneTableCache;
    }
    if (!isMissingTableError(error)) {
      throw mapSupabaseError(error, 'Failed to detect worker-zone mapping table.');
    }
  }

  throw mapSupabaseError({ message: 'Neither worker_zones nor workers_zones table exists.' }, 'Worker-zone mapping table is missing.');
}

async function createZone({ name, centerLat, centerLng, radiusKm = 6, createdBy }) {
  const { data, error } = await supabase
    .from('zones')
    .insert({
      name,
      center_lat: centerLat,
      center_lng: centerLng,
      radius_km: radiusKm,
      created_by: createdBy,
    })
    .select('*')
    .single();

  if (error) throw mapSupabaseError(error, 'Failed to create zone.');
  return data;
}

async function listZones() {
  const { data, error } = await supabase.from('zones').select('*').order('created_at', { ascending: false });
  if (error) throw mapSupabaseError(error, 'Failed to fetch zones.');
  return data;
}

async function assignWorkerToZone({ workerId, zoneId, assignedBy }) {
  const mappingTable = await getWorkerZoneTable();
  const { data, error } = await supabase
    .from(mappingTable)
    .upsert({ worker_id: workerId, zone_id: zoneId, assigned_by: assignedBy }, { onConflict: 'worker_id,zone_id' })
    .select('*')
    .single();

  if (error) throw mapSupabaseError(error, 'Failed to assign worker to zone.');

  const { error: workerUpdateError } = await supabase
    .from('users')
    .update({ zone_id: zoneId, worker_status: 'active', updated_at: new Date().toISOString() })
    .eq('id', workerId)
    .eq('role', 'worker');

  if (workerUpdateError) throw mapSupabaseError(workerUpdateError, 'Failed to sync worker zone.');
  return data;
}

async function setWorkerZones({ workerId, zoneIds, assignedBy }) {
  const mappingTable = await getWorkerZoneTable();
  const { error: deleteError } = await supabase.from(mappingTable).delete().eq('worker_id', workerId);
  if (deleteError) throw mapSupabaseError(deleteError, 'Failed to reset worker zones.');

  if (!zoneIds.length) {
    const { error: workerUpdateError } = await supabase
      .from('users')
      .update({ zone_id: null, worker_status: 'inactive', updated_at: new Date().toISOString() })
      .eq('id', workerId)
      .eq('role', 'worker');

    if (workerUpdateError) throw mapSupabaseError(workerUpdateError, 'Failed to clear worker zone.');
    return [];
  }

  const rows = zoneIds.map((zoneId) => ({ worker_id: workerId, zone_id: zoneId, assigned_by: assignedBy }));
  const { data, error } = await supabase.from(mappingTable).insert(rows).select('*');
  if (error) throw mapSupabaseError(error, 'Failed to assign worker zones.');

  const { error: workerUpdateError } = await supabase
    .from('users')
    .update({ zone_id: zoneIds[0], worker_status: 'active', updated_at: new Date().toISOString() })
    .eq('id', workerId)
    .eq('role', 'worker');

  if (workerUpdateError) throw mapSupabaseError(workerUpdateError, 'Failed to sync worker zone.');
  return data;
}

async function getWorkerPrimaryZoneId(workerId) {
  try {
    const { data, error } = await supabase.from('users').select('zone_id').eq('id', workerId).maybeSingle();
    if (error) {
      // If column doesn't exist, fall back to mapping table
      console.error('[GET_PRIMARY_ZONE_ERROR]', { workerId, message: error.message });
    } else if (data?.zone_id) {
      return data.zone_id;
    }
  } catch (err) {
    console.error('[GET_PRIMARY_ZONE_EXCEPTION]', { workerId, message: err.message });
  }

  // Fallback: read mapping table (worker_zones / workers_zones)
  const zoneIds = await getWorkerZoneIds(workerId);
  return zoneIds[0] || null;
}

async function getWorkerZoneIds(workerId) {
  const mappingTable = await getWorkerZoneTable();
  const { data, error } = await supabase.from(mappingTable).select('zone_id').eq('worker_id', workerId);
  if (error) {
    console.error('[GET_WORKER_ZONE_IDS_ERROR]', { workerId, error: error.message });
    throw mapSupabaseError(error, 'Failed to fetch worker zones.');
  }
  const zoneIds = data.map((row) => row.zone_id);
  console.log('[GET_WORKER_ZONE_IDS]', { workerId, zoneIds, count: zoneIds.length });
  return zoneIds;
}

async function getAssignedZonesForWorker(workerId) {
  const zoneIds = await getWorkerZoneIds(workerId);
  if (!zoneIds.length) return [];

  const { data, error } = await supabase
    .from('zones')
    .select('id,name,center_lat,center_lng,radius_km')
    .in('id', zoneIds)
    .order('name', { ascending: true });

  if (error) throw mapSupabaseError(error, 'Failed to fetch assigned zones.');
  return data;
}

module.exports = {
  createZone,
  listZones,
  assignWorkerToZone,
  setWorkerZones,
  getWorkerZoneIds,
  getWorkerPrimaryZoneId,
  getAssignedZonesForWorker,
};
