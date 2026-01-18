-- FIX NEWS BACKEND
-- Creates campus_news table and necessary RPCs to prevent "Error Page" on News Detail

create extension if not exists pgcrypto;

-- 1. Create Table
create table if not exists public.campus_news (
  id uuid default gen_random_uuid() primary key,
  title text not null,
  content text not null,
  excerpt text,
  category text,
  image_url text,
  author_id uuid references public.profiles(id),
  is_published boolean default false,
  published_at timestamp with time zone,
  views_count integer default 0,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 2. Enable RLS
alter table public.campus_news enable row level security;

-- 3. Policies
drop policy if exists "Public Read News" on public.campus_news;
create policy "Public Read News" on public.campus_news for select to anon, authenticated using (is_published = true);

drop policy if exists "Admin Manage News" on public.campus_news;
create policy "Admin Manage News" on public.campus_news for all to authenticated using (
  exists (select 1 from public.profiles where id = auth.uid() and role in ('admin', 'super_admin', 'news_publisher', 'publisher_seller'))
);

-- 4. RPC for View Count
create or replace function increment_news_views(news_id uuid)
returns void language plpgsql security definer as $$
begin
  update public.campus_news set views_count = views_count + 1 where id = news_id;
exception when others then
  -- Ignore errors if row missing
  return;
end;
$$;

-- 5. Seed Data (Only if empty)
do $$
declare
  admin_id uuid;
begin
  select id into admin_id from public.profiles where role = 'super_admin' limit 1;
  
  if admin_id is not null and not exists (select 1 from public.campus_news) then
    insert into public.campus_news (title, content, excerpt, category, author_id, is_published, created_at)
    values 
    ('Welcome to Campus Connect', '# Welcome!\n\nWe are thrilled to launch the new Campus Connect platform. This is your hub for trading, news, and community updates.\n\n## Only the beginning\n\nStay tuned for more features!', 'The official launch of our university marketplace.', 'Announcements', admin_id, true, now());
  end if;
end
$$;
