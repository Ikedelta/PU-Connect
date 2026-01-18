-- Create the platform_settings table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.platform_settings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    key TEXT UNIQUE NOT NULL,
    value JSONB NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;

-- Allow public read access (so app can check settings like subscriptions_enabled)
CREATE POLICY "Allow public read access"
    ON public.platform_settings FOR SELECT
    USING (true);

-- Allow admins to update settings
CREATE POLICY "Allow admins to update settings"
    ON public.platform_settings FOR ALL
    USING (
        exists (
            select 1 from public.profiles
            where profiles.id = auth.uid()
            and profiles.role in ('admin', 'super_admin')
        )
    );

-- Insert default settings if they don't exist
INSERT INTO public.platform_settings (key, value)
VALUES ('subscriptions_enabled', 'true'::jsonb)
ON CONFLICT (key) DO NOTHING;
