-- 로그인 기록(접속 일시·IP 주소)은 처리방침대로 3개월만 둔다(통신비밀보호법 시행령 제41조의 보관 기간).
-- Supabase는 데이터베이스에 쓴 로그인 기록(auth.audit_log_entries)을 스스로 지우지 않아서,
-- 계정을 삭제해도 이메일·IP가 남는다. 매일 한 번 3개월이 지난 기록을 지운다.
-- 대시보드에서 "Write audit logs to the database"를 꺼 둔 프로젝트에서는 지울 것이 없어 아무 일도 하지 않는다.

create extension if not exists pg_cron with schema pg_catalog;
-- Supabase Cron 설치 안내(supabase.com/docs/guides/cron/install)대로 postgres가 예약과 실행 기록을 보게 한다.
grant usage on schema cron to postgres;
grant all privileges on all tables in schema cron to postgres;

select cron.schedule(
  'purge-auth-audit-log',
  -- 매일 03:17(UTC)
  '17 3 * * *',
  $$delete from auth.audit_log_entries where created_at < now() - interval '3 months'$$
);

-- 적용한 다음 날 아래로 실행 결과를 확인한다. status가 failed면 권한 문제이니 처리방침의 보관 기간을 다시 맞춘다.
-- select status, return_message, start_time from cron.job_run_details order by start_time desc limit 5;
