-- COMPLETE ADMIN TABLES SETUP
-- Run this if Admin Dashboard fails with "Database error querying schema"

-- 1. Website Settings
create table if not exists public.website_settings (
  id uuid default gen_random_uuid() primary key,
  site_name text default 'Campus Marketplace',
  enable_sms boolean default true,
  maintenance_mode boolean default false,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);
-- Insert default row if empty
insert into public.website_settings (site_name)
select 'Campus Marketplace'
where not exists (select 1 from public.website_settings);

-- 2. Activity Logs
create table if not exists public.activity_logs (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete set null,
  action_type text not null,
  action_details jsonb default '{}'::jsonb,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 3. SMS Topups
create table if not exists public.sms_topups (
  id uuid default gen_random_uuid() primary key,
  amount numeric not null,
  sms_count integer not null,
  status text default 'completed',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 4. Newsletter Subscribers
create table if not exists public.newsletter_subscribers (
  id uuid default gen_random_uuid() primary key,
  email text unique not null,
  is_active boolean default true,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 5. ENABLE RLS for all
alter table public.website_settings enable row level security;
alter table public.activity_logs enable row level security;
alter table public.sms_topups enable row level security;
alter table public.newsletter_subscribers enable row level security;

-- 6. POLICIES (Simplified for Admin Viewer)
-- Website Settings
drop policy if exists "Read Settings" on public.website_settings;
create policy "Read Settings" on public.website_settings for select to authenticated using (true);

drop policy if exists "Admin Update Settings" on public.website_settings;
create policy "Admin Update Settings" on public.website_settings for update to authenticated using (exists (select 1 from public.profiles where id = auth.uid() and role in ('admin', 'super_admin')));

-- Activity Logs
drop policy if exists "Admin View Logs" on public.activity_logs;
create policy "Admin View Logs" on public.activity_logs for select to authenticated using (exists (select 1 from public.profiles where id = auth.uid() and role in ('admin', 'super_admin')));

-- SMS Topups
drop policy if exists "Admin View Topups" on public.sms_topups;
create policy "Admin View Topups" on public.sms_topups for select to authenticated using (exists (select 1 from public.profiles where id = auth.uid() and role in ('admin', 'super_admin')));

-- Newsletter
drop policy if exists "Public Subscribe" on public.newsletter_subscribers;
create policy "Public Subscribe" on public.newsletter_subscribers for insert to anon, authenticated with check (true);

drop policy if exists "Admin View Subscribers" on public.newsletter_subscribers;
create policy "Admin View Subscribers" on public.newsletter_subscribers for select to authenticated using (exists (select 1 from public.profiles where id = auth.uid() and role in ('admin', 'super_admin')));
