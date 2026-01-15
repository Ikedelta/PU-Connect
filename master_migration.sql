-- MASTER MIGRATION SCRIPT
-- Run this entire script in your Supabase SQL Editor to verify/create all necessary tables.

-- ENALBE UUID EXTENSION
create extension if not exists "uuid-ossp";

-- 1. ADVERTISEMENTS SYSTEM
create table if not exists advertisements (
  id uuid default uuid_generate_v4() primary key,
  title text not null,
  image_url text not null,
  destination_url text,
  placement_area text check (placement_area in ('home_hero', 'marketplace_sidebar', 'news_feed', 'global_popup')),
  status text default 'active' check (status in ('active', 'paused', 'expired')),
  start_date timestamp with time zone default now(),
  end_date timestamp with time zone,
  impressions_count bigint default 0,
  clicks_count bigint default 0,
  created_by uuid references auth.users(id),
  created_at timestamp with time zone default now()
);

-- 2. NOTIFICATIONS SYSTEM
create table if not exists notifications (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users(id) not null,
  title text not null,
  message text not null,
  type text default 'info' check (type in ('info', 'success', 'warning', 'error', 'system', 'message', 'order')),
  link_url text,
  is_read boolean default false,
  created_at timestamp with time zone default now()
);

-- 3. SAVED ITEMS (Wishlist)
create table if not exists saved_items (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users(id) not null,
  product_id uuid references products(id) not null,
  created_at timestamp with time zone default now(),
  unique(user_id, product_id)
);

-- 4. SUPPORT TICKETS
create table if not exists support_tickets (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users(id),
  subject text not null,
  message text not null,
  status text default 'open' check (status in ('open', 'in_progress', 'resolved', 'closed')),
  priority text default 'medium' check (priority in ('low', 'medium', 'high', 'urgent')),
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- 5. POLLS SYSTEM
create table if not exists polls (
  id uuid default uuid_generate_v4() primary key,
  question text not null,
  is_active boolean default true,
  expires_at timestamp with time zone,
  created_by uuid references auth.users(id),
  created_at timestamp with time zone default now()
);

create table if not exists poll_options (
  id uuid default uuid_generate_v4() primary key,
  poll_id uuid references polls(id) on delete cascade not null,
  option_text text not null,
  votes_count bigint default 0
);

create table if not exists poll_votes (
  id uuid default uuid_generate_v4() primary key,
  poll_id uuid references polls(id) on delete cascade not null,
  option_id uuid references poll_options(id) on delete cascade not null,
  user_id uuid references auth.users(id) not null,
  created_at timestamp with time zone default now(),
  unique(poll_id, user_id) -- One vote per poll per user
);

-- 6. PRODUCT REVIEWS (New Feature)
create table if not exists product_reviews (
  id uuid default uuid_generate_v4() primary key,
  product_id uuid references products(id) on delete cascade not null,
  user_id uuid references auth.users(id) not null,
  rating integer check (rating >= 1 and rating <= 5),
  comment text,
  created_at timestamp with time zone default now(),
  unique(product_id, user_id)
);

-- 7. ACTIVITY LOGS (For Admin Dashboard)
create table if not exists activity_logs (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users(id),
  action text not null, -- e.g. 'login', 'create_product', 'update_settings'
  details jsonb, -- Flexible metadata
  ip_address text,
  created_at timestamp with time zone default now()
);

-- ROW LEVEL SECURITY (RLS) POLICIES

-- Enable RLS on all tables
alter table advertisements enable row level security;
alter table notifications enable row level security;
alter table saved_items enable row level security;
alter table support_tickets enable row level security;
alter table polls enable row level security;
alter table poll_options enable row level security;
alter table poll_votes enable row level security;
alter table product_reviews enable row level security;
alter table activity_logs enable row level security;

-- Advertisements
create policy "Admins manage ads" on advertisements for all using (
  exists (select 1 from profiles where id = auth.uid() and role in ('admin', 'super_admin'))
);
create policy "Public view ads" on advertisements for select using (
  status = 'active'
);

-- Notifications
create policy "Users view own notifications" on notifications for select using (auth.uid() = user_id);
create policy "System/Admins create notifications" on notifications for insert with check (true); -- Ideally restrict to triggers/functions or admins

-- Saved Items
create policy "Users manage saved items" on saved_items for all using (auth.uid() = user_id);

-- Support Tickets
create policy "Users manage own tickets" on support_tickets for all using (auth.uid() = user_id);
create policy "Admins manage all tickets" on support_tickets for all using (
  exists (select 1 from profiles where id = auth.uid() and role in ('admin', 'super_admin'))
);

-- Polls
create policy "Public view active polls" on polls for select using (true);
create policy "Admins manage polls" on polls for all using (
  exists (select 1 from profiles where id = auth.uid() and role in ('admin', 'super_admin'))
);

-- Poll Options
create policy "Public view options" on poll_options for select using (true);
create policy "Admins manage options" on poll_options for all using (
  exists (select 1 from profiles where id = auth.uid() and role in ('admin', 'super_admin'))
);

-- Poll Votes
create policy "Users can vote" on poll_votes for insert with check (auth.uid() = user_id);
create policy "Users see own vote" on poll_votes for select using (auth.uid() = user_id);

-- Product Reviews
create policy "Public view reviews" on product_reviews for select using (true);
create policy "Users create reviews" on product_reviews for insert with check (auth.uid() = user_id);
create policy "Users delete own reviews" on product_reviews for delete using (auth.uid() = user_id);

-- Activity Logs
create policy "Admins view logs" on activity_logs for select using (
  exists (select 1 from profiles where id = auth.uid() and role in ('admin', 'super_admin'))
);
create policy "System insert logs" on activity_logs for insert with check (true);

-- STORAGE BUCKETS
insert into storage.buckets (id, name, public) values ('ad-assets', 'ad-assets', true) on conflict (id) do nothing;
create policy "Public Access Ad Assets" on storage.objects for select using (bucket_id = 'ad-assets');
create policy "Admins Upload Ad Assets" on storage.objects for insert with check (
  bucket_id = 'ad-assets' and 
  exists (select 1 from profiles where id = auth.uid() and role in ('admin', 'super_admin'))
);

-- HELPER: Increment Vote Count Function
create or replace function increment_vote_count()
returns trigger as $$
begin
  update poll_options
  set votes_count = votes_count + 1
  where id = new.option_id;
  return new;
end;
$$ language plpgsql;

create trigger on_vote_added
after insert on poll_votes
for each row execute procedure increment_vote_count();
