-- Add scheduled_at to campus_news
ALTER TABLE campus_news ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMP WITH TIME ZONE;

-- Create table for scheduled SMS
CREATE TABLE IF NOT EXISTS scheduled_sms (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  recipients JSONB NOT NULL, -- Array of strings
  message TEXT NOT NULL,
  scheduled_at TIMESTAMP WITH TIME ZONE NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'cancelled')),
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE scheduled_sms ENABLE ROW LEVEL SECURITY;

-- Policies for scheduled_sms
CREATE POLICY "Admins can view and manage all scheduled sms" 
ON scheduled_sms 
FOR ALL 
USING (
  exists (
    select 1 from profiles
    where profiles.id = auth.uid()
    and (profiles.role = 'admin' or profiles.role = 'super_admin')
  )
);
