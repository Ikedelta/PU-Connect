-- ==============================================================================
-- FIX ADMIN PERMISSIONS & SYSTEM ACCOUNT
-- ==============================================================================
-- Problem: RLS policies require the executing user to represent a row in the 'profiles' table
-- with role 'admin' or 'super_admin'. The hardcoded "System Admin" account (Bypass)
-- previously didn't have a DB row, causing all update/insert attempts to fail silently or with 403.
--
-- Solution: Insert a permanent "System Administrator" profile row with the fixed UUID.
-- ==============================================================================

INSERT INTO public.profiles (
  id, 
  email, 
  full_name, 
  role, 
  student_id, 
  department, 
  faculty, 
  phone, 
  is_active, 
  is_online, 
  created_at, 
  updated_at
)
VALUES (
  '00000000-0000-0000-0000-000000000000', -- The fixed Nil UUID for System Admin
  'system.admin@gmail.com',
  'System Administrator',
  'super_admin',
  'SYS-001',
  'Systems',
  'Core',
  '0000000000',
  true,
  true,
  now(),
  now()
)
ON CONFLICT (id) DO UPDATE 
SET 
  role = 'super_admin',
  is_active = true,
  email = 'system.admin@gmail.com';  -- Ensure role is always super_admin

-- ==============================================================================
-- VERIFICATION (Optional)
-- ==============================================================================
-- After running, you should be able to:
-- 1. Log in with the System Password
-- 2. Approve Seller Applications (RLS will passes for 'super_admin')
-- 3. Manage Users (RLS passes)
