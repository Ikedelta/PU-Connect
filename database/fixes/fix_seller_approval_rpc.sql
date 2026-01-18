-- RPC to Approve Seller Application (Handles Role, Profile, and Status atomically)
CREATE OR REPLACE FUNCTION admin_approve_seller_application(
  application_id uuid,
  secret_key text,
  admin_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER -- Critical: Bypass RLS
AS $$
DECLARE
  app_record record;
BEGIN
  -- 1. Security Check (Accepts both dev key and system pass)
  IF secret_key != 'your_secret_admin_key_here' AND secret_key != 'puconnect@!' THEN
     RAISE EXCEPTION 'Invalid secret key';
  END IF;

  -- 2. Get Application
  SELECT * INTO app_record FROM seller_applications WHERE id = application_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Application not found';
  END IF;

  -- 3. Update User Role (Profile)
  -- Only change role if currently buyer or seller (don't demote existing admins who might be testing)
  UPDATE profiles 
  SET role = 'seller', updated_at = NOW()
  WHERE id = app_record.user_id AND role IN ('buyer', 'seller', 'publisher_seller');

  -- 4. Create/Update Seller Profile
  INSERT INTO seller_profiles (
    user_id, business_name, business_category, business_description,
    contact_phone, contact_email, business_logo, is_active, updated_at
  )
  VALUES (
    app_record.user_id,
    app_record.business_name,
    app_record.business_category,
    app_record.business_description,
    app_record.contact_phone,
    app_record.contact_email,
    app_record.business_logo,
    true,
    NOW()
  )
  ON CONFLICT (user_id) DO UPDATE SET
    business_name = EXCLUDED.business_name,
    business_category = EXCLUDED.business_category,
    business_description = EXCLUDED.business_description,
    contact_phone = EXCLUDED.contact_phone,
    contact_email = EXCLUDED.contact_email,
    business_logo = EXCLUDED.business_logo,
    is_active = true,
    updated_at = NOW();

  -- 5. Update Application Status
  UPDATE seller_applications
  SET status = 'approved',
      reviewed_by = admin_id,
      reviewed_at = NOW(),
      updated_at = NOW()
  WHERE id = application_id;

  RETURN jsonb_build_object('success', true);
END;
$$;

-- RPC to Reject Seller Application
CREATE OR REPLACE FUNCTION admin_reject_seller_application(
  application_id uuid,
  reason text,
  secret_key text,
  admin_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  app_record record;
BEGIN
  IF secret_key != 'your_secret_admin_key_here' AND secret_key != 'puconnect@!' THEN
     RAISE EXCEPTION 'Invalid secret key';
  END IF;

  SELECT * INTO app_record FROM seller_applications WHERE id = application_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Application not found'; END IF;

  -- Downgrade Role (only if seller)
  UPDATE profiles 
  SET role = 'buyer', updated_at = NOW()
  WHERE id = app_record.user_id AND role = 'seller';

  -- Deactivate Seller Profile
  UPDATE seller_profiles
  SET is_active = false, updated_at = NOW()
  WHERE user_id = app_record.user_id;

  -- Update Application
  UPDATE seller_applications
  SET status = 'rejected',
      admin_notes = reason,
      reviewed_by = admin_id,
      reviewed_at = NOW(),
      updated_at = NOW()
  WHERE id = application_id;

  RETURN jsonb_build_object('success', true);
END;
$$;

-- Grant access
GRANT EXECUTE ON FUNCTION admin_approve_seller_application(uuid, text, uuid) TO public;
GRANT EXECUTE ON FUNCTION admin_reject_seller_application(uuid, text, text, uuid) TO public;
