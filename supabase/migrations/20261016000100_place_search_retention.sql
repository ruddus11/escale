-- 둘러보기 이용 기록(누가 언제 검색했는지)은 처리방침대로 2개월만 둔다.
-- 검색 횟수 한도는 이번 달(무료)과 지난 30일(유료)만 세므로 2개월이 지난 기록은 쓰이지 않는다.
-- 끝난 사용량 구간(분·월 단위 합계)도 끝난 지 하루가 지나면 지운다. 매일 한 번 돈다.
-- 20261016000000_place_search_usage.sql을 먼저 적용한 뒤 실행한다.

create extension if not exists pg_cron with schema pg_catalog;
-- Supabase Cron 설치 안내(supabase.com/docs/guides/cron/install)대로 postgres가 예약과 실행 기록을 보게 한다.
grant usage on schema cron to postgres;
grant all privileges on all tables in schema cron to postgres;

select cron.schedule(
  'purge-place-search-requests',
  -- 매일 03:29(UTC)
  '29 3 * * *',
  $$delete from public.place_search_requests where created_at < now() - interval '2 months'$$
);

select cron.schedule(
  'purge-place-search-windows',
  -- 매일 03:31(UTC)
  '31 3 * * *',
  $$delete from public.place_search_windows where expires_at < now() - interval '1 day'$$
);

-- 적용한 다음 날 아래로 실행 결과를 확인한다.
-- select jobname, status, return_message, start_time from cron.job_run_details join cron.job using (jobid) order by start_time desc limit 5;
