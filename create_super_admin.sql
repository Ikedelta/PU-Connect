-- ============================================================================
-- Super Admin Creation Script (SCHEMA RECOVERY VERSION)
-- This script fixes missing tables and constraints that cause "Database error querying schema"
-- ============================================================================

-- 1. Ensure system_admins table exists (Required by the Admin Dashboard)
CREATE TABLE IF NOT EXISTS public.system_admins (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid NOT NULL,
    granted_at timestamptz DEFAULT now(),
    granted_by uuid,
    is_active boolean DEFAULT true,
    CONSTRAINT system_admins_user_id_key UNIQUE (user_id),
    CONSTRAINT system_admins_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

-- 2. Define the missing FK manually if it failed during table creation
-- This ensures the join in SuperAdminManagement.tsx works
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'system_admins_profiles_fkey'
    ) THEN
        ALTER TABLE public.system_admins 
        ADD CONSTRAINT system_admins_profiles_fkey 
        FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
    END IF;
END $$;

-- 3. Fix the Profiles Role Constraint
ALTER TABLE public.profiles 
DROP CONSTRAINT IF EXISTS profiles_role_check;

ALTER TABLE public.profiles 
ADD CONSTRAINT profiles_role_check 
CHECK (role IN ('buyer', 'seller', 'admin', 'news_publisher', 'super_admin'));

-- 4. Create/Update the Admin Account
DO $$
DECLARE
  target_email text := 'system.admin@gmail.com';
  target_password text := 'pukonnect@!';
  new_user_id uuid;
BEGIN
  -- Check if user exists in auth.users
  IF EXISTS (SELECT 1 FROM auth.users WHERE email = target_email) THEN
    UPDATE auth.users
    SET encrypted_password = crypt(target_password, gen_salt('bf')),
        email_confirmed_at = now(),
        updated_at = now()
    WHERE email = target_email
    RETURNING id INTO new_user_id;
  ELSE
    INSERT INTO auth.users (
      instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      recovery_sent_at, last_sign_in_at, raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at
    )
    VALUES (
      '00000000-0000-0000-0000-000000000000', uuid_generate_v4(), 'authenticated', 'authenticated',
      target_email, crypt(target_password, gen_salt('bf')), now(), now(), now(),
      '{"provider":"email","providers":["email"]}', '{"full_name":"System Admin"}', now(), now()
    )
    RETURNING id INTO new_user_id;
  END IF;

  -- Ensure profile exists and has super_admin role
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (new_user_id, target_email, 'System Admin', 'super_admin')
  ON CONFLICT (id) DO UPDATE
  SET role = 'super_admin', full_name = 'System Admin';

  -- Ensure record in system_admins table
  INSERT INTO public.system_admins (user_id, granted_by, is_active)
  VALUES (new_user_id, new_user_id, true)
  ON CONFLICT (user_id) DO UPDATE SET is_active = true;

  RAISE NOTICE 'System Admin configured successfully: %', target_email;
END $$;
