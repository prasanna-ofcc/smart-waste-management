require('dotenv').config();
const bcrypt = require('bcryptjs');
const { supabase } = require('../db/supabase');

const USERS = [
  { name: 'Admin', email: 'admin@test.com', password: '123456', role: 'admin', worker_status: 'inactive' },
  { name: 'Worker 1', email: 'worker1@test.com', password: '123456', role: 'worker', worker_status: 'active' },
  { name: 'Worker 2', email: 'worker2@test.com', password: '123456', role: 'worker', worker_status: 'active' },
];

const ZONES = [
  { name: 'Srirangam', center_lat: 10.8623, center_lng: 78.6938, radius_km: 6 },
  { name: 'Thillai Nagar', center_lat: 10.8173, center_lng: 78.6824, radius_km: 6 },
];

const BIN_SEEDS = [
  { zone: 'Srirangam', label: 'BIN-SR-01', location: 'Srirangam - Amma Mandapam', lat: 10.8604, lng: 78.6923, fill_level: 12, status: 'empty' },
  { zone: 'Srirangam', label: 'BIN-SR-02', location: 'Srirangam - Rajagopuram East', lat: 10.8627, lng: 78.6955, fill_level: 35, status: 'empty' },
  { zone: 'Srirangam', label: 'BIN-SR-03', location: 'Srirangam - Chithirai Street', lat: 10.8641, lng: 78.6907, fill_level: 78, status: 'full' },
  { zone: 'Srirangam', label: 'BIN-SR-04', location: 'Srirangam - Vellai Gopuram', lat: 10.8596, lng: 78.6971, fill_level: 50, status: 'empty' },
  { zone: 'Srirangam', label: 'BIN-SR-05', location: 'Srirangam - Gandhi Road', lat: 10.8662, lng: 78.6915, fill_level: 91, status: 'full' },
  { zone: 'Srirangam', label: 'BIN-SR-06', location: 'Srirangam - Uthamar Koil Junction', lat: 10.8698, lng: 78.6884, fill_level: 28, status: 'empty' },
  { zone: 'Srirangam', label: 'BIN-SR-07', location: 'Srirangam - Mambazha Salai', lat: 10.8578, lng: 78.6899, fill_level: 64, status: 'full' },
  { zone: 'Srirangam', label: 'BIN-SR-08', location: 'Srirangam - North Gate', lat: 10.8655, lng: 78.6988, fill_level: 18, status: 'empty' },
  { zone: 'Srirangam', label: 'BIN-SR-09', location: 'Srirangam - Kambarasampettai Link', lat: 10.8549, lng: 78.6942, fill_level: 43, status: 'empty' },
  { zone: 'Srirangam', label: 'BIN-SR-10', location: 'Srirangam - Railway Station Road', lat: 10.8612, lng: 78.6872, fill_level: 87, status: 'full' },
  { zone: 'Thillai Nagar', label: 'BIN-TN-01', location: 'Thillai Nagar - 1st Cross', lat: 10.8188, lng: 78.6799, fill_level: 21, status: 'empty' },
  { zone: 'Thillai Nagar', label: 'BIN-TN-02', location: 'Thillai Nagar - 2nd Cross', lat: 10.8201, lng: 78.6815, fill_level: 56, status: 'empty' },
  { zone: 'Thillai Nagar', label: 'BIN-TN-03', location: 'Thillai Nagar - 3rd Cross', lat: 10.821, lng: 78.6832, fill_level: 93, status: 'full' },
  { zone: 'Thillai Nagar', label: 'BIN-TN-04', location: 'Thillai Nagar - 4th Cross', lat: 10.8162, lng: 78.6844, fill_level: 33, status: 'empty' },
  { zone: 'Thillai Nagar', label: 'BIN-TN-05', location: 'Thillai Nagar - 5th Cross', lat: 10.8149, lng: 78.6801, fill_level: 72, status: 'full' },
  { zone: 'Thillai Nagar', label: 'BIN-TN-06', location: 'Thillai Nagar - 6th Cross', lat: 10.8137, lng: 78.6826, fill_level: 47, status: 'empty' },
  { zone: 'Thillai Nagar', label: 'BIN-TN-07', location: 'Thillai Nagar - Bharathidasan Salai', lat: 10.8197, lng: 78.6861, fill_level: 88, status: 'full' },
  { zone: 'Thillai Nagar', label: 'BIN-TN-08', location: 'Thillai Nagar - Salai Road Junction', lat: 10.8128, lng: 78.6787, fill_level: 14, status: 'empty' },
  { zone: 'Thillai Nagar', label: 'BIN-TN-09', location: 'Thillai Nagar - Collector Office Road', lat: 10.8158, lng: 78.6769, fill_level: 61, status: 'empty' },
  { zone: 'Thillai Nagar', label: 'BIN-TN-10', location: 'Thillai Nagar - Karur Bypass Link', lat: 10.8119, lng: 78.6853, fill_level: 95, status: 'full' },
];

function isMissingTableError(error) {
  const msg = String(error?.message || '').toLowerCase();
  return msg.includes('could not find the table') || msg.includes('does not exist');
}

