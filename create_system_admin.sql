-- ============================================================================
-- AUTOMATED SUPER ADMIN CREATION SCRIPT
-- ============================================================================
-- This script will create a new user 'system.admin@pentvars.edu.gh' 
-- with password: 'Password@123' (if it doesn't exist)
-- and grant them 'super_admin' privileges.
-- ============================================================================

-- 1. Create the user in auth.users (if not exists)
INSERT INTO auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    recovery_sent_at,
    last_sign_in_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    confirmation_token,
    email_change,
    email_change_token_new,
    recovery_token
)
SELECT 
    '00000000-0000-0000-0000-000000000000',
    uuid_generate_v4(),
    'authenticated',
    'authenticated',
    'system.admin@pentvars.edu.gh', -- <--- SYSTEM EMAIL
    crypt('Password@123', gen_salt('bf')), -- <--- SYSTEM PASSWORD
    now(),
    now(),
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"System Super Admin"}',
    now(),
    now(),
    '',
    '',
    '',
    ''
WHERE NOT EXISTS (
    SELECT 1 FROM auth.users WHERE email = 'system.admin@pentvars.edu.gh'
);

-- 2. Ensure the user is in public.profiles and has 'super_admin' role
-- Note: The trigger might auto-create the profile, but we force update it here just in case.
INSERT INTO public.profiles (id, email, full_name, role, is_active)
SELECT 
    id, 
    email, 
    'System Super Admin', 
    'super_admin', 
    true
FROM auth.users 
WHERE email = 'system.admin@pentvars.edu.gh'
ON CONFLICT (id) DO UPDATE 
SET role = 'super_admin', is_active = true;

-- 3. Verify
SELECT email, role, is_active FROM public.profiles WHERE email = 'system.admin@pentvars.edu.gh';
