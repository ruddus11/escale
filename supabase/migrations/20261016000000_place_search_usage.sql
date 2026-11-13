-- 검색 전에 사용량을 예약해 동시 요청과 서버 재시작으로 한도를 우회하지 못하게 한다.
-- 서버 설정을 확인한 뒤 enabled를 true로 바꾼다. 적용 직후에는 외부 유료 호출을 막는다.
begin;
create table public.place_search_limits (
  singleton boolean primary key default true check (singleton),
  enabled boolean not null default false,
  free_monthly_limit integer not null default 5 check (free_monthly_limit > 0),
  paid_window_limit integer not null default 30 check (paid_window_limit > 0),
  user_minute_limit integer not null default 5 check (user_minute_limit > 0),
  global_minute_limit integer not null default 30 check (global_minute_limit > 0),
  global_monthly_limit integer not null default 1000 check (global_monthly_limit > 0)
);
insert into public.place_search_limits (singleton) values (true);

create table public.place_search_requests (
  request_id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  status text not null default 'pending' check (status in ('pending', 'succeeded', 'failed'))
);
create index place_search_user_time on public.place_search_requests (user_id, created_at);

-- 전체 한도는 계정 삭제나 개인 차감 환급으로 되돌아가면 안 된다.
create table public.place_search_windows (
  window_key text primary key,
  used integer not null check (used >= 0),
  expires_at timestamptz not null
);
alter table public.place_search_limits enable row level security;
alter table public.place_search_requests enable row level security;
alter table public.place_search_windows enable row level security;
revoke all on public.place_search_limits, public.place_search_requests, public.place_search_windows from public, anon, authenticated;
grant all on public.place_search_limits, public.place_search_requests, public.place_search_windows to service_role;

create function public.reserve_place_search(p_user_id uuid, p_is_admin boolean, p_request_id uuid)
returns jsonb language plpgsql security invoker set search_path = '' set timezone = 'UTC' as $$
declare
  limits public.place_search_limits%rowtype;
  entitlement public.entitlements%rowtype;
  request_time timestamptz := clock_timestamp();
  month_start timestamptz;
  minute_start timestamptz;
  period_start timestamptz;
  reset_time timestamptz;
  month_key text;
  minute_key text;
  personal_limit integer;
  personal_used integer;
  month_used integer;
  minute_used integer;
  minute_personal integer;
  tier text := 'free';
  retry_seconds integer;
begin
  -- 개인·전체 사용량을 같은 짧은 트랜잭션에서 갱신한다.
  perform pg_catalog.pg_advisory_xact_lock(70441016301::bigint);
  request_time := clock_timestamp();
  select * into limits from public.place_search_limits where singleton = true;
  if not found or not limits.enabled then
    return jsonb_build_object('allowed', false, 'code', 'SEARCH_PAUSED', 'retryAfter', 60);
  end if;
  month_start := date_trunc('month', request_time at time zone 'UTC') at time zone 'UTC';
  minute_start := date_trunc('minute', request_time at time zone 'UTC') at time zone 'UTC';
  retry_seconds := greatest(1, ceil(extract(epoch from minute_start + interval '1 minute' - request_time))::integer);
  month_key := 'month:' || to_char(month_start at time zone 'UTC', 'YYYY-MM');
  minute_key := 'minute:' || to_char(minute_start at time zone 'UTC', 'YYYY-MM-DD-HH24-MI');
  select coalesce(sum(used), 0) into month_used from public.place_search_windows where window_key = month_key;
  select coalesce(sum(used), 0) into minute_used from public.place_search_windows where window_key = minute_key;
  if month_used >= limits.global_monthly_limit then
    return jsonb_build_object('allowed', false, 'code', 'SEARCH_BUDGET_EXCEEDED', 'retryAfter', 3600);
  end if;
  period_start := month_start;
  reset_time := month_start + interval '1 month';
  personal_limit := limits.free_monthly_limit;
  if p_is_admin then
    tier := 'admin'; personal_limit := null;
  else
    select * into entitlement from public.entitlements where user_id = p_user_id and premium = true and updated_at <= request_time and (expires_at is null or expires_at > request_time);
    if found then
      tier := 'paid';
      -- 유료 권한 갱신 시점에 고정한 30일 구간으로 계산한다. 요청할 때마다 시작점을 옮기지 않는다.
      period_start := entitlement.updated_at + floor(extract(epoch from request_time - entitlement.updated_at) / 2592000) * interval '30 days';
      reset_time := least(period_start + interval '30 days', coalesce(entitlement.expires_at, 'infinity'::timestamptz));
      personal_limit := limits.paid_window_limit;
    end if;
    select count(*) into personal_used from public.place_search_requests where user_id = p_user_id and created_at >= period_start and status in ('pending', 'succeeded');
    if personal_used >= personal_limit then
      return jsonb_build_object('allowed', false, 'code', 'SEARCH_QUOTA_EXCEEDED', 'retryAfter', greatest(1, ceil(extract(epoch from reset_time - request_time))::integer));
    end if;
  end if;

  select count(*) into minute_personal from public.place_search_requests where user_id = p_user_id and created_at >= minute_start;
  if minute_used >= limits.global_minute_limit or minute_personal >= limits.user_minute_limit then
    return jsonb_build_object('allowed', false, 'code', 'SEARCH_RATE_LIMITED', 'retryAfter', retry_seconds);
  end if;
  if exists (select 1 from public.place_search_requests where user_id = p_user_id and status = 'pending' and created_at > request_time - interval '45 seconds') then
    return jsonb_build_object('allowed', false, 'code', 'SEARCH_BUSY', 'retryAfter', 45);
  end if;
  insert into public.place_search_requests (request_id, user_id, created_at) values (p_request_id, p_user_id, request_time);
  insert into public.place_search_windows (window_key, used, expires_at) values (month_key, 1, month_start + interval '1 month')
    on conflict (window_key) do update set used = public.place_search_windows.used + 1;
  insert into public.place_search_windows (window_key, used, expires_at) values (minute_key, 1, minute_start + interval '1 minute')
    on conflict (window_key) do update set used = public.place_search_windows.used + 1;
  return jsonb_build_object('allowed', true, 'tier', tier, 'limit', personal_limit, 'remaining', case when p_is_admin then null else personal_limit - personal_used - 1 end, 'resetsAt', reset_time);
end;
$$;

-- 완료 처리는 한 번만 허용해 중복 환급이나 성공한 검색의 사후 취소를 막는다.
create function public.finish_place_search(p_request_id uuid, p_succeeded boolean)
returns void language sql security invoker set search_path = '' set timezone = 'UTC' as $$
  update public.place_search_requests set status = case when p_succeeded then 'succeeded' else 'failed' end
  where request_id = p_request_id and status = 'pending';
$$;
revoke all on function public.reserve_place_search(uuid, boolean, uuid) from public, anon, authenticated;
revoke all on function public.finish_place_search(uuid, boolean) from public, anon, authenticated;
grant execute on function public.reserve_place_search(uuid, boolean, uuid) to service_role;
grant execute on function public.finish_place_search(uuid, boolean) to service_role;
commit;
