-- SUPPORT SYSTEM SETUP SCRIPT (ROBUST VERSION)
-- Run this to fix "Database error querying schema" and "Policy already exists" errors.

-- 1. Create table if not exists (Safe to run)
create table if not exists public.support_tickets (
  id uuid default gen_random_uuid() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  user_id uuid references public.profiles(id) on delete cascade not null,
  subject text not null,
  message text not null,
  status text check (status in ('open', 'in_progress', 'resolved', 'closed')) default 'open',
  priority text check (priority in ('low', 'medium', 'high', 'urgent')) default 'medium'
);

-- 2. Enable RLS (Safe to run)
alter table public.support_tickets enable row level security;

-- 3. DROP OLD POLICIES to avoid "Policy already exists" error
drop policy if exists "Users can insert their own tickets" on public.support_tickets;
drop policy if exists "Users can view their own tickets" on public.support_tickets;
drop policy if exists "Admins can view all tickets" on public.support_tickets;
drop policy if exists "Admins can update tickets" on public.support_tickets;
drop policy if exists "Admins can delete tickets" on public.support_tickets;

-- 4. RE-CREATE POLICIES
create policy "Users can insert their own tickets"
on public.support_tickets for insert
to authenticated
with check (auth.uid() = user_id);

create policy "Users can view their own tickets"
on public.support_tickets for select
to authenticated
using (auth.uid() = user_id);

create policy "Admins can view all tickets"
on public.support_tickets for select
to authenticated
using (exists (select 1 from public.profiles where id = auth.uid() and role in ('admin', 'super_admin')));

create policy "Admins can update tickets"
on public.support_tickets for update
to authenticated
using (exists (select 1 from public.profiles where id = auth.uid() and role in ('admin', 'super_admin')));

create policy "Admins can delete tickets"
on public.support_tickets for delete
to authenticated
using (exists (select 1 from public.profiles where id = auth.uid() and role in ('admin', 'super_admin')));

-- 5. RPC for System Admin Bypass (Using CREATE OR REPLACE - Safe)
create or replace function admin_get_support_tickets(secret_key text)
returns table (
  id uuid,
  subject text,
  message text,
  status text,
  priority text,
  created_at timestamp with time zone,
  user_id uuid,
  user_full_name text,
  user_email text,
  user_phone text
)
language plpgsql
security definer
as $$
begin
  if secret_key = 'pentvars-sys-admin-x892' then
    return query
    select 
      t.id, t.subject, t.message, t.status, t.priority, t.created_at, t.user_id,
      p.full_name, p.email, p.phone
    from support_tickets t
    left join profiles p on t.user_id = p.id
    order by t.created_at desc;
  else
    raise exception 'Access Denied: Invalid Admin Key';
  end if;
end;
$$;
