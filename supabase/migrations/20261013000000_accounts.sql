-- 계정별 수첩 백업과 유료 권한.
-- 수첩은 앱의 SQLite 저장 형식(JSON) 그대로 한 행에 둔다. 기기 간 충돌은 version으로 감지한다.

create table public.notebooks (
  user_id uuid primary key references auth.users (id) on delete cascade,
  payload jsonb not null,
  -- 저장할 때마다 1씩 오른다. 앱은 마지막으로 받은 version일 때만 덮어쓴다.
  version integer not null default 1 check (version > 0),
  updated_at timestamptz not null default now(),
  -- 앱 검증 한도(5MB)와 같게 둔다.
  constraint notebooks_payload_size check (octet_length(payload::text) <= 5000000)
);

alter table public.notebooks enable row level security;

create policy "own notebook select" on public.notebooks
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "own notebook insert" on public.notebooks
  for insert to authenticated with check ((select auth.uid()) = user_id and version = 1);
create policy "own notebook update" on public.notebooks
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- 유료 권한은 결제 검증 서버(service role)만 쓴다. 사용자는 자기 행을 읽기만 한다.
create table public.entitlements (
  user_id uuid primary key references auth.users (id) on delete cascade,
  premium boolean not null default false,
  -- null이면 만료 없음(평생 이용권 등). 구독이면 결제 서버가 갱신한다.
  expires_at timestamptz,
  source text not null default 'manual' check (source in ('manual', 'app_store', 'play_store')),
  updated_at timestamptz not null default now()
);

alter table public.entitlements enable row level security;

create policy "own entitlement select" on public.entitlements
  for select to authenticated using ((select auth.uid()) = user_id);

-- "새 표 자동 노출"을 끈 프로젝트에서도 동작하도록 필요한 권한만 명시한다.
-- 로그인하지 않은 사용자(anon)에게는 아무 권한도 주지 않는다. 행 단위 제한은 위 RLS가 한다.
grant select, insert, update on public.notebooks to authenticated;
grant select on public.entitlements to authenticated;
grant all on public.notebooks, public.entitlements to service_role;
revoke all on public.notebooks, public.entitlements from anon;
