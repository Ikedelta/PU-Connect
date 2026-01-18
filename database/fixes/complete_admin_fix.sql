-- COMPLETE ADMIN FIX V10
-- Includes: Login, Schema, Newsletter, SMS, Tickets (Update/Delete), Profile Edit, Admin Actions, CREATE PRODUCT FOR USER, PUBLIC STATS

-- 1. UTILITY: Create tables if missing
create table if not exists public.website_settings (
    site_name text primary key default 'Campus Marketplace',
    enable_sms boolean default true,
    site_tagline text,
    hero_title text,
    hero_subtitle text,
    hero_cta_text text,
    about_title text,
    about_description text,
    contact_email text,
    contact_phone text,
    whatsapp_number text,
    facebook_url text,
    twitter_url text,
    instagram_url text,
    footer_text text,
    system_default_password text,
    updated_at timestamp with time zone default timezone('utc'::text, now())
);
insert into public.website_settings (site_name, enable_sms) values ('Campus Marketplace', true) on conflict do nothing;

create table if not exists public.newsletter_subscribers (
    id uuid default gen_random_uuid() primary key,
    email text unique not null,
    is_active boolean default true,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table if not exists public.support_tickets (
    id uuid default gen_random_uuid() primary key,
    user_id uuid references auth.users(id),
    subject text not null,
    message text not null,
    status text default 'open',
    priority text default 'medium',
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 2. System Admin Profile Fix
delete from public.profiles where email = 'system.admin@gmail.com';
insert into public.profiles (id, email, full_name, role, is_active)
values ('00000000-0000-0000-0000-000000000000', 'system.admin@gmail.com', 'System Administrator', 'super_admin', true);

-- 3. Newsletter RPCs
drop function if exists sys_get_subs_list(text);
create or replace function sys_get_subs_list(secret_key text, max_records int default null)
returns json
language plpgsql security definer as $$
declare
  result json;
begin
  if secret_key = 'pentvars-sys-admin-x892' then
    if max_records is not null then
      select json_agg(t) into result from (
        select * from public.newsletter_subscribers order by created_at desc limit max_records
      ) t;
    else
      select json_agg(t) into result from (
        select * from public.newsletter_subscribers order by created_at desc
      ) t;
    end if;
    return coalesce(result, '[]'::json);
  else
    raise exception 'Access Denied';
  end if;
end;
$$;

create or replace function sys_get_subs_count(secret_key text)
returns integer language plpgsql security definer as $$
begin
  if secret_key = 'pentvars-sys-admin-x892' then
    return (select count(*) from public.newsletter_subscribers);
  else
    raise exception 'Access Denied';
  end if;
end;
$$;

-- 4. Email & Subscriber Edit RPCs
create or replace function sys_get_profiles_emails(secret_key text, role_filter text default null)
returns json language plpgsql security definer as $$
declare
  result json;
begin
  if secret_key = 'pentvars-sys-admin-x892' then
    if role_filter is null then
      select json_agg(t) into result from (select email from public.profiles where email is not null) t;
    else
      if role_filter = 'sellers' then
        select json_agg(t) into result from (select email from public.profiles where role in ('seller', 'publisher_seller') and email is not null) t;
      else
        select json_agg(t) into result from (select email from public.profiles where role = role_filter and email is not null) t;
      end if;
    end if;
    return coalesce(result, '[]'::json);
  else
    raise exception 'Access Denied';
  end if;
end;
$$;

create or replace function sys_update_subscriber(target_id uuid, new_email text, secret_key text)
returns void language plpgsql security definer as $$
begin
  if secret_key = 'pentvars-sys-admin-x892' then
    update public.newsletter_subscribers set email = new_email where id = target_id;
  else
    raise exception 'Access Denied';
  end if;
end;
$$;

-- 5. WEBSITE SETTINGS SYNC RPCs
create or replace function sys_get_website_settings(secret_key text)
returns json language plpgsql security definer as $$
begin
  if secret_key = 'pentvars-sys-admin-x892' then
    return (select row_to_json(t) from public.website_settings t limit 1);
  else
    raise exception 'Access Denied';
  end if;
end;
$$;

create or replace function sys_update_website_settings_full(data json, secret_key text)
returns void language plpgsql security definer as $$
begin
  if secret_key = 'pentvars-sys-admin-x892' then
    update public.website_settings set
      enable_sms = (data->>'enable_sms')::boolean,
      site_name = data->>'site_name',
      site_tagline = data->>'site_tagline',
      hero_title = data->>'hero_title',
      hero_subtitle = data->>'hero_subtitle',
      hero_cta_text = data->>'hero_cta_text',
      about_title = data->>'about_title',
      about_description = data->>'about_description',
      contact_email = data->>'contact_email',
      contact_phone = data->>'contact_phone',
      whatsapp_number = data->>'whatsapp_number',
      facebook_url = data->>'facebook_url',
      twitter_url = data->>'twitter_url',
      instagram_url = data->>'instagram_url',
      footer_text = data->>'footer_text',
      system_default_password = data->>'system_default_password',
      updated_at = now()
    where site_name = 'Campus Marketplace';
    
    if not found then
       insert into public.website_settings (site_name, enable_sms) values ('Campus Marketplace', true);
    end if;
  end if;
end;
$$;

create or replace function admin_update_settings(setting_key text, setting_value boolean, secret_key text)
returns void language plpgsql security definer as $$
begin
  if secret_key = 'pentvars-sys-admin-x892' then
    update public.website_settings set enable_sms = setting_value where site_name = 'Campus Marketplace';
  end if;
end;
$$;

-- 6. SUPPORT TICKETS RPCs
create or replace function sys_get_support_tickets(secret_key text)
returns json language plpgsql security definer as $$
declare
  result json;
begin
  if secret_key = 'pentvars-sys-admin-x892' then
    select json_agg(row_to_json(t)) into result from (
      select t.*, p.full_name as user_full_name, p.email as user_email, p.phone as user_phone
      from public.support_tickets t
      left join public.profiles p on t.user_id = p.id
      order by t.created_at desc
    ) t;
    return coalesce(result, '[]'::json);
  else
    raise exception 'Access Denied';
  end if;
end;
$$;

create or replace function sys_get_support_stats(secret_key text)
returns integer language plpgsql security definer as $$
begin
  if secret_key = 'pentvars-sys-admin-x892' then
    return (select count(*) from public.support_tickets where status in ('open', 'in_progress'));
  else
    raise exception 'Access Denied';
  end if;
end;
$$;

create or replace function sys_create_support_ticket(
  user_id uuid, subject text, message text, priority text, secret_key text
) returns void language plpgsql security definer as $$
begin
  if secret_key = 'pentvars-sys-admin-x892' then
    insert into public.support_tickets (user_id, subject, message, priority, status)
    values (user_id, subject, message, priority, 'open');
  end if;
end;
$$;

create or replace function sys_update_support_ticket(ticket_id uuid, new_status text, secret_key text)
returns void language plpgsql security definer as $$
begin
  if secret_key = 'pentvars-sys-admin-x892' then
    update public.support_tickets set status = new_status where id = ticket_id;
  else
    raise exception 'Access Denied';
  end if;
end;
$$;

create or replace function sys_delete_support_ticket(ticket_id uuid, secret_key text)
returns void language plpgsql security definer as $$
begin
  if secret_key = 'pentvars-sys-admin-x892' then
    delete from public.support_tickets where id = ticket_id;
  else
    raise exception 'Access Denied';
  end if;
end;
$$;

-- 7. PROFILE SELF EDIT
create or replace function sys_update_my_profile(
    new_email text,
    new_full_name text,
    new_phone text,
    new_avatar_url text,
    new_dept text,
    new_faculty text,
    secret_key text
) returns void language plpgsql security definer as $$
begin
  if secret_key = 'pentvars-sys-admin-x892' then
     update public.profiles
     set email = new_email,
         full_name = new_full_name,
         phone = new_phone,
         avatar_url = new_avatar_url,
         department = new_dept,
         faculty = new_faculty,
         updated_at = now()
     where id = '00000000-0000-0000-0000-000000000000';
  else
    raise exception 'Access Denied';
  end if;
end;
$$;

-- 8. ADMIN ACTIONS (Approve Seller, Hide Products, Edit User, Add Product For User, Get Sellers)
create or replace function admin_update_profile(target_id uuid, new_data json, secret_key text)
returns void language plpgsql security definer as $$
begin
  if secret_key = 'pentvars-sys-admin-x892' then
    update public.profiles 
    set full_name = new_data->>'full_name',
        role = new_data->>'role',
        is_active = (new_data->>'is_active')::boolean
    where id = target_id;
  end if;
end;
$$;

create or replace function admin_hide_all_products(target_user_id uuid, secret_key text)
returns void language plpgsql security definer as $$
begin
  if secret_key = 'pentvars-sys-admin-x892' then
    update public.products set is_active = false where seller_id = target_user_id;
  end if;
end;
$$;

create or replace function admin_update_application(app_id uuid, new_status text, secret_key text)
returns void language plpgsql security definer as $$
begin
  if secret_key = 'pentvars-sys-admin-x892' then
    update public.seller_applications 
    set status = new_status, 
        reviewed_at = now()
    where id = app_id;
  end if;
end;
$$;

create or replace function admin_upsert_seller_profile(
  target_user_id uuid, initial_name text, category text, secret_key text
) returns void language plpgsql security definer as $$
begin
  if secret_key = 'pentvars-sys-admin-x892' then
     insert into public.seller_profiles (user_id, business_name, business_category, is_active, created_at)
     values (target_user_id, initial_name, category, true, now())
     on conflict (user_id) do nothing;
  end if;
end;
$$;

create or replace function sys_get_sellers_list(secret_key text)
returns json language plpgsql security definer as $$
declare result json;
begin
  if secret_key = 'pentvars-sys-admin-x892' then
    select json_agg(t) into result from (select id, full_name, role from public.profiles where role in ('seller', 'publisher_seller')) t;
    return coalesce(result, '[]'::json);
  else
    raise exception 'Access Denied';
  end if;
end;
$$;

create or replace function sys_create_product_for_user(
  seller_id uuid,
  name text,
  description text,
  price numeric,
  category text,
  images text[],
  secret_key text
) returns void language plpgsql security definer as $$
begin
  if secret_key = 'pentvars-sys-admin-x892' then
    insert into public.products (seller_id, name, description, price, category, images, is_active, created_at)
    values (seller_id, name, description, price, category, images, true, now());
  else
    raise exception 'Access Denied';
  end if;
end;
$$;

-- 10. PUBLIC STATS (For Home Page)
create or replace function get_public_stats()
returns json language plpgsql security definer as $$
declare
  user_count int;
  product_count int;
begin
  select count(*) into user_count from public.profiles;
  select count(*) into product_count from public.products where is_active = true;
  return json_build_object('users', user_count, 'products', product_count);
end;
$$;

-- 11. Data Migration
do $$
begin
  if exists (select from pg_tables where tablename = 'newsletter_subscriptions') then
    insert into public.newsletter_subscribers (email, created_at)
    select email, created_at from public.newsletter_subscriptions
    where email not in (select email from public.newsletter_subscribers)
    on conflict do nothing;
  end if;
end
$$;
