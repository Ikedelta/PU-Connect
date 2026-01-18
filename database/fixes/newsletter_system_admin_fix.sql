-- NEWSLETTER FIX V3 (ROBUST JSON RETURN)
-- 1. MIGRATION: Copy old data if it exists in 'newsletter_subscriptions'
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

-- 2. DROP OLD FUNCTION (To allow return type change)
drop function if exists sys_get_subs_list(text);

-- 3. NEW ROBUST FUNCTION (Returns JSON, Supports Limit)
create or replace function sys_get_subs_list(secret_key text, max_records int default null)
returns json
language plpgsql
security definer
as $$
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

-- 4. COUNT FUNCTION (Unchanged but ensuring it exists)
create or replace function sys_get_subs_count(secret_key text)
returns integer
language plpgsql
security definer
as $$
declare
  total integer;
begin
  if secret_key = 'pentvars-sys-admin-x892' then
    select count(*) into total from public.newsletter_subscribers;
    return total;
  else
    raise exception 'Access Denied';
  end if;
end;
$$;
