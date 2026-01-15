-- Add Foreign Key if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.table_constraints 
        WHERE constraint_name = 'seller_applications_user_id_fkey'
    ) THEN
        ALTER TABLE seller_applications
        ADD CONSTRAINT seller_applications_user_id_fkey
        FOREIGN KEY (user_id) REFERENCES profiles(id)
        ON DELETE CASCADE;
    END IF;
END $$;

-- Enable RLS
ALTER TABLE seller_applications ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Users can view own applications" ON seller_applications;
DROP POLICY IF EXISTS "Users can create applications" ON seller_applications;
DROP POLICY IF EXISTS "Admins can view all applications" ON seller_applications;
DROP POLICY IF EXISTS "Admins can update applications" ON seller_applications;

-- Create Policies
CREATE POLICY "Users can view own applications"
ON seller_applications FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create applications"
ON seller_applications FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all applications"
ON seller_applications FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role IN ('admin', 'super_admin')
  )
);

CREATE POLICY "Admins can update applications"
ON seller_applications FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role IN ('admin', 'super_admin')
  )
);

-- Fix permissions for seller_profiles (just in case)
ALTER TABLE seller_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can manage seller profiles" ON seller_profiles;
CREATE POLICY "Admins can manage seller profiles"
ON seller_profiles FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role IN ('admin', 'super_admin')
  )
);

-- Grant access to authenticated users
GRANT ALL ON seller_applications TO authenticated;
GRANT ALL ON seller_profiles TO authenticated;
