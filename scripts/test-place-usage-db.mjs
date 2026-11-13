// 운영 DB에 접속하지 않고 임시 PostgreSQL에서 권한·환급·동시 요청을 확인한다.
import assert from "node:assert/strict";
import { execFile, execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { promisify } from "node:util";

const bin = process.env.POSTGRES_TEST_BIN ?? "/opt/homebrew/opt/postgresql@18/bin";
const directory = mkdtempSync("/private/tmp/place-usage-db-");
const data = join(directory, "data");
const pg = (name, args) => execFileSync(join(bin, name), args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
const args = ["-X", "-v", "ON_ERROR_STOP=1", "-At", "-h", directory, "-U", "postgres", "-d", "postgres"];
const sql = text => pg("psql", [...args, "-c", text]);
const dbFile = path => pg("psql", [...args, "-f", path]);
const reserveSql = (user, admin, id) => `select public.reserve_place_search('${user}', ${admin}, '${id}')`;
const parse = output => JSON.parse(output.split("\n").find(line => line.startsWith("{")));
const reserve = (user, admin = false, id = randomUUID()) => ({ id, ...parse(sql(`set role service_role; ${reserveSql(user, admin, id)}`)) });
const finish = (id, succeeded) => sql(`set role service_role; select public.finish_place_search('${id}', ${succeeded});`);
const user = () => { const id = randomUUID(); sql(`insert into auth.users(id) values ('${id}')`); return id; };
const reset = () => sql("truncate public.place_search_requests, public.place_search_windows; update public.place_search_limits set enabled=true, user_minute_limit=1000, global_minute_limit=1000, global_monthly_limit=10000;");
let started = false;
let checks = 0;
try {
  pg("initdb", ["-D", data, "-U", "postgres", "--no-locale", "-E", "UTF8", "--auth-local=trust", "--auth-host=reject"]);
  pg("pg_ctl", ["-D", data, "-l", join(directory, "postgres.log"), "-o", `-F -k ${directory} -c listen_addresses='' -c timezone=UTC`, "-w", "start"]);
  started = true;
  sql("create role anon; create role authenticated; create role service_role bypassrls; create schema auth; create table auth.users(id uuid primary key); create function auth.uid() returns uuid language sql as 'select null::uuid';");
  dbFile("supabase/migrations/20261013000000_accounts.sql");
  dbFile("supabase/migrations/20261016000000_place_search_usage.sql");
  const admin = user();
  assert.equal(reserve(admin, true).code, "SEARCH_PAUSED"); checks++;
  assert.equal(sql("select has_function_privilege('authenticated','public.reserve_place_search(uuid,boolean,uuid)','execute'), has_function_privilege('anon','public.finish_place_search(uuid,boolean)','execute'), has_function_privilege('service_role','public.reserve_place_search(uuid,boolean,uuid)','execute')").trim(), "f|f|t");
  assert.throws(() => sql("set role authenticated; update public.place_search_limits set enabled=true")); checks++;

  reset();
  const free = user();
  for (let i = 0; i < 5; i++) { const r = reserve(free); assert.equal(r.remaining, 4 - i); finish(r.id, true); }
  sql("update public.place_search_limits set user_minute_limit=5");
  assert.equal(reserve(free).code, "SEARCH_QUOTA_EXCEEDED"); checks++;
  sql("update public.place_search_limits set user_minute_limit=1000");
  const refund = user();
  const failed = reserve(refund); finish(failed.id, false);
  const retried = reserve(refund); assert.equal(retried.remaining, 4); finish(retried.id, true);
  finish(retried.id, false);
  assert.equal(reserve(refund).remaining, 3); checks++;
  const busy = user(); reserve(busy);
  assert.equal(reserve(busy).code, "SEARCH_BUSY"); checks++;
  for (let i = 0; i < 7; i++) { const r = reserve(admin, true); assert.equal(r.tier, "admin"); assert.equal(r.remaining, null); finish(r.id, true); } checks++;

  reset();
  sql("update public.place_search_limits set user_minute_limit=1");
  const one = reserve(admin, true); finish(one.id, true);
  assert.equal(reserve(admin, true).code, "SEARCH_RATE_LIMITED"); checks++;
  reset();
  sql("update public.place_search_limits set global_monthly_limit=1");
  const global = reserve(admin, true); finish(global.id, false);
  assert.equal(reserve(user()).code, "SEARCH_BUDGET_EXCEEDED");
  assert.equal(reserve(user(), true).code, "SEARCH_BUDGET_EXCEEDED");
  sql(`delete from auth.users where id='${admin}'`);
  assert.equal(reserve(user()).code, "SEARCH_BUDGET_EXCEEDED"); checks++;
  reset();
  sql("update public.place_search_limits set global_minute_limit=1");
  const minute = reserve(user()); finish(minute.id, true);
  assert.equal(reserve(user(), true).code, "SEARCH_RATE_LIMITED"); checks++;

  reset();
  const paid = user();
  sql(`insert into public.entitlements(user_id,premium,updated_at,expires_at) values ('${paid}',true,now()-interval '31 days',now()+interval '10 days');
    insert into public.place_search_requests(request_id,user_id,created_at,status) select gen_random_uuid(),'${paid}',now()-interval '2 days','succeeded' from generate_series(1,30);`);
  const paidFirst = reserve(paid); assert.equal(paidFirst.tier, "paid"); assert.equal(paidFirst.remaining, 29); finish(paidFirst.id, true);
  sql(`insert into public.place_search_requests(request_id,user_id,created_at,status) select gen_random_uuid(),'${paid}',now()-interval '1 hour','succeeded' from generate_series(1,29);`);
  assert.equal(reserve(paid).code, "SEARCH_QUOTA_EXCEEDED"); checks++;
  const expired = user();
  sql(`insert into public.entitlements(user_id,premium,expires_at) values ('${expired}',true,now()-interval '1 day')`);
  assert.equal(reserve(expired).tier, "free"); checks++;
  const freshMonth = user();
  sql(`insert into public.place_search_requests(request_id,user_id,created_at,status) select gen_random_uuid(),'${freshMonth}',date_trunc('month',now())-interval '1 day','succeeded' from generate_series(1,5);`);
  assert.equal(reserve(freshMonth).remaining, 4); checks++;

  async function concurrent(users, limit) {
    reset(); sql(`update public.place_search_limits set global_monthly_limit=${limit}`);
    const run = promisify(execFile);
    const results = await Promise.all(users.map(async id => {
      const request = randomUUID();
      const { stdout } = await run(join(bin, "psql"), [...args, "-c", `begin; set local role service_role; ${reserveSql(id, false, request)}; select public.finish_place_search('${request}',true); commit;`], { encoding: "utf8" });
      return parse(stdout);
    }));
    return results.filter(r => r.allowed).length;
  }
  const parallelUser = user();
  assert.equal(await concurrent(Array(12).fill(parallelUser), 10000), 5); checks++;
  assert.equal(await concurrent(Array.from({ length: 12 }, user), 4), 4); checks++;
  console.log(`PostgreSQL usage checks passed: ${checks} (including concurrent requests and client permission denial)`);
} catch (error) {
  if (started) console.error(readFileSync(join(directory, "postgres.log"), "utf8").split("\n").slice(-8).join("\n"));
  throw error;
} finally {
  if (started) pg("pg_ctl", ["-D", data, "-m", "fast", "-w", "stop"]);
  rmSync(directory, { recursive: true, force: true });
}
