// 운영 DB에 접속하지 않고 임시 PostgreSQL에서 API 사용량 함수의 권한·전부 아니면 무·동시 요청을 확인한다.
import assert from "node:assert/strict";
import { execFile, execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { promisify } from "node:util";

const bin = process.env.POSTGRES_TEST_BIN ?? "/opt/homebrew/opt/postgresql@18/bin";
const directory = mkdtempSync("/private/tmp/api-usage-db-");
const data = join(directory, "data");
const pg = (name, args) => execFileSync(join(bin, name), args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
const args = ["-X", "-v", "ON_ERROR_STOP=1", "-At", "-h", directory, "-U", "postgres", "-d", "postgres"];
const sql = text => pg("psql", [...args, "-c", text]);
const parse = output => JSON.parse(output.split("\n").find(line => line.startsWith("{")));
const array = values => `array[${values.join(",")}]`;
const hitSql = windows => `select public.hit_api_limits(${array(windows.map(w => `'${w.key}'`))}::text[], ${array(windows.map(w => w.limit))}::integer[], ${array(windows.map(() => "now() + interval '1 hour'"))}::timestamptz[])`;
const hit = windows => parse(sql(`set role service_role; ${hitSql(windows)}`));
const used = key => sql(`select coalesce((select used from public.api_usage_windows where window_key='${key}'), 0)`).trim();
let started = false;
let checks = 0;
try {
  pg("initdb", ["-D", data, "-U", "postgres", "--no-locale", "-E", "UTF8", "--auth-local=trust", "--auth-host=reject"]);
  pg("pg_ctl", ["-D", data, "-l", join(directory, "postgres.log"), "-o", `-F -k ${directory} -c listen_addresses='' -c timezone=UTC`, "-w", "start"]);
  started = true;
  sql("create role anon; create role authenticated; create role service_role bypassrls;");
  pg("psql", [...args, "-f", "supabase/migrations/20261028000000_api_usage_limits.sql"]);

  assert.equal(sql("select has_function_privilege('authenticated','public.hit_api_limits(text[],integer[],timestamptz[])','execute'), has_function_privilege('anon','public.hit_api_limits(text[],integer[],timestamptz[])','execute'), has_function_privilege('service_role','public.hit_api_limits(text[],integer[],timestamptz[])','execute')").trim(), "f|f|t");
  assert.throws(() => sql("set role authenticated; select * from public.api_usage_windows")); checks++;

  const user = { key: "PLACE:m:1:u:a", limit: 2 }, all = { key: "PLACE:d:all", limit: 3 };
  assert.deepEqual(hit([user, all]), { allowed: true });
  assert.deepEqual(hit([user, all]), { allowed: true });
  assert.deepEqual(hit([user, all]), { allowed: false, blocked: [0] });
  // 거절된 요청은 전체 창도 올리지 않는다.
  assert.equal(used(all.key), "2"); checks++;
  assert.deepEqual(hit([{ key: "PLACE:m:1:u:b", limit: 2 }, all]), { allowed: true });
  assert.deepEqual(hit([{ key: "PLACE:m:1:u:c", limit: 2 }, all]), { allowed: false, blocked: [1] }); checks++;
  assert.deepEqual(hit([{ key: "PLACE:closed", limit: 0 }]), { allowed: false, blocked: [0] }); checks++;
  sql("insert into public.api_usage_windows values ('PLACE:old', 99, now() - interval '1 minute')");
  assert.deepEqual(hit([{ key: "PLACE:old", limit: 1 }]), { allowed: true });
  assert.equal(used("PLACE:old"), "1"); checks++;
  assert.throws(() => sql(`set role service_role; select public.hit_api_limits(array['a']::text[], array[1,2]::integer[], array[now()]::timestamptz[])`)); checks++;

  const run = promisify(execFile);
  const shared = { key: "RECOMMEND_PLACES:d:all", limit: 5 };
  const results = await Promise.all(Array.from({ length: 20 }, async (_, i) => {
    const { stdout } = await run(join(bin, "psql"), [...args, "-c", `begin; set local role service_role; ${hitSql([{ key: `RECOMMEND_PLACES:m:${i}`, limit: 3 }, shared])}; commit;`], { encoding: "utf8" });
    return parse(stdout);
  }));
  assert.equal(results.filter(r => r.allowed).length, 5);
  assert.equal(used(shared.key), "5"); checks++;
  console.log(`PostgreSQL API usage checks passed: ${checks} (including concurrent requests and client permission denial)`);
} catch (error) {
  if (started) console.error(readFileSync(join(directory, "postgres.log"), "utf8").split("\n").slice(-8).join("\n"));
  throw error;
} finally {
  if (started) pg("pg_ctl", ["-D", data, "-m", "fast", "-w", "stop"]);
  rmSync(directory, { recursive: true, force: true });
}
