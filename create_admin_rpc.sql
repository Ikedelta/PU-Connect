-- ==============================================================================
-- ADMIN RPC FOR BYPASS MODE
-- ==============================================================================
-- This function allows the System Admin (who may not have a valid auth token)
-- to update user profiles by providing the system password as a secret key.
-- ==============================================================================

-- 1. Update Profile (Roles, Status, etc)
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
  -- Get the system password from settings
  SELECT system_default_password INTO current_system_pass FROM website_settings LIMIT 1;
  
  -- Fallback if not set in DB
  IF current_system_pass IS NULL THEN
    current_system_pass := 'pukonnect@!';
  END IF;

  -- Verify Secret
  IF secret_key != current_system_pass THEN
    RAISE EXCEPTION 'Unauthorized: Invalid System Secret';
  END IF;

  -- Perform Update (SECURITY DEFINER bypasses RLS)
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

-- 2. Update Seller Application Status
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

  IF secret_key != current_system_pass THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  UPDATE seller_applications 
  SET status = new_status, updated_at = now() 
  WHERE id = app_id;
END;
$$;


-- Grant access
GRANT EXECUTE ON FUNCTION admin_update_profile(UUID, JSONB, TEXT) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION admin_update_application(UUID, TEXT, TEXT) TO anon, authenticated, service_role;
