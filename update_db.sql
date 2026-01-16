-- 1. ADD MISSING COLUMN for System Default Password
ALTER TABLE website_settings 
ADD COLUMN IF NOT EXISTS system_default_password TEXT DEFAULT 'Password123!';

-- 2. FIX NEWS POLICY (Drop explicitly first)
DROP POLICY IF EXISTS "Admins manage news" ON campus_news;

CREATE POLICY "Admins manage news" 
ON campus_news FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin', 'news_publisher'))
);

-- 3. ENSURE news_publisher role is in enum (if you use an enum, otherwise skip)
-- If 'role' column is text, this isn't needed. If it's a TYPE, we might need to alter it.
-- Assuming 'role' is text based on previous context, but good to be safe.
-- Uncomment the below lines ONLY if you use a strict ENUM type for roles:
-- ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'news_publisher';

-- 4. CONFIRMATION
SELECT 'Database schema updated successfully' as status;
