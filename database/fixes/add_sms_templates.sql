-- Add SMS Templates to platform_settings
INSERT INTO platform_settings (key, value, description)
VALUES 
    ('sms_template_otp', '"Your Campus Connect verification code is: {otp}"'::jsonb, 'Template for OTP verification codes. Use {otp} as placeholder.'),
    ('sms_template_welcome', '"Welcome to Campus Connect, {name}! Your account has been successfully created. Browse the marketplace and connect with fellow students."'::jsonb, 'Welcome message for new users. Use {name} as placeholder.'),
    ('sms_template_seller_approval', '"Congratulations {name}! Your seller application for \"{business_name}\" has been APPROVED."'::jsonb, 'Seller approval notification. Use {name} and {business_name} as placeholders.'),
    ('sms_template_role_update', '"Hi {name}, your role on Campus Connect has been updated to \"{role}\"."'::jsonb, 'User role update notification. Use {name} and {role} as placeholders.'),
    ('sms_template_admin_promo', '"Congratulations! You have been promoted to an Administrator on Campus Connect."'::jsonb, 'Admin promotion notification.'),
    ('sms_template_news', '"Campus News Update: {title}. Read more on the Campus Connect app."'::jsonb, 'New campus news notification. Use {title} as placeholder.'),
    ('sms_template_seller_reg', '"System Alert: New Seller Application for \"{business_name}\" has been submitted. Review in Admin Dashboard."'::jsonb, 'Admin notification for new seller registration. Use {business_name} as placeholder.'),
    ('sms_template_subscription', '"Hi {name}, your subscription for your store has been {status}."'::jsonb, 'Subscription status update. Use {name} and {status} as placeholders.')
ON CONFLICT (key) DO UPDATE 
SET description = EXCLUDED.description;
