-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 1. Essential: Allow users to view their own profile (Breaks recursion for admin check)
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile"
    ON public.profiles FOR SELECT
    USING (auth.uid() = id);

-- 2. Allow admins to view all profiles
-- Now the subquery matches the user's own row (allowed by policy #1), so recursion is resolved
DROP POLICY IF EXISTS "Allow admins to view all profiles" ON public.profiles;
CREATE POLICY "Allow admins to view all profiles"
    ON public.profiles FOR SELECT
    USING (
        exists (
            select 1 from public.profiles
            where id = auth.uid()
            and role in ('admin', 'super_admin')
        )
    );

-- 3. Allow admins to update any profile
DROP POLICY IF EXISTS "Allow admins to update any profile" ON public.profiles;
CREATE POLICY "Allow admins to update any profile"
    ON public.profiles FOR UPDATE
    USING (
        exists (
            select 1 from public.profiles
            where id = auth.uid()
            and role in ('admin', 'super_admin')
        )
    );

-- 4. Allow users to update their own profile
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
    ON public.profiles FOR UPDATE
    USING (auth.uid() = id);

-- 5. Allow public insert (for registration)
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON public.profiles;
CREATE POLICY "Enable insert for authenticated users only"
    ON public.profiles FOR INSERT
    WITH CHECK (auth.uid() = id);