function isMissingColumnError(error) {
  const msg = String(error?.message || '').toLowerCase();
  return msg.includes('column') && (msg.includes('schema cache') || msg.includes('does not exist'));
}

async function detectWorkerZoneTable() {
  const candidates = ['worker_zones', 'workers_zones'];
  for (const table of candidates) {
    const { error } = await supabase.from(table).select('worker_id').limit(1);
    if (!error) return table;
    if (!isMissingTableError(error)) throw error;
  }
  throw new Error('Neither worker_zones nor workers_zones table exists. Run db/schema.sql first.');
}

async function seedUsers() {
  const payload = [];
  for (const user of USERS) {
    const hash = await bcrypt.hash(user.password, 10);
    payload.push({
      name: user.name,
      email: user.email,
      password_hash: hash,
      role: user.role,
      worker_status: user.worker_status,
    });
  }

  const { error } = await supabase.from('users').upsert(payload, { onConflict: 'email' });
  if (error) throw error;
}

async function seedZones(adminId) {
  const payload = ZONES.map((zone) => ({ ...zone, created_by: adminId }));
  const { error } = await supabase.from('zones').upsert(payload, { onConflict: 'name' });
  if (error) throw error;
}

async function seedWorkerAssignments(worker1Id, worker2Id, srirangamId, thillaiId, adminId) {
  const mappingTable = await detectWorkerZoneTable();
  const payload = [
    { worker_id: worker1Id, zone_id: srirangamId, assigned_by: adminId },
    { worker_id: worker2Id, zone_id: thillaiId, assigned_by: adminId },
  ];

  const { error } = await supabase.from(mappingTable).upsert(payload, { onConflict: 'worker_id,zone_id' });
  if (error) throw error;

  const { error: workerUpdateError } = await supabase.from('users').upsert([
    { id: worker1Id, zone_id: srirangamId, worker_status: 'active' },
    { id: worker2Id, zone_id: thillaiId, worker_status: 'active' },
  ]);

  // Safer: perform explicit updates to avoid inserting partial user rows
  // (which can violate NOT NULL constraints like `name`). Use update() when
  // we have the user ids, otherwise throw a clear error so the seed doesn't
  // attempt an insert with missing fields.
  if (!worker1Id || !worker2Id) {
    throw new Error('Worker IDs not found when assigning zones. Ensure users were seeded correctly.');
  }

  const { error: update1 } = await supabase
    .from('users')
    .update({ zone_id: srirangamId, worker_status: 'active' })
    .eq('id', worker1Id);
  if (update1) throw update1;

  const { error: update2 } = await supabase
    .from('users')
    .update({ zone_id: thillaiId, worker_status: 'active' })
    .eq('id', worker2Id);
  if (update2) throw update2;
}

async function seedBins(adminId, zoneMap) {
  const labels = BIN_SEEDS.map((b) => b.label);
  const { error: deleteError } = await supabase.from('bins').delete().in('label', labels);
  if (deleteError) throw deleteError;

  const { error: locationColumnError } = await supabase.from('bins').select('location').limit(1);
  const hasLocationColumn = !locationColumnError || !isMissingColumnError(locationColumnError);

  const payload = BIN_SEEDS.map((bin) => ({
    ...(hasLocationColumn
      ? {
          zone_id: zoneMap.get(bin.zone),
          label: bin.label,
          location: bin.location,
          lat: bin.lat,
          lng: bin.lng,
          fill_level: bin.fill_level,
          status: bin.status,
          created_by: adminId,
        }
      : {
          zone_id: zoneMap.get(bin.zone),
          label: bin.label,
          lat: bin.lat,
          lng: bin.lng,
          fill_level: bin.fill_level,
          status: bin.status,
          created_by: adminId,
        }),
  }));

  const { error } = await supabase.from('bins').insert(payload);
  if (error) throw error;
}

async function getUserByEmail(email) {
  const { data, error } = await supabase.from('users').select('id,email').eq('email', email).maybeSingle();
  if (error) throw error;
  return data;
}

async function getZoneByName(name) {
  const { data, error } = await supabase.from('zones').select('id,name').eq('name', name).maybeSingle();
  if (error) throw error;
  return data;
}

async function main() {
  await seedUsers();

  const admin = await getUserByEmail('admin@test.com');
  const worker1 = await getUserByEmail('worker1@test.com');
  const worker2 = await getUserByEmail('worker2@test.com');

  await supabase
    .from('users')
    .update({ location_lat: 10.8173, location_lng: 78.6824 })
    .eq('id', worker2.id)
    .eq('role', 'worker');

  await seedZones(admin.id);

  const srirangam = await getZoneByName('Srirangam');
  const thillaiNagar = await getZoneByName('Thillai Nagar');

  await seedWorkerAssignments(worker1.id, worker2.id, srirangam.id, thillaiNagar.id, admin.id);

  const zoneMap = new Map([
    ['Srirangam', srirangam.id],
    ['Thillai Nagar', thillaiNagar.id],
  ]);
  await seedBins(admin.id, zoneMap);

  console.log('Supabase seed completed successfully.');
}

main().catch((err) => {
  console.error('Seed failed:', err.message || err);
  process.exit(1);
});
