-- ==============================================================================
-- MASTER DATABASE SETUP SCRIPT
-- ==============================================================================
-- This script consolidates all necessary table creations, RLS policies, 
-- permission fixes, and RPC functions for the Campus Connect platform.
-- ALLOWS: System Admin Bypass, SMS Features, Role Management, and Seller Approvals.
-- ==============================================================================

-- 1. ENABLE EXTENSIONS & BASICS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. FIX SYSTEM ADMIN PERMISSIONS
-- Ensures the System Admin has a valid profile for RLS checks if authenticated
INSERT INTO public.profiles (
  id, email, full_name, role, student_id, department, faculty, phone, is_active, is_online, created_at, updated_at
)
VALUES (
  '00000000-0000-0000-0000-000000000000', -- Fixed Nil UUID
  'system.admin@gmail.com', 'System Administrator', 'super_admin', 'SYS-001', 'Systems', 'Core', '0000000000', true, true, now(), now()
)
ON CONFLICT (id) DO UPDATE 
SET role = 'super_admin', is_active = true;

-- 3. SMS FUNCTIONALITY & SETTINGS
-- Add columns for global SMS control and preventing duplicate news SMS
ALTER TABLE public.website_settings ADD COLUMN IF NOT EXISTS enable_sms BOOLEAN DEFAULT true;
ALTER TABLE public.campus_news ADD COLUMN IF NOT EXISTS sms_sent BOOLEAN DEFAULT false;

-- 4. ROW LEVEL SECURITY (RLS) POLICIES
-- Re-applying critical policies to ensure admins can edit data
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE seller_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE seller_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;

-- Profiles: Public view, Self edit, Admin edit
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON profiles;
CREATE POLICY "Public profiles are viewable by everyone" ON profiles FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);

DROP POLICY IF EXISTS "Admins can update all profiles" ON profiles;
CREATE POLICY "Admins can update all profiles" ON profiles FOR UPDATE USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin'))
);

-- Seller Profiles: Public view, Owner manage, Admin manage
DROP POLICY IF EXISTS "Public view seller profiles" ON seller_profiles;
CREATE POLICY "Public view seller profiles" ON seller_profiles FOR SELECT USING (true);

DROP POLICY IF EXISTS "Sellers can manage own profile" ON seller_profiles;
CREATE POLICY "Sellers can manage own profile" ON seller_profiles FOR ALL USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Admins can manage all seller profiles" ON seller_profiles;
CREATE POLICY "Admins can manage all seller profiles" ON seller_profiles FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin'))
);

-- Seller Applications: User submit, User view own, Admin manage all
DROP POLICY IF EXISTS "Users can submit applications" ON seller_applications;
CREATE POLICY "Users can submit applications" ON seller_applications FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users view own applications" ON seller_applications;
CREATE POLICY "Users view own applications" ON seller_applications FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins manage applications" ON seller_applications;
CREATE POLICY "Admins manage applications" ON seller_applications FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin'))
);


-- ==============================================================================
-- 5. SECURE RPC FUNCTIONS FOR SYSTEM ADMIN BYPASS
-- ==============================================================================
-- These functions allow the "System Admin" (using the default password) to 
-- bypass RLS restrictions securely to update roles, applications, and seller profiles.

-- A. Update User Profile (Role, Status, etc.)
CREATE OR REPLACE FUNCTION admin_update_profile(
  target_id UUID, 
  new_data JSONB, 
  secret_key TEXT
) 
RETURNS JSONB 
LANGUAGE plpgsql 
SECURITY DEFINER 
AS $$
DECLARE
  current_system_pass TEXT;
BEGIN
  SELECT system_default_password INTO current_system_pass FROM website_settings LIMIT 1;
  IF current_system_pass IS NULL THEN current_system_pass := 'pukonnect@!'; END IF;

  IF secret_key != current_system_pass THEN
    RAISE EXCEPTION 'Unauthorized: Invalid System Secret';
  END IF;

  UPDATE profiles 
  SET 
    full_name = COALESCE((new_data->>'full_name'), full_name),
    role = COALESCE((new_data->>'role'), role),
    department = COALESCE((new_data->>'department'), department),
    faculty = COALESCE((new_data->>'faculty'), faculty),
    phone = COALESCE((new_data->>'phone'), phone),
    student_id = COALESCE((new_data->>'student_id'), student_id),
    is_active = COALESCE((new_data->>'is_active')::boolean, is_active),
    updated_at = now()
  WHERE id = target_id;

  RETURN new_data;
END;
$$;

-- B. Update Seller Application Status
CREATE OR REPLACE FUNCTION admin_update_application(
  app_id UUID, 
  new_status TEXT, 
  secret_key TEXT
) 
RETURNS VOID 
LANGUAGE plpgsql 
SECURITY DEFINER 
AS $$
DECLARE
  current_system_pass TEXT;
BEGIN
  SELECT system_default_password INTO current_system_pass FROM website_settings LIMIT 1;
  IF current_system_pass IS NULL THEN current_system_pass := 'pukonnect@!'; END IF;

  IF secret_key != current_system_pass THEN RAISE EXCEPTION 'Unauthorized'; END IF;

  UPDATE seller_applications 
  SET status = new_status, updated_at = now() 
  WHERE id = app_id;
END;
$$;

-- C. Upsert Seller Profile (For Approving Sellers)
CREATE OR REPLACE FUNCTION admin_upsert_seller_profile(
  target_user_id UUID,
  initial_name TEXT,
  secret_key TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  current_system_pass TEXT;
BEGIN
  SELECT system_default_password INTO current_system_pass FROM website_settings LIMIT 1;
  IF current_system_pass IS NULL THEN current_system_pass := 'pukonnect@!'; END IF;

  IF secret_key != current_system_pass THEN RAISE EXCEPTION 'Unauthorized'; END IF;

  INSERT INTO seller_profiles (user_id, business_name, created_at, updated_at)
  VALUES (target_user_id, initial_name, now(), now())
  ON CONFLICT (user_id) DO NOTHING;
END;
$$;

-- D. Update Website Settings (Global SMS Toggle)
CREATE OR REPLACE FUNCTION admin_update_settings(
  setting_key TEXT,
  setting_value JSONB,
  secret_key TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  current_system_pass TEXT;
BEGIN
  SELECT system_default_password INTO current_system_pass FROM website_settings LIMIT 1;
  IF current_system_pass IS NULL THEN current_system_pass := 'pukonnect@!'; END IF;

  IF secret_key != current_system_pass THEN RAISE EXCEPTION 'Unauthorized'; END IF;

  -- Assuming single row settings table or specific updates. 
  -- Simplified for 'enable_sms' boolean
  IF setting_key = 'enable_sms' THEN
    UPDATE website_settings SET enable_sms = (setting_value::boolean) WHERE site_name = 'Campus Marketplace';
  END IF;
  
  -- Can be expanded for other settings
END;
$$;

-- Grant permissions to call these functions
GRANT EXECUTE ON FUNCTION admin_update_profile(UUID, JSONB, TEXT) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION admin_update_application(UUID, TEXT, TEXT) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION admin_upsert_seller_profile(UUID, TEXT, TEXT) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION admin_update_settings(TEXT, JSONB, TEXT) TO anon, authenticated, service_role;
