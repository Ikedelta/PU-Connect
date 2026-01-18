-- Create the newsletter_subscribers table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.newsletter_subscribers (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE public.newsletter_subscribers ENABLE ROW LEVEL SECURITY;

-- Allow anonymous inserts (for public signup)
CREATE POLICY "Allow public insert to newsletter_subscribers"
    ON public.newsletter_subscribers FOR INSERT
    WITH CHECK (true);

-- Allow admins to read all subscribers
CREATE POLICY "Allow admins to view newsletter_subscribers"
    ON public.newsletter_subscribers FOR SELECT
    USING (
        exists (
            select 1 from public.profiles
            where profiles.id = auth.uid()
            and profiles.role in ('admin', 'super_admin')
        )
    );

-- Allow admins to delete (optional, for management)
CREATE POLICY "Allow admins to delete newsletter_subscribers"
    ON public.newsletter_subscribers FOR DELETE
    USING (
        exists (
            select 1 from public.profiles
            where profiles.id = auth.uid()
            and profiles.role in ('admin', 'super_admin')
        )
    );
