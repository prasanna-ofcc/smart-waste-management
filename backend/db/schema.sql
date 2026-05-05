create extension if not exists pgcrypto;

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null unique,
  password_hash text not null,
  phone text,
  profile_image text,
  role text not null check (role in ('admin', 'worker', 'public')),
  worker_status text not null default 'inactive' check (worker_status in ('active', 'inactive')),
  location_lat double precision,
  location_lng double precision,
  zone_id uuid references zones(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists zones (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  center_lat double precision not null,
  center_lng double precision not null,
  radius_km double precision not null default 6 check (radius_km > 0),
  created_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists worker_zones (
  worker_id uuid not null references users(id) on delete cascade,
  zone_id uuid not null references zones(id) on delete cascade,
  assigned_by uuid references users(id) on delete set null,
  assigned_at timestamptz not null default now(),
  primary key (worker_id, zone_id)
);

create table if not exists bins (
  id uuid primary key default gen_random_uuid(),
  label text,
  zone_id uuid not null references zones(id) on delete restrict,
  location text,
  lat double precision,
  lng double precision,
  status text not null default 'empty' check (status in ('empty', 'full', 'collected')),
  fill_level integer not null default 0 check (fill_level >= 0 and fill_level <= 100),
  fill_started_at timestamptz,
  last_collected_at timestamptz,
  created_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$
begin
  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'workers_zones'
  ) and not exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'worker_zones'
  ) then
    execute 'alter table public.workers_zones rename to worker_zones';
  end if;
end
$$;

alter table if exists bins
  alter column lat drop not null,
  alter column lng drop not null;

alter table if exists bins
  add column if not exists location text;

alter table if exists users
  add column if not exists profile_image text;

alter table if exists users
  add column if not exists zone_id uuid references zones(id) on delete set null;

alter table if exists bins
  add column if not exists label text;

update bins
set label = coalesce(label, location, 'BIN-' || substr(id::text, 1, 8))
where label is null;

alter table if exists bins
  alter column label set default null;

do $$
begin
  alter table bins drop constraint if exists bins_status_check;
  alter table bins add constraint bins_status_check check (status in ('empty', 'full', 'collected'));
exception
  when undefined_table then null;
end
$$;

do $$
begin
  -- Only create the legacy compatibility view when the name is available
  -- (or already a view). If workers_zones is a table, keep it as-is.
  if exists (
    select 1
    from information_schema.views
    where table_schema = 'public'
      and table_name = 'workers_zones'
  ) then
    execute 'create or replace view workers_zones as select worker_id, zone_id, assigned_by, assigned_at from worker_zones';
  elsif not exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'workers_zones'
  ) then
    execute 'create view workers_zones as select worker_id, zone_id, assigned_by, assigned_at from worker_zones';
  end if;
end
$$;

create table if not exists requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete set null,
  request_type text not null check (request_type in ('garbage_collection', 'new_bin_placement')),
  location_lat double precision not null,
  location_lng double precision not null,
  address text,
  description text,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'completed', 'rejected')),
  accepted_by uuid references users(id) on delete set null,
  accepted_at timestamptz,
  completed_by uuid references users(id) on delete set null,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists worker_logs (
  id uuid primary key default gen_random_uuid(),
  worker_id uuid not null references users(id) on delete cascade,
  action text not null,
  bin_id uuid references bins(id) on delete set null,
  request_id uuid references requests(id) on delete set null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists activity_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete set null,
  action_type text not null,
  entity_type text,
  entity_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists bin_fill_events (
  id uuid primary key default gen_random_uuid(),
  bin_id uuid not null references bins(id) on delete cascade,
  filled_at timestamptz not null default now(),
  fill_duration_seconds integer
);

create table if not exists collections (
  id uuid primary key default gen_random_uuid(),
  bin_id uuid not null references bins(id) on delete cascade,
  worker_id uuid not null references users(id) on delete cascade,
  collected_at timestamptz not null default now(),
  worker_lat double precision not null,
  worker_lng double precision not null,
  bin_lat double precision not null,
  bin_lng double precision not null,
  distance_meters double precision not null,
  unique (bin_id, collected_at)
);

create index if not exists idx_users_role on users(role);
create index if not exists idx_users_zone on users(zone_id);
create index if not exists idx_bins_zone on bins(zone_id);
create index if not exists idx_requests_status on requests(status);
create index if not exists idx_requests_type on requests(request_type);
create index if not exists idx_worker_logs_worker on worker_logs(worker_id);
create index if not exists idx_activity_logs_user on activity_logs(user_id);
create index if not exists idx_collections_worker on collections(worker_id);
create index if not exists idx_collections_bin on collections(bin_id);
