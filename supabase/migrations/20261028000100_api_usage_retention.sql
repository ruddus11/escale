-- 끝난 API 사용량 창(분·하루 단위 합계)은 끝난 지 하루가 지나면 지운다. 매일 한 번 돈다.
-- 20261028000000_api_usage_limits.sql과 20261016000100_place_search_retention.sql(pg_cron 설치)을 먼저 적용한 뒤 실행한다.

select cron.schedule(
  'purge-api-usage-windows',
  -- 매일 03:33(UTC)
  '33 3 * * *',
  $$delete from public.api_usage_windows where expires_at < now() - interval '1 day'$$
);
