-- 약관·개인정보 동의와 AI·장소 기능 동의(기능별)의 기록. 앱은 로그인 전에 받은 계정 동의를 로그인한 뒤 이 표에 올린다.
-- 동의 사실을 보여 줄 근거라 사용자는 자기 행을 추가·조회만 하고 고치거나 지우지 못한다.
-- 동의와 철회를 한 행씩 쌓는다. 계정을 삭제하면 다른 표처럼 함께 지워진다.

create table public.consents (
  user_id uuid not null references auth.users (id) on delete cascade,
  -- account: 이용약관·개인정보 수집·국외 이전·만 14세 확인
  -- recommend: 장소 추천 / booking: 예약 메일 읽기 / pouch: Jev로 다시 읽기(AI·장소 기능은 기능마다 따로 동의)
  kind text not null check (kind in ('account', 'recommend', 'booking', 'pouch')),
  -- agree: 동의 / withdraw: 철회. 계정 동의의 철회는 계정 삭제라 기록이 남지 않는다.
  event text not null default 'agree' check (event in ('agree', 'withdraw')),
  -- 동의한 문서 판(앱의 LEGAL_VERSION, AI_CONSENT_VERSION). 예: '2026-10-15', '2026-10-16.2'
  version text not null check (char_length(version) between 1 and 20),
  items text[] not null default '{}' check (items <@ array['age14', 'terms', 'collection', 'overseas']::text[]),
  -- 기기에서 동의하거나 철회한 시각. 서버가 받은 시각은 recorded_at.
  occurred_at timestamptz not null,
  recorded_at timestamptz not null default now(),
  primary key (user_id, kind, event, version, occurred_at),
  constraint consents_withdraw_feature_only check (event = 'agree' or kind <> 'account'),
  -- 기기 시계가 크게 앞선 기록은 받지 않는다.
  constraint consents_occurred_not_future check (occurred_at <= recorded_at + interval '1 day')
);

alter table public.consents enable row level security;

create policy "own consent select" on public.consents
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "own consent insert" on public.consents
  for insert to authenticated with check ((select auth.uid()) = user_id);

grant select, insert on public.consents to authenticated;
grant all on public.consents to service_role;
revoke all on public.consents from anon;
