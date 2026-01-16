-- Add a session_id column to the profiles table to track active sessions
-- This is used to enforce single-session login (logging out other devices when a new login occurs)

ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS active_session_id TEXT;
