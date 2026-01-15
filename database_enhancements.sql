-- 1. ADVERTISEMENTS SYSTEM
-- Table for managing site-wide advertisements (banners, sidebar ads, etc.)
create table if not exists advertisements (
  id uuid default uuid_generate_v4() primary key,
  title text not null,
  image_url text not null,
  destination_url text, -- Where the ad takes you when clicked
  placement_area text check (placement_area in ('home_hero', 'marketplace_sidebar', 'news_feed', 'global_popup')),
  status text default 'active' check (status in ('active', 'paused', 'expired')),
  start_date timestamp with time zone default now(),
  end_date timestamp with time zone,
  
  -- Analytics
  impressions_count bigint default 0,
  clicks_count bigint default 0,
  
  created_by uuid references auth.users(id),
  created_at timestamp with time zone default now()
);

-- RLS: Public can view active ads, Admins can manage all
alter table advertisements enable row level security;

create policy "Admins can do everything with ads" 
  on advertisements 
  for all 
  using (
    exists (
      select 1 from profiles
      where profiles.id = auth.uid() and profiles.role in ('admin', 'super_admin')
    )
  );

create policy "Public can view active ads" 
  on advertisements 
  for select 
  using (status = 'active' and (end_date is null or end_date > now()));


-- 2. NOTIFICATIONS SYSTEM
-- Real-time alerts for users (orders, system messages, approvals)
create table if not exists notifications (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users(id) not null, -- Who receives it
  title text not null,
  message text not null,
  type text default 'info' check (type in ('info', 'success', 'warning', 'error', 'system', 'message', 'order')),
  link_url text, -- Action link
  is_read boolean default false,
  created_at timestamp with time zone default now()
);

-- RLS: Users see their own, Admins/System insert
alter table notifications enable row level security;

create policy "Users manage their own notifications" 
  on notifications 
  for all 
  using (auth.uid() = user_id);

create policy "Admins can send notifications" 
  on notifications 
  for insert 
  with check (
    exists (
      select 1 from profiles
      where profiles.id = auth.uid() and profiles.role in ('admin', 'super_admin')
    )
  );


-- 3. SAVED ITEMS / WISHLIST (Marketplace Feature)
create table if not exists saved_items (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users(id) not null,
  product_id uuid references products(id) not null,
  created_at timestamp with time zone default now(),
  unique(user_id, product_id)
);

alter table saved_items enable row level security;

create policy "Users manage their own saved items" 
  on saved_items 
  for all 
  using (auth.uid() = user_id);


-- 4. STORAGE BUCKET setup for Ads (Run this in SQL Editor if bucket doesn't exist)
insert into storage.buckets (id, name, public) 
values ('ad-assets', 'ad-assets', true)
on conflict (id) do nothing;

create policy "Public Access Ad Assets" on storage.objects for select using (bucket_id = 'ad-assets');
create policy "Admins Upload Ad Assets" on storage.objects for insert with check (
  bucket_id = 'ad-assets' and 
  exists (select 1 from profiles where id = auth.uid() and role in ('admin', 'super_admin'))
);
