-- Admin RPC function to insert seller applications (bypasses RLS for system admin)
CREATE OR REPLACE FUNCTION admin_insert_seller_application(
  application_data jsonb,
  secret_key text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result_id uuid;
BEGIN
  -- Verify secret key (you should set this in your environment)
  IF secret_key != 'your_secret_admin_key_here' THEN
    RAISE EXCEPTION 'Invalid secret key';
  END IF;

  -- Insert the application
  INSERT INTO seller_applications (
    user_id,
    business_name,
    business_category,
    business_description,
    contact_phone,
    contact_email,
    business_logo,
    status,
    created_at,
    updated_at
  )
  VALUES (
    (application_data->>'user_id')::uuid,
    application_data->>'business_name',
    application_data->>'business_category',
    application_data->>'business_description',
    application_data->>'contact_phone',
    application_data->>'contact_email',
    application_data->>'business_logo',
    COALESCE(application_data->>'status', 'pending'),
    NOW(),
    NOW()
  )
  RETURNING id INTO result_id;

  RETURN jsonb_build_object('id', result_id, 'success', true);
END;
$$;

-- Admin RPC function to delete seller applications (bypasses RLS for system admin)
CREATE OR REPLACE FUNCTION admin_delete_seller_application(
  application_id uuid,
  secret_key text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Verify secret key
  IF secret_key != 'your_secret_admin_key_here' THEN
    RAISE EXCEPTION 'Invalid secret key';
  END IF;

  -- Delete the application
  DELETE FROM seller_applications
  WHERE id = application_id;

  RETURN jsonb_build_object('success', true, 'message', 'Application deleted');
END;
$$;

-- Admin RPC function to cancel seller applications (update status to cancelled)
CREATE OR REPLACE FUNCTION admin_cancel_seller_application(
  application_id uuid,
  secret_key text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Verify secret key
  IF secret_key != 'your_secret_admin_key_here' THEN
    RAISE EXCEPTION 'Invalid secret key';
  END IF;

  -- Update the application status
  UPDATE seller_applications
  SET status = 'cancelled',
      updated_at = NOW()
  WHERE id = application_id;

  RETURN jsonb_build_object('success', true, 'message', 'Application cancelled');
END;
$$;

-- Admin RPC function to upsert seller applications (bypasses RLS)
CREATE OR REPLACE FUNCTION admin_upsert_seller_application(
  application_data jsonb,
  secret_key text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result_id uuid;
  target_user_id uuid;
BEGIN
  -- Verify secret key
  IF secret_key != 'your_secret_admin_key_here' THEN
    RAISE EXCEPTION 'Invalid secret key';
  END IF;

  target_user_id := (application_data->>'user_id')::uuid;

  -- Check if application exists for this user
  SELECT id INTO result_id FROM seller_applications WHERE user_id = target_user_id LIMIT 1;

  IF result_id IS NOT NULL THEN
    -- Update existing application
    UPDATE seller_applications SET
      business_name = application_data->>'business_name',
      business_category = application_data->>'business_category',
      business_description = application_data->>'business_description',
      contact_phone = application_data->>'contact_phone',
      contact_email = application_data->>'contact_email',
      business_logo = application_data->>'business_logo',
      status = COALESCE(application_data->>'status', 'pending'),
      updated_at = NOW()
    WHERE id = result_id;
  ELSE
    -- Insert new application
    INSERT INTO seller_applications (
      user_id,
      business_name,
      business_category,
      business_description,
      contact_phone,
      contact_email,
      business_logo,
      status,
      created_at,
      updated_at
    )
    VALUES (
      target_user_id,
      application_data->>'business_name',
      application_data->>'business_category',
      application_data->>'business_description',
      application_data->>'contact_phone',
      application_data->>'contact_email',
      application_data->>'business_logo',
      COALESCE(application_data->>'status', 'pending'),
      COALESCE((application_data->>'created_at')::timestamptz, NOW()),
      NOW()
    )
    RETURNING id INTO result_id;
  END IF;

  RETURN jsonb_build_object('id', result_id, 'success', true);
END;
$$;

-- Admin RPC function to update user role (bypasses RLS)
CREATE OR REPLACE FUNCTION admin_update_user_role(
  target_user_id uuid,
  new_role text,
  secret_key text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Verify secret key
  IF secret_key != 'your_secret_admin_key_here' THEN
    RAISE EXCEPTION 'Invalid secret key';
  END IF;

  -- Update profile
  UPDATE profiles
  SET role = new_role,
      updated_at = NOW()
  WHERE id = target_user_id;

  RETURN jsonb_build_object('success', true, 'message', 'Role updated');
END;
$$;
