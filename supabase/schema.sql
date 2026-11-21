-- TRIPPIN: run this once in your Supabase project (SQL Editor → New query → Run).
-- It creates one private table for all trip data and one private file bucket.
-- Only the email addresses you list in allowed_users can read or write anything.

create table if not exists public.records (
  id text primary key,
  tbl text not null,
  trip_id text,
  data jsonb not null,
  updated_at bigint not null,
  deleted boolean not null default false,
  server_ts timestamptz not null default now()
);
create index if not exists records_server_ts on public.records (server_ts);

create or replace function public.trippin_bump_ts() returns trigger language plpgsql as $$
begin
  new.server_ts = now();
  return new;
end $$;
drop trigger if exists records_ts on public.records;
create trigger records_ts before insert or update on public.records
  for each row execute function public.trippin_bump_ts();

create table if not exists public.allowed_users (email text primary key);

alter table public.records enable row level security;
alter table public.allowed_users enable row level security;

drop policy if exists "see own allow-list row" on public.allowed_users;
create policy "see own allow-list row" on public.allowed_users
  for select to authenticated using (email = auth.jwt() ->> 'email');

drop policy if exists "family only" on public.records;
create policy "family only" on public.records
  for all to authenticated
  using ((auth.jwt() ->> 'email') in (select email from public.allowed_users))
  with check ((auth.jwt() ->> 'email') in (select email from public.allowed_users));

insert into storage.buckets (id, name, public) values ('trippin', 'trippin', false)
  on conflict (id) do nothing;

drop policy if exists "family files" on storage.objects;
create policy "family files" on storage.objects
  for all to authenticated
  using (bucket_id = 'trippin' and (auth.jwt() ->> 'email') in (select email from public.allowed_users))
  with check (bucket_id = 'trippin' and (auth.jwt() ->> 'email') in (select email from public.allowed_users));

-- Put your two email addresses here (yours and Mom's), then run again:
-- insert into public.allowed_users (email) values ('you@example.com'), ('mom@example.com');

-- Robust version of the access rules (ignores capital letters and stray spaces in emails).
drop policy if exists "see own allow-list row" on public.allowed_users;
create policy "see own allow-list row" on public.allowed_users for select to authenticated
  using (lower(trim(email)) = lower(auth.jwt() ->> 'email'));
drop policy if exists "family only" on public.records;
create policy "family only" on public.records for all to authenticated
  using (exists (select 1 from public.allowed_users a where lower(trim(a.email)) = lower(auth.jwt() ->> 'email')))
  with check (exists (select 1 from public.allowed_users a where lower(trim(a.email)) = lower(auth.jwt() ->> 'email')));
drop policy if exists "family files" on storage.objects;
create policy "family files" on storage.objects for all to authenticated
  using (bucket_id = 'trippin' and exists (select 1 from public.allowed_users a where lower(trim(a.email)) = lower(auth.jwt() ->> 'email')))
  with check (bucket_id = 'trippin' and exists (select 1 from public.allowed_users a where lower(trim(a.email)) = lower(auth.jwt() ->> 'email')));

-- Newer Supabase projects don't give the app's logged-in users access to new tables automatically.
-- The allow-list check runs as a trusted function, and the app gets access to the records table.
create or replace function public.is_family() returns boolean
  language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.allowed_users a where lower(trim(a.email)) = lower(auth.jwt() ->> 'email'));
$$;
revoke all on function public.is_family() from public;
grant execute on function public.is_family() to authenticated;
grant usage on schema public to authenticated;
grant select, insert, update, delete on public.records to authenticated;

drop policy if exists "family only" on public.records;
create policy "family only" on public.records for all to authenticated
  using (public.is_family()) with check (public.is_family());
drop policy if exists "family files" on storage.objects;
create policy "family files" on storage.objects for all to authenticated
  using (bucket_id = 'trippin' and public.is_family()) with check (bucket_id = 'trippin' and public.is_family());
