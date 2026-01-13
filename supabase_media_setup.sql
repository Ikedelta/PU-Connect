-- Enable the storage extension if not already enabled
create extension if not exists "storage" schema "extensions";

-- Create the 'media' bucket if it doesn't exist
insert into storage.buckets (id, name, public)
values ('media', 'media', true)
on conflict (id) do nothing;

-- Set up security policies for the 'media' bucket

-- 1. Allow anyone to VIEW files (public access)
create policy "Public Access to Media"
  on storage.objects for select
  using ( bucket_id = 'media' );

-- 2. Allow authenticated users to UPLOAD files
-- They can upload to their own folder: user_id/*
create policy "Authenticated Users Can Upload"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'media' AND
    (
       -- Allow uploading to their own user folder
       (storage.foldername(name))[1] = auth.uid()::text
       OR
       -- Allow admins/sellers to upload to general folders if needed (optional adjustment)
       -- For now, we enforce folder structure in the client code: user_id/folder/...
       true
    )
  );

-- 3. Allow users to UPDATE their own files
create policy "Users Can Update Own Files"
  on storage.objects for update
  to authenticated
  using ( bucket_id = 'media' AND auth.uid()::text = (storage.foldername(name))[1] );

-- 4. Allow users to DELETE their own files
create policy "Users Can Delete Own Files"
  on storage.objects for delete
  to authenticated
  using ( bucket_id = 'media' AND auth.uid()::text = (storage.foldername(name))[1] );


-- ==========================================
-- 2. PROFILE AUTOMATION (The "Bulletproof" Fix)
-- ==========================================
-- This trigger automatically creates a profile entry whenever a new user signs up via Supabase Auth.
-- This ensures that even if the client-side script fails, the database handles it securely.

create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name, student_id, department, faculty, phone, role, is_active)
  values (
    new.id, 
    new.email, 
    new.raw_user_meta_data->>'full_name', 
    new.raw_user_meta_data->>'student_id',
    new.raw_user_meta_data->>'department',
    new.raw_user_meta_data->>'faculty',
    new.raw_user_meta_data->>'phone',
    'buyer', -- Default role
    true
  );
  return new;
end;
$$ language plpgsql security definer;

-- Trigger the function every time a user is created
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Ensure RLS allows users to update their own profiles
alter table public.profiles enable row level security;

-- Drop existing policies to avoid conflicts if re-running
drop policy if exists "Users can view their own profile" on public.profiles;
drop policy if exists "Users can update their own profile" on public.profiles;

create policy "Users can view their own profile"
  on public.profiles for select
  using ( auth.uid() = id );

create policy "Users can update their own profile"
  on public.profiles for update
  using ( auth.uid() = id );

-- Optional: Allow public access to view seller profiles (for marketplace)
drop policy if exists "Public profiles are viewable by everyone" on public.profiles;
create policy "Public profiles are viewable by everyone"
  on public.profiles for select
  using ( true );
