-- Global Heights RWA Care: Supabase/PostgreSQL schema
-- Run this entire file in Supabase Dashboard > SQL Editor.
create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  flat_number text not null default '',
  block text not null default '',
  role text not null default 'resident' check (role in ('resident','admin')),
  is_verified boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.profiles add column if not exists is_verified boolean not null default false;

create table if not exists public.complaints (
  id uuid primary key default gen_random_uuid(),
  ticket_no text unique not null default ('GH-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,8))),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 80),
  category text not null,
  description text not null check (char_length(description) between 1 and 500),
  status text not null default 'Pending' check (status in ('Pending','In progress','Resolved')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.notices (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 90),
  body text not null check (char_length(body) between 1 and 500),
  tag text not null default 'MANAGEMENT',
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create table if not exists public.maintenance_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  billing_month text not null,
  amount numeric(10,2) not null check (amount >= 0),
  due_date date,
  status text not null default 'Due' check (status in ('Due','Paid','Overdue')),
  created_at timestamptz not null default now()
);

create table if not exists public.payment_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  maintenance_id uuid references public.maintenance_records(id),
  amount numeric(10,2) not null check (amount > 0),
  provider_reference text,
  status text not null default 'Pending' check (status in ('Pending','Verified','Failed')),
  paid_at timestamptz,
  created_at timestamptz not null default now()
);

create or replace function public.is_admin()
returns boolean language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

alter table public.profiles enable row level security;
alter table public.complaints enable row level security;
alter table public.notices enable row level security;
alter table public.maintenance_records enable row level security;
alter table public.payment_records enable row level security;

drop policy if exists "profile read self or admin" on public.profiles;
create policy "profile read self or admin" on public.profiles
for select to authenticated using (id = auth.uid() or public.is_admin());
drop policy if exists "profile update self limited" on public.profiles;
create policy "profile update self limited" on public.profiles
for update to authenticated using (id = auth.uid()) with check (id = auth.uid() and role = 'resident');
drop policy if exists "profile insert self resident" on public.profiles;
create policy "profile insert self resident" on public.profiles
for insert to authenticated with check (id = auth.uid() and role = 'resident');
-- Residents may edit only their basic contact/flat fields, never role or verification.
revoke update on public.profiles from authenticated;
grant update (full_name, flat_number, block) on public.profiles to authenticated;

drop policy if exists "complaints read own or admin" on public.complaints;
create policy "complaints read own or admin" on public.complaints
for select to authenticated using (user_id = auth.uid() or public.is_admin());
drop policy if exists "resident creates own complaint" on public.complaints;
drop policy if exists "verified resident creates own complaint" on public.complaints;
create policy "verified resident creates own complaint" on public.complaints
for insert to authenticated with check (
  user_id = auth.uid() and exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.is_verified = true
  )
);
drop policy if exists "admin updates complaints" on public.complaints;
create policy "admin updates complaints" on public.complaints
for update to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "authenticated read notices" on public.notices;
create policy "authenticated read notices" on public.notices
for select to authenticated using (true);
drop policy if exists "admin manages notices" on public.notices;
create policy "admin manages notices" on public.notices
for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "maintenance own or admin" on public.maintenance_records;
create policy "maintenance own or admin" on public.maintenance_records
for select to authenticated using (user_id = auth.uid() or public.is_admin());
drop policy if exists "admin manages maintenance" on public.maintenance_records;
create policy "admin manages maintenance" on public.maintenance_records
for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "payments own or admin" on public.payment_records;
create policy "payments own or admin" on public.payment_records
for select to authenticated using (user_id = auth.uid() or public.is_admin());
drop policy if exists "admin manages payments" on public.payment_records;
create policy "admin manages payments" on public.payment_records
for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Automatically create a resident profile when a new account signs up.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, flat_number, block, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name',''),
    coalesce(new.raw_user_meta_data->>'flat_number',''),
    coalesce(new.raw_user_meta_data->>'block',''),
    'resident'
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

-- IMPORTANT: promote only verified RWA management accounts manually:
-- update public.profiles set role = 'admin' where id = 'AUTH_USER_UUID';

-- Enable live database change notifications for complaints and notices.
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'complaints') then
    alter publication supabase_realtime add table public.complaints;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'notices') then
    alter publication supabase_realtime add table public.notices;
  end if;
end $$;
