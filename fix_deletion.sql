-- SECURITY ENHANCEMENT SCRIPT
-- This script ensures valid foreign keys and automatic cleanup for user data.
-- Run this in Supabase SQL Editor to enforce data integrity.

-- 1. PROFILES Table (The Core)
-- Drop existing constraint if it exists (name might vary, so we check or just try drop)
alter table profiles 
  drop constraint if exists profiles_id_fkey;

alter table profiles
  add constraint profiles_id_fkey
  foreign key (id)
  references auth.users(id)
  on delete cascade;

-- 2. PRODUCTS Table
-- When a profile (seller) is deleted, delete their products
alter table products
  drop constraint if exists products_seller_id_fkey;

alter table products
  add constraint products_seller_id_fkey
  foreign key (seller_id)
  references profiles(id)
  on delete cascade;

-- 3. SELLER_APPLICATIONS Table
alter table seller_applications
  drop constraint if exists seller_applications_user_id_fkey;

alter table seller_applications
  add constraint seller_applications_user_id_fkey
  foreign key (user_id)
  references profiles(id)
  on delete cascade;

-- 4. CAMPUS_NEWS (if authors are deleted)
alter table campus_news
  drop constraint if exists campus_news_author_id_fkey;

alter table campus_news
  add constraint campus_news_author_id_fkey
  foreign key (author_id)
  references profiles(id)
  on delete set null; -- Don't delete news, just remove author link? Or cascade? Let's CASCADE to be safe/clean per user request
  -- Actually, let's CASCADE. If a publisher is gone, maybe their news stays?
  -- User: "with reguards to the deleting of users" implies cleanup.
  -- Let's stick to CASCADE.
  
alter table campus_news
  drop constraint if exists campus_news_author_id_fkey_cascade;
alter table campus_news
  add constraint campus_news_author_id_fkey_cascade
  foreign key (author_id)
  references profiles(id)
  on delete cascade;

-- 5. MESSAGES
alter table messages
  drop constraint if exists messages_sender_id_fkey;
alter table messages
  drop constraint if exists messages_receiver_id_fkey;

alter table messages
  add constraint messages_sender_id_fkey
  foreign key (sender_id)
  references profiles(id)
  on delete cascade;

alter table messages
  add constraint messages_receiver_id_fkey
  foreign key (receiver_id)
  references profiles(id)
  on delete cascade;

-- 6. NOTIFICATIONS
alter table notifications
  drop constraint if exists notifications_user_id_fkey;

alter table notifications
  add constraint notifications_user_id_fkey
  foreign key (user_id)
  references profiles(id) -- or auth.users? profiles is safer as it's public
  on delete cascade;

-- Fix ref to auth.users if previously set
alter table notifications
  drop constraint if exists notifications_user_id_fkey_auth; -- theoretical check
  
-- 7. SAVED ITEMS
alter table saved_items
  drop constraint if exists saved_items_user_id_fkey;

alter table saved_items
  add constraint saved_items_user_id_fkey
  foreign key (user_id)
  references profiles(id)
  on delete cascade;

-- 8. POLL VOTES
alter table poll_votes
  drop constraint if exists poll_votes_user_id_fkey;

alter table poll_votes
  add constraint poll_votes_user_id_fkey
  foreign key (user_id)
  references profiles(id)
  on delete cascade;

-- 9. SUPPORT TICKETS
alter table support_tickets
  drop constraint if exists support_tickets_user_id_fkey;

alter table support_tickets
  add constraint support_tickets_user_id_fkey
  foreign key (user_id)
  references profiles(id)
  on delete cascade;

-- 10. Reviews
alter table product_reviews
  drop constraint if exists product_reviews_user_id_fkey;

alter table product_reviews
  add constraint product_reviews_user_id_fkey
  foreign key (user_id)
  references profiles(id)
  on delete cascade;

-- Helper to safely delete a user via SQL (if admin needs to force it)
create or replace function delete_user_by_email(user_email text)
returns void as $$
declare
  uid uuid;
begin
  select id into uid from auth.users where email = user_email;
  if uid is not null then
    delete from auth.users where id = uid; -- Cascades to profiles -> Cascades to everything else
  end if;
end;
$$ language plpgsql security definer;
