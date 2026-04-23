-- Add a bin (admin)
insert into bins (label, zone_id, lat, lng, status, fill_level, fill_started_at, created_by)
values (
  'Bin #101 - City Center',
  'ZONE_UUID_HERE',
  10.82450,
  78.68800,
  'empty',
  0,
  now(),
  'ADMIN_USER_UUID_HERE'
)
returning *;

-- Assign worker to zone
insert into workers_zones (worker_id, zone_id, assigned_by)
values (
  'WORKER_UUID_HERE',
  'ZONE_UUID_HERE',
  'ADMIN_USER_UUID_HERE'
)
on conflict (worker_id, zone_id) do update set assigned_by = excluded.assigned_by, assigned_at = now()
returning *;

-- Update bin status to collected -> reset fill cycle
update bins
set
  status = 'empty',
  fill_level = 0,
  fill_started_at = now(),
  last_collected_at = now(),
  updated_at = now()
where id = 'BIN_UUID_HERE'
returning *;
