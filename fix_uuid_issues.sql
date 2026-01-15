-- FIX: Allow non-UUID User IDs (like 'sys_admin_001')
-- This script changes user reference columns from UUID to TEXT to support legacy/test IDs.

-- 1. ADVERTISEMENTS
alter table advertisements drop constraint if exists advertisements_created_by_fkey;
alter table advertisements alter column created_by type text;

-- 2. NOTIFICATIONS
alter table notifications drop constraint if exists notifications_user_id_fkey;
alter table notifications alter column user_id type text;

-- 3. SAVED ITEMS
alter table saved_items drop constraint if exists saved_items_user_id_fkey;
alter table saved_items alter column user_id type text;

-- 4. SUPPORT TICKETS
alter table support_tickets drop constraint if exists support_tickets_user_id_fkey;
alter table support_tickets alter column user_id type text;

-- 5. POLLS & VOTES
alter table polls drop constraint if exists polls_created_by_fkey;
alter table polls alter column created_by type text;

alter table poll_votes drop constraint if exists poll_votes_user_id_fkey;
alter table poll_votes alter column user_id type text;

-- 6. PRODUCT REVIEWS
alter table product_reviews drop constraint if exists product_reviews_user_id_fkey;
alter table product_reviews alter column user_id type text;

-- 7. ACTIVITY LOGS
alter table activity_logs drop constraint if exists activity_logs_user_id_fkey;
alter table activity_logs alter column user_id type text;

-- 8. PROFILES (Constraint cleanup just in case)
-- We can't easily change auth.users.id, but we can ensure profiles.id matches
-- profiles.id is likely already uuid if it references auth.users.
-- If profiles.id is strict uuid, 'sys_admin_001' shouldn't exist there.
-- Assuming profiles.id is already TEXT or the user tampered with it.

-- RLS UPDATE: SAFE UID FUNCTION
-- Replace potentially crashing auth.uid() with a text-safe version for our Policies
create or replace function auth_uid_text() returns text as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '');
$$ language sql stable;

-- Update RLS Policies to use casting or text comparison
-- Advertisements
drop policy if exists "Admins manage ads" on advertisements;
create policy "Admins manage ads" on advertisements for all using (
  exists (select 1 from profiles where id = auth_uid_text() and role in ('admin', 'super_admin'))
);

-- Notifications
drop policy if exists "Users view own notifications" on notifications;
create policy "Users view own notifications" on notifications for select using (auth_uid_text() = user_id);

-- Saved Items
drop policy if exists "Users manage saved items" on saved_items;
create policy "Users manage saved items" on saved_items for all using (auth_uid_text() = user_id);

-- Support Tickets
drop policy if exists "Users manage own tickets" on support_tickets;
create policy "Users manage own tickets" on support_tickets for all using (auth_uid_text() = user_id);

drop policy if exists "Admins manage all tickets" on support_tickets;
create policy "Admins manage all tickets" on support_tickets for all using (
  exists (select 1 from profiles where id = auth_uid_text() and role in ('admin', 'super_admin'))
);

-- Polls
drop policy if exists "Admins manage polls" on polls;
create policy "Admins manage polls" on polls for all using (
  exists (select 1 from profiles where id = auth_uid_text() and role in ('admin', 'super_admin'))
);

drop policy if exists "Admins manage options" on poll_options;
create policy "Admins manage options" on poll_options for all using (
  exists (select 1 from profiles where id = auth_uid_text() and role in ('admin', 'super_admin'))
);

-- Poll Votes
drop policy if exists "Users can vote" on poll_votes;
create policy "Users can vote" on poll_votes for insert with check (auth_uid_text() = user_id);

drop policy if exists "Users see own vote" on poll_votes;
create policy "Users see own vote" on poll_votes for select using (auth_uid_text() = user_id);

-- Product Reviews
drop policy if exists "Users create reviews" on product_reviews;
create policy "Users create reviews" on product_reviews for insert with check (auth_uid_text() = user_id);

drop policy if exists "Users delete own reviews" on product_reviews;
create policy "Users delete own reviews" on product_reviews for delete using (auth_uid_text() = user_id);

-- Activity Logs
drop policy if exists "Admins view logs" on activity_logs;
create policy "Admins view logs" on activity_logs for select using (
  exists (select 1 from profiles where id = auth_uid_text() and role in ('admin', 'super_admin'))
);
