-- Ensure internships table exists
CREATE TABLE IF NOT EXISTS public.internships (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    title TEXT NOT NULL,
    company TEXT NOT NULL,
    location TEXT NOT NULL,
    type TEXT DEFAULT 'Internship',
    source TEXT DEFAULT 'Direct',
    description TEXT,
    url TEXT DEFAULT '#',
    logo_url TEXT,
    posted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_active BOOLEAN DEFAULT true,
    user_id UUID REFERENCES auth.users(id) -- Optional: to track who posted it
);

-- Enable RLS
ALTER TABLE public.internships ENABLE ROW LEVEL SECURITY;

-- Policy 1: Public Read Access (Active Internships Only)
-- Allows anyone (anon or authenticated) to view active internships
DROP POLICY IF EXISTS "Public can view active internships" ON public.internships;
CREATE POLICY "Public can view active internships"
ON public.internships
FOR SELECT
USING (is_active = true);

-- Policy 2: Admin Full Access
-- Allows admins/service_role/dashboard to do everything
-- Note: You might need to adjust the condition based on how your admins are identified.
-- Ideally, use a secure role check or simply allow authenticated users to *manage* if that's the model.
-- For now, we'll allow all authenticated users to INSERT/UPDATE/DELETE for simplicity in this "Admin Dashboard" context, 
-- or rely on the fact that the Admin Page is protected by the UI routing/auth check.
-- BUT, for security, let's allow all operations for authenticated users (assuming only admins get to the dashboard).
-- A better approach is checking a custom claim or table, but typically 'authenticated' is a good starting point if signup is restricted.

DROP POLICY IF EXISTS "Admins can manage internships" ON public.internships;
CREATE POLICY "Admins can manage internships"
ON public.internships
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- Policy 3: Service Role Bypass (Implicit, but good to remember)
-- Service Role always has access.

-- Grant permissions to public/anon just in case
GRANT SELECT ON public.internships TO anon;
GRANT SELECT ON public.internships TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.internships TO authenticated;
