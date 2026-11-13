-- 유료 API(Google Places·Jev) 호출 횟수를 모든 서버 인스턴스가 함께 센다. server/security/costGuard.ts가 쓴다.
-- 적용하지 않아도 서버는 인스턴스 메모리로 세며 동작한다. 적용하면 인스턴스가 여러 개여도 한도가 정확해진다.
-- 열쇠에는 계정 ID 또는 IP 해시와 창 시작 시각만 들어간다. 검색어·결과는 넣지 않는다.
begin;
create table public.api_usage_windows (
  window_key text primary key check (length(window_key) <= 200),
  used integer not null check (used >= 0),
  expires_at timestamptz not null
);
alter table public.api_usage_windows enable row level security;
revoke all on public.api_usage_windows from public, anon, authenticated;
grant all on public.api_usage_windows to service_role;

-- 모든 창이 한도 아래일 때만 전부 1씩 올린다. 하나라도 찼으면 아무것도 올리지 않고 찬 창의 순번(0부터)을 돌려준다.
-- 거절된 요청을 세지 않아야 한 사람의 반복 시도로 전체 한도가 소진되지 않는다.
create function public.hit_api_limits(p_keys text[], p_limits integer[], p_expires timestamptz[])
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  size integer := coalesce(array_length(p_keys, 1), 0);
  i integer;
  current_used integer;
  blocked integer[] := '{}';
begin
  if size = 0 or size > 8 or size <> coalesce(array_length(p_limits, 1), 0) or size <> coalesce(array_length(p_expires, 1), 0) then
    raise exception 'invalid api limit arguments';
  end if;
  -- 같은 열쇠를 세는 요청끼리만 기다리게 열쇠마다 잠근다. 정렬된 순서로 잠가 교착을 피한다.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(k, 70441028))
    from (select distinct k from pg_catalog.unnest(p_keys) as k order by k) as sorted;
  for i in 1 .. size loop
    select w.used into current_used from public.api_usage_windows w where w.window_key = p_keys[i] and w.expires_at > pg_catalog.now();
    if coalesce(current_used, 0) >= p_limits[i] then
      blocked := blocked || (i - 1);
    end if;
  end loop;
  if coalesce(array_length(blocked, 1), 0) > 0 then
    return jsonb_build_object('allowed', false, 'blocked', to_jsonb(blocked));
  end if;
  for i in 1 .. size loop
    insert into public.api_usage_windows (window_key, used, expires_at) values (p_keys[i], 1, p_expires[i])
      on conflict (window_key) do update set
        used = case when public.api_usage_windows.expires_at > pg_catalog.now() then public.api_usage_windows.used + 1 else 1 end,
        expires_at = excluded.expires_at;
  end loop;
  return jsonb_build_object('allowed', true);
end;
$$;
revoke all on function public.hit_api_limits(text[], integer[], timestamptz[]) from public, anon, authenticated;
grant execute on function public.hit_api_limits(text[], integer[], timestamptz[]) to service_role;
commit;
