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

commit;
