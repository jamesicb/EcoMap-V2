-- Supabase security hardening for EcoMap V2
-- Run in Supabase SQL editor as a privileged role.

begin;

-- Ensure required extension exists for UUID generation.
create extension if not exists pgcrypto;

-- CRM table: authenticated users only.
create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 2 and 80),
  email text check (email is null or char_length(email) <= 320),
  phone text check (phone is null or char_length(phone) <= 40),
  created_at timestamptz not null default now()
);

-- Public quote intake table: supports anonymous insert only.
create table if not exists public.quote_requests (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 2 and 80),
  email text check (email is null or char_length(email) <= 320),
  phone text check (phone is null or char_length(phone) <= 40),
  message text check (message is null or char_length(message) <= 2000),
  created_at timestamptz not null default now()
);

alter table public.customers enable row level security;
alter table public.quote_requests enable row level security;

-- RLS policies are not enough by themselves; the role also needs table privileges.
grant usage on schema public to anon, authenticated;
grant insert on table public.quote_requests to anon;
grant select on table public.quote_requests to authenticated;
grant select, insert, update, delete on table public.customers to authenticated;

-- Remove legacy or overly-permissive policies.
drop policy if exists "Allow anon insert customers" on public.customers;
drop policy if exists "Enable read access for all users" on public.customers;
drop policy if exists "Enable insert for authenticated users only" on public.customers;
drop policy if exists "Enable update for authenticated users only" on public.customers;
drop policy if exists "Enable delete for authenticated users only" on public.customers;
drop policy if exists "Allow anon inserts quote_requests" on public.quote_requests;
drop policy if exists "No public reads quote_requests" on public.quote_requests;
drop policy if exists "Authenticated reads quote_requests" on public.quote_requests;

-- customers: strictly authenticated CRUD.
create policy "Authenticated users can select customers"
  on public.customers
  for select
  to authenticated
  using (true);

create policy "Authenticated users can insert customers"
  on public.customers
  for insert
  to authenticated
  with check (true);

create policy "Authenticated users can update customers"
  on public.customers
  for update
  to authenticated
  using (true)
  with check (true);

create policy "Authenticated users can delete customers"
  on public.customers
  for delete
  to authenticated
  using (true);

-- quote_requests: anonymous inserts only; authenticated can review.
create policy "Allow anon inserts quote_requests"
  on public.quote_requests
  for insert
  to anon
  with check (true);

create policy "Authenticated reads quote_requests"
  on public.quote_requests
  for select
  to authenticated
  using (true);

-- Explicitly deny public reads via policy omission for anon role.

-- Helpful index for inbox sorting/triage.
create index if not exists quote_requests_created_at_idx
  on public.quote_requests (created_at desc);

-- Jobs table hardening for public map use-cases.
create table if not exists public.jobs (
  id uuid primary key default gen_random_uuid(),
  exact_address text,
  area_text text not null default 'Dublin area',
  lat double precision not null,
  lng double precision not null,
  house_type text,
  completed_date text,
  ber_before text,
  ber_after text,
  annual_saving numeric,
  value_increase numeric,
  co2_reduction numeric,
  warmth_gain numeric,
  owner_name text,
  owner_email text,
  owner_phone text,
  consent_to_display boolean not null default false,
  created_at timestamptz not null default now()
);

alter table if exists public.jobs
  add column if not exists consent_to_display boolean not null default false;
alter table if exists public.jobs
  add column if not exists area_text text not null default 'Dublin area';
alter table if exists public.jobs
  add column if not exists exact_address text;

alter table public.jobs enable row level security;

grant select on table public.jobs to anon, authenticated;

drop policy if exists "Public can read consented jobs only" on public.jobs;
create policy "Public can read consented jobs only"
  on public.jobs
  for select
  to anon, authenticated
  using (consent_to_display = true);

-- Deterministic coordinate blur (300-500m) for public payloads.
create or replace function public.blur_coord(
  p_lat double precision,
  p_lng double precision,
  p_seed text
) returns table (lat double precision, lng double precision)
language sql
stable
as $$
with s as (
  select ('x' || substr(md5(coalesce(p_seed, '')), 1, 8))::bit(32)::int as seed
),
rand as (
  select
    abs(sin(seed::double precision * 12.9898)) as r1,
    abs(sin(seed::double precision * 78.233)) as r2
  from s
),
params as (
  select
    (300 + (r1 * 200))::double precision as dist_m,
    (r2 * 2 * pi())::double precision as bearing
  from rand
),
geo as (
  select
    radians(p_lat) as lat1,
    radians(p_lng) as lng1,
    dist_m / 6371000.0 as ad,
    bearing
  from params
),
pt as (
  select
    asin(sin(lat1) * cos(ad) + cos(lat1) * sin(ad) * cos(bearing)) as lat2,
    lng1 + atan2(
      sin(bearing) * sin(ad) * cos(lat1),
      cos(ad) - sin(lat1) * sin(asin(sin(lat1) * cos(ad) + cos(lat1) * sin(ad) * cos(bearing)))
    ) as lng2
  from geo
)
select degrees(lat2) as lat, degrees(lng2) as lng
from pt;
$$;

create or replace view public.public_jobs_map as
select
  j.id,
  coalesce(nullif(trim(j.area_text), ''), 'Dublin area') as area_text,
  b.lat as lat,
  b.lng as lng,
  j.house_type,
  j.completed_date,
  j.ber_before,
  j.ber_after,
  j.annual_saving,
  j.value_increase,
  j.co2_reduction,
  j.warmth_gain
from public.jobs j
cross join lateral public.blur_coord(j.lat, j.lng, j.id::text) b
where j.consent_to_display = true;

grant select on public.public_jobs_map to anon, authenticated;

commit;
