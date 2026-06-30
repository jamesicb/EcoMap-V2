-- EcoMap V2 — quote intake migration (replaces the old insecure customers-setup.sql)
-- Run once in Supabase Dashboard → SQL Editor.
-- For a fresh project, run security_hardening.sql instead (it includes everything below).

begin;

-- Ensure quote_requests exists (public enquiries — anon insert only).
create table if not exists public.quote_requests (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 2 and 80),
  email text check (email is null or char_length(email) <= 320),
  phone text check (phone is null or char_length(phone) <= 40),
  message text check (message is null or char_length(message) <= 2000),
  created_at timestamptz not null default now()
);

alter table public.quote_requests enable row level security;

grant usage on schema public to anon, authenticated;
grant insert on table public.quote_requests to anon;
grant select on table public.quote_requests to authenticated;

-- Remove legacy permissive anon access to CRM customers table.
revoke select, insert, update, delete on table public.customers from anon;

drop policy if exists "customers_anon_select" on public.customers;
drop policy if exists "customers_anon_insert" on public.customers;
drop policy if exists "customers_anon_update" on public.customers;
drop policy if exists "customers_anon_delete" on public.customers;

drop policy if exists "Allow anon inserts quote_requests" on public.quote_requests;
create policy "Allow anon inserts quote_requests"
  on public.quote_requests for insert to anon with check (true);

drop policy if exists "Authenticated reads quote_requests" on public.quote_requests;
create policy "Authenticated reads quote_requests"
  on public.quote_requests for select to authenticated using (true);

-- Public quote form: controlled insert into quote_requests (not customers).
create or replace function public.submit_quote_enquiry(
  p_name text,
  p_email text default null,
  p_phone text default null,
  p_message text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_id uuid;
begin
  if coalesce(trim(p_name), '') = '' then
    raise exception 'Name is required';
  end if;

  insert into public.quote_requests (name, email, phone, message)
  values (
    trim(p_name),
    nullif(trim(coalesce(p_email, '')), ''),
    nullif(trim(coalesce(p_phone, '')), ''),
    nullif(trim(coalesce(p_message, '')), '')
  )
  returning id into new_id;

  return new_id;
end;
$$;

revoke all on function public.submit_quote_enquiry(text, text, text, text) from public;
grant execute on function public.submit_quote_enquiry(text, text, text, text) to anon, authenticated;

create index if not exists quote_requests_created_at_idx
  on public.quote_requests (created_at desc);

commit;
