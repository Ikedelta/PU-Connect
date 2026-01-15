-- Add business_logo column to seller_applications
alter table seller_applications 
add column if not exists business_logo text;

-- Add business_logo column to seller_profiles as well, for persistence after approval
alter table seller_profiles
add column if not exists business_logo text;
