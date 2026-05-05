create extension if not exists pgcrypto;

-- Ensure compatibility with older schemas: add `zone_id` to `users` if missing.
-- This avoids seed failures when `users.zone_id` does not exist in the target DB.
alter table users add column if not exists zone_id uuid;

-- 1) Seed fixed users with initial locations
insert into users (name, email, password_hash, role, worker_status, location_lat, location_lng)
values
  ('Admin', 'admin@test.com', crypt('123456', gen_salt('bf')), 'admin', 'inactive', 10.8700, 78.6950),
  ('Worker 1', 'worker1@test.com', crypt('123456', gen_salt('bf')), 'worker', 'active', 10.8623, 78.6938),
  ('Worker 2', 'worker2@test.com', crypt('123456', gen_salt('bf')), 'worker', 'active', 10.8173, 78.6824)
on conflict (email) do update
set
  name = excluded.name,
  password_hash = excluded.password_hash,
  role = excluded.role,
  worker_status = excluded.worker_status,
  location_lat = excluded.location_lat,
  location_lng = excluded.location_lng,
  updated_at = now();

-- 2) Seed zones (radius 6 km)
with admin_user as (
  select id from users where email = 'admin@test.com' limit 1
)
insert into zones (name, center_lat, center_lng, radius_km, created_by)
values
  ('Srirangam', 10.8623, 78.6938, 6, (select id from admin_user)),
  ('Thillai Nagar', 10.8173, 78.6824, 6, (select id from admin_user))
on conflict (name) do update
set
  center_lat = excluded.center_lat,
  center_lng = excluded.center_lng,
  radius_km = excluded.radius_km;

-- 3) Assign workers to zones (many-to-many) and update their zone_id
with worker_assignments as (
  select u.id as worker_id, z.id as zone_id, a.id as assigned_by
  from users u
  join zones z on (
    (u.email = 'worker1@test.com' and z.name = 'Srirangam') or
    (u.email = 'worker2@test.com' and z.name = 'Thillai Nagar')
  )
  left join users a on a.email = 'admin@test.com'
)
insert into worker_zones (worker_id, zone_id, assigned_by)
select worker_id, zone_id, assigned_by from worker_assignments
on conflict (worker_id, zone_id) do nothing;

-- Update user.zone_id to match their primary zone assignment (always update to ensure consistency)
update users u
set zone_id = (
  select zone_id from worker_zones
  where worker_id = u.id
  limit 1
),
worker_status = 'active'
where role = 'worker' and exists (
  select 1 from worker_zones where worker_id = u.id
);

-- 4) Seed bins (20 total)
delete from bins
where location like 'Srirangam - Bin %'
   or location like 'Thillai Nagar - Bin %';

with zone_ids as (
  select id, name from zones where name in ('Srirangam', 'Thillai Nagar')
),
admin_user as (
  select id from users where email = 'admin@test.com' limit 1
)
insert into bins (zone_id, label, location, lat, lng, fill_level, status, created_by)
select z.id,
       seed.label,
       seed.location,
       seed.lat,
       seed.lng,
       seed.fill_level,
       seed.status,
       (select id from admin_user)
from zone_ids z
join (
  values
    -- Srirangam (10 bins)
    ('Srirangam', 'BIN-SR-01', 'Srirangam - Amma Mandapam', 10.8604, 78.6923, 12, 'empty'),
    ('Srirangam', 'BIN-SR-02', 'Srirangam - Rajagopuram East', 10.8627, 78.6955, 35, 'empty'),
    ('Srirangam', 'BIN-SR-03', 'Srirangam - Chithirai Street', 10.8641, 78.6907, 78, 'full'),
    ('Srirangam', 'BIN-SR-04', 'Srirangam - Vellai Gopuram', 10.8596, 78.6971, 50, 'empty'),
    ('Srirangam', 'BIN-SR-05', 'Srirangam - Gandhi Road', 10.8662, 78.6915, 91, 'full'),
    ('Srirangam', 'BIN-SR-06', 'Srirangam - Uthamar Koil Junction', 10.8698, 78.6884, 28, 'empty'),
    ('Srirangam', 'BIN-SR-07', 'Srirangam - Mambazha Salai', 10.8578, 78.6899, 64, 'full'),
    ('Srirangam', 'BIN-SR-08', 'Srirangam - North Gate', 10.8655, 78.6988, 18, 'empty'),
    ('Srirangam', 'BIN-SR-09', 'Srirangam - Kambarasampettai Link', 10.8549, 78.6942, 43, 'empty'),
    ('Srirangam', 'BIN-SR-10', 'Srirangam - Railway Station Road', 10.8612, 78.6872, 87, 'full'),

    -- Thillai Nagar (10 bins)
    ('Thillai Nagar', 'BIN-TN-01', 'Thillai Nagar - 1st Cross', 10.8188, 78.6799, 21, 'empty'),
    ('Thillai Nagar', 'BIN-TN-02', 'Thillai Nagar - 2nd Cross', 10.8201, 78.6815, 56, 'empty'),
    ('Thillai Nagar', 'BIN-TN-03', 'Thillai Nagar - 3rd Cross', 10.8210, 78.6832, 93, 'full'),
    ('Thillai Nagar', 'BIN-TN-04', 'Thillai Nagar - 4th Cross', 10.8162, 78.6844, 33, 'empty'),
    ('Thillai Nagar', 'BIN-TN-05', 'Thillai Nagar - 5th Cross', 10.8149, 78.6801, 72, 'full'),
    ('Thillai Nagar', 'BIN-TN-06', 'Thillai Nagar - 6th Cross', 10.8137, 78.6826, 47, 'empty'),
    ('Thillai Nagar', 'BIN-TN-07', 'Thillai Nagar - Bharathidasan Salai', 10.8197, 78.6861, 88, 'full'),
    ('Thillai Nagar', 'BIN-TN-08', 'Thillai Nagar - Salai Road Junction', 10.8128, 78.6787, 14, 'empty'),
    ('Thillai Nagar', 'BIN-TN-09', 'Thillai Nagar - Collector Office Road', 10.8158, 78.6769, 61, 'empty'),
    ('Thillai Nagar', 'BIN-TN-10', 'Thillai Nagar - Karur Bypass Link', 10.8119, 78.6853, 95, 'full')
) as seed(zone_name, label, location, lat, lng, fill_level, status)
  on seed.zone_name = z.name;
