-- ==============================================================================
-- UPDATE SMS FEATURES
-- ==============================================================================

-- 1. Add Global SMS Toggle to Website Settings
ALTER TABLE public.website_settings 
ADD COLUMN IF NOT EXISTS enable_sms BOOLEAN DEFAULT true;

-- 2. Add SMS Sent Flag to Campus News to prevent duplicate notifications
ALTER TABLE public.campus_news 
ADD COLUMN IF NOT EXISTS sms_sent BOOLEAN DEFAULT false;

-- 3. Ensure profiles have valid phone numbers for testing (optional cleanup)
-- UPDATE profiles SET phone = NULL WHERE length(phone) < 10;
