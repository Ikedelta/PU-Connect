-- FIX SYSTEM ADMIN PROFILE & CAPABILITIES

-- 1. DELETE conflicting profile to allow specific ID creation
-- We use CASCADE to remove related data (applications, products) if any exist for the old random-ID admin.
delete from public.profiles where email = 'system.admin@gmail.com';

-- 2. CREATE System Admin Profile with Hardcoded ID (0000...)
insert into public.profiles (
  id, email, full_name, role, student_id, department, faculty, phone, is_active
) values (
  '00000000-0000-0000-0000-000000000000',
  'system.admin@gmail.com', 'System Administrator', 'super_admin',
  'SYS-001', 'IT', 'Systems', '0000000000', true
);

-- 3. CREATE RPC for Admin Ticket Submission (Bypassing RLS for System Admin)
create or replace function admin_create_ticket(
  subject text,
  message text,
  priority text,
  secret_key text
)
returns uuid
language plpgsql
security definer
as $$
declare
  new_id uuid;
begin
  if secret_key = 'pentvars-sys-admin-x892' then
    insert into public.support_tickets (user_id, subject, message, priority, status)
    values ('00000000-0000-0000-0000-000000000000', subject, message, priority, 'open')
    returning id into new_id;
    return new_id;
  else
    raise exception 'Access Denied';
  end if;
end;
$$;
