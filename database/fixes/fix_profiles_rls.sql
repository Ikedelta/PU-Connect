-- Enable RLS on profiles if not already
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Allow admins to view all profiles
CREATE POLICY "Allow admins to view all profiles"
    ON public.profiles FOR SELECT
    USING (
        exists (
            select 1 from public.profiles p
            where p.id = auth.uid()
            and p.role in ('admin', 'super_admin')
        )
    );

-- Allow admins to update any profile
CREATE POLICY "Allow admins to update any profile"
    ON public.profiles FOR UPDATE
    USING (
        exists (
            select 1 from public.profiles p
            where p.id = auth.uid()
            and p.role in ('admin', 'super_admin')
        )
    );

-- Allow admins to delete (if needed, though we use edge function usually)
CREATE POLICY "Allow admins to delete any profile"
    ON public.profiles FOR DELETE
    USING (
        exists (
            select 1 from public.profiles p
            where p.id = auth.uid()
            and p.role in ('admin', 'super_admin')
        )
    );
