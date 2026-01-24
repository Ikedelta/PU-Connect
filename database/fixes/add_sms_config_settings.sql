-- Add granular SMS triggers to platform_settings
INSERT INTO platform_settings (key, value, description)
VALUES 
    ('sms_enabled_otp', 'true'::jsonb, 'Enable SMS for OTP verification codes during registration and password reset.'),
    ('sms_enabled_news', 'true'::jsonb, 'Enable SMS notifications for new campus news publications.'),
    ('sms_enabled_seller_reg', 'true'::jsonb, 'Enable SMS notifications to admins when a new seller application is submitted.'),
    ('sms_enabled_seller_approval', 'true'::jsonb, 'Enable SMS notifications to users when their seller application is approved.'),
    ('sms_enabled_order_updates', 'true'::jsonb, 'Enable SMS for marketplace order status updates.'),
    ('sms_enabled_welcome', 'true'::jsonb, 'Enable welcome SMS notifications for new user registrations.'),
    ('sms_enabled_role_update', 'true'::jsonb, 'Enable SMS notifications when a user''s role is updated by an admin.'),
    ('sms_enabled_admin_promo', 'true'::jsonb, 'Enable SMS notifications when a user is promoted to an administrator.'),
    ('sms_enabled_subscription', 'true'::jsonb, 'Enable SMS notifications for subscription activations, renewals, and suspensions.')
ON CONFLICT (key) DO UPDATE 
SET description = EXCLUDED.description;

-- Ensure enable_sms also exists in platform_settings if it's used as a global override
INSERT INTO platform_settings (key, value, description)
VALUES ('enable_sms', 'true'::jsonb, 'Global master switch for all outdoor SMS notifications.')
ON CONFLICT (key) DO NOTHING;
