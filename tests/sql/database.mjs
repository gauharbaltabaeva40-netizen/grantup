// Дерекқор тесттері: барлық миграция + seed.sql кірістірілген Postgres-те (PGlite) іске қосылып,
// RLS, триггерлер, SQL функциялары (XP, streak, лига, лимиттер, админ статистикасы) тексеріледі.
// Іске қосу: npm run test:db   (Supabase жобасы керек емес)
import { PGlite } from "@electric-sql/pglite";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const dir = process.argv[2] ?? path.join(root, "supabase/migrations");
const seedFile = process.argv[3] ?? path.join(root, "supabase/seed.sql");
const db = new PGlite();

// --- Supabase ортасының минималды имитациясы ---
await db.exec(`
  create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
  create schema auth; create schema extensions; create schema storage;
  create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
  grant usage on schema public to anon, authenticated, service_role;
  create table auth.users (id uuid primary key default gen_random_uuid(), email text, raw_user_meta_data jsonb);
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  grant usage on schema auth to anon, authenticated, service_role;
  grant execute on function auth.uid() to anon, authenticated, service_role;
  alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
  alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
  alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
`);

for (const f of fs.readdirSync(dir).sort()) {
  await db.exec(fs.readFileSync(path.join(dir, f), "utf8"));
  console.log("applied", f);
}

let failures = 0;
async function check(name, fn) {
  try {
    await fn();
    console.log("  ✓", name);
  } catch (e) {
    failures++;
    console.log("  ✗", name, "—", e.message);
  }
}
const q = async (sql, params) => (await db.query(sql, params)).rows;
const as = async (role, uid, sql) => {
  await db.exec(`reset role; select set_config('request.jwt.claim.sub', '${uid ?? ""}', false); set role ${role};`);
  try {
    return (await db.query(sql)).rows;
  } finally {
    await db.exec("reset role;");
  }
};
const expectFail = async (p) => {
  try {
    await p;
  } catch {
    return;
  }
  throw new Error("expected failure");
};
const assert = (c, m) => {
  if (!c) throw new Error(m);
};

// Алдын ала доступ (тіркелмеген email)
await q(`insert into access_grants (email, ends_at) values ('student@test.kz', now() + interval '30 days')`);

const [admin] = await q(`insert into auth.users (email, raw_user_meta_data) values ('BekzatShemetaev24@gmail.com', '{"full_name":"Админ"}') returning id`);
const [s1] = await q(`insert into auth.users (email, raw_user_meta_data) values ('Student@Test.kz', '{"full_name":"Әлия","grade":"11","locale":"ru"}') returning id`);
const [s2] = await q(`insert into auth.users (email, raw_user_meta_data) values ('other@test.kz', '{"grade":"bad"}') returning id`);

await check("trigger: admin role from admin_emails (case-insensitive)", async () => {
  const [p] = await q(`select role, email from profiles where id = $1`, [admin.id]);
  assert(p.role === "admin" && p.email === "bekzatshemetaev24@gmail.com", JSON.stringify(p));
});
await check("trigger: student profile with metadata", async () => {
  const [p] = await q(`select role, full_name, grade, locale from profiles where id = $1`, [s1.id]);
  assert(p.role === "student" && p.full_name === "Әлия" && p.grade === "11" && p.locale === "ru", JSON.stringify(p));
});
await check("trigger: invalid grade ignored", async () => {
  const [p] = await q(`select grade from profiles where id = $1`, [s2.id]);
  assert(p.grade === null, JSON.stringify(p));
});
await check("trigger: pre-granted access linked by email", async () => {
  const [g] = await q(`select user_id from access_grants where email = 'student@test.kz'`);
  assert(g.user_id === s1.id, JSON.stringify(g));
});

await check("RLS: student sees only own profile", async () => {
  const rows = await as("authenticated", s1.id, "select id from profiles");
  assert(rows.length === 1 && rows[0].id === s1.id, JSON.stringify(rows));
});
await check("RLS: admin sees all profiles", async () => {
  const rows = await as("authenticated", admin.id, "select id from profiles");
  assert(rows.length === 3, String(rows.length));
});
await check("RLS: anon sees nothing", async () => {
  const rows = await as("anon", null, "select id from profiles");
  assert(rows.length === 0, String(rows.length));
});
await check("column grants: student can update own full_name", async () => {
  await as("authenticated", s1.id, "update profiles set full_name = 'Әлия С.' where id = auth.uid()");
  const [p] = await q(`select full_name from profiles where id = $1`, [s1.id]);
  assert(p.full_name === "Әлия С.", p.full_name);
});
await check("column grants: student cannot make self admin", () =>
  expectFail(as("authenticated", s1.id, "update profiles set role = 'admin' where id = auth.uid()")),
);
await check("column grants: student cannot change xp", () =>
  expectFail(as("authenticated", s1.id, "update profiles set xp = 99999 where id = auth.uid()")),
);
await check("RLS: student cannot update another profile", async () => {
  await as("authenticated", s1.id, `update profiles set full_name = 'hack' where id = '${s2.id}'`);
  const [p] = await q(`select full_name from profiles where id = $1`, [s2.id]);
  assert(p.full_name !== "hack", "updated!");
});

await check("access: has_full_access() true for granted student", async () => {
  const [r] = await as("authenticated", s1.id, "select has_full_access() as v");
  assert(r.v === true, JSON.stringify(r));
});
await check("access: has_full_access() false for other student", async () => {
  const [r] = await as("authenticated", s2.id, "select has_full_access() as v");
  assert(r.v === false, JSON.stringify(r));
});
await check("access: expired grant → free", async () => {
  await q(`update access_grants set starts_at = now() - interval '60 days', ends_at = now() - interval '1 day' where user_id = $1`, [s1.id]);
  const [r] = await as("authenticated", s1.id, "select has_full_access() as v");
  assert(r.v === false, JSON.stringify(r));
});
await check("access: user_has_full_access not callable by students", () =>
  expectFail(as("authenticated", s1.id, `select user_has_full_access('${s2.id}')`)),
);
await check("access: student cannot insert grants", () =>
  expectFail(as("authenticated", s1.id, `insert into access_grants (email, ends_at) values ('x@y.kz', now() + interval '1 day')`)),
);

await q(`insert into devices (user_id, device_key, fingerprint, label) values ($1, 'aaaaaaaaaaaaaaaa-1', 'fp1', 'Chrome · macOS')`, [s1.id]);
await check("devices: student reads own only", async () => {
  const own = await as("authenticated", s1.id, "select id from devices");
  const other = await as("authenticated", s2.id, "select id from devices");
  assert(own.length === 1 && other.length === 0, `${own.length}/${other.length}`);
});
await check("devices: student cannot insert device", () =>
  expectFail(as("authenticated", s1.id, `insert into devices (user_id, device_key, fingerprint, label) values (auth.uid(), 'bbbbbbbbbbbbbbbb-2', 'fp', 'x')`)),
);
await check("devices: unique active device_key per user", () =>
  expectFail(q(`insert into devices (user_id, device_key, fingerprint, label) values ($1, 'aaaaaaaaaaaaaaaa-1', 'fp1', 'dup')`, [s1.id])),
);

await q(`insert into device_requests (user_id, device_key, fingerprint, label, code_hash) values ($1, 'cccccccccccccccc-3', 'fp3', 'Safari · iPhone', 'secret-hash')`, [s1.id]);
await check("device_requests: one open request per device", () =>
  expectFail(q(`insert into device_requests (user_id, device_key, fingerprint, label) values ($1, 'cccccccccccccccc-3', 'fp3', 'dup')`, [s1.id])),
);
await check("device_requests: student cannot read", async () => {
  const rows = await as("authenticated", s1.id, "select id from device_requests");
  assert(rows.length === 0, String(rows.length));
});
await check("device_requests: admin reads but not code_hash", async () => {
  const rows = await as("authenticated", admin.id, "select id, status from device_requests");
  assert(rows.length === 1, String(rows.length));
  await expectFail(as("authenticated", admin.id, "select code_hash from device_requests"));
});

await check("security_events/audit_log: admin-only read", async () => {
  await q(`insert into security_events (user_id, type) values ($1, 'login')`, [s1.id]);
  await q(`insert into audit_log (actor_id, action) values ($1, 'test')`, [admin.id]);
  const s = await as("authenticated", s1.id, "select id from security_events");
  const a = await as("authenticated", admin.id, "select id from security_events");
  const al = await as("authenticated", s1.id, "select id from audit_log");
  assert(s.length === 0 && a.length === 1 && al.length === 0, `${s.length}/${a.length}/${al.length}`);
});

await check("rate_limit_hit: allows max then blocks", async () => {
  const results = [];
  for (let i = 0; i < 4; i++) results.push((await q(`select rate_limit_hit('k', 3, 60) as v`))[0].v);
  assert(JSON.stringify(results) === "[true,true,true,false]", JSON.stringify(results));
});
await check("rate_limit_hit: window resets", async () => {
  await q(`update rate_limits set window_start = now() - interval '2 minutes' where key = 'k'`);
  const [r] = await q(`select rate_limit_hit('k', 3, 60) as v`);
  assert(r.v === true, JSON.stringify(r));
});
await check("rate_limit_hit: not callable by students", () =>
  expectFail(as("authenticated", s1.id, `select rate_limit_hit('x', 1, 60)`)),
);


// ================= 3-кезең =================
await db.exec(fs.readFileSync(seedFile, "utf8"));
console.log("applied seed.sql");
await db.exec(fs.readFileSync(seedFile, "utf8"));
console.log("re-applied seed.sql (idempotency)");

await check("seed: 5 subjects, 12 topics", async () => {
  const [r] = await q(`select (select count(*) from subjects)::int s, (select count(*) from topics)::int t`);
  assert(r.s === 5 && r.t === 12, JSON.stringify(r));
});
await check("seed: questions once (idempotent), 5 options each, ≥1 correct", async () => {
  const [r] = await q(`select count(*)::int n from questions where source = 'seed'`);
  const bad = await q(`select q.id from questions q join question_options o on o.question_id = q.id
                       group by q.id having count(*) <> 5 or count(*) filter (where o.is_correct) < 1`);
  const singleBad = await q(`select q.id from questions q join question_options o on o.question_id = q.id
                             where q.type = 'single' group by q.id having count(*) filter (where o.is_correct) <> 1`);
  assert(r.n === 34 && bad.length === 0 && singleBad.length === 0, `${r.n}/${bad.length}/${singleBad.length}`);
});
await check("seed: mock exam has all kk questions", async () => {
  const [r] = await q(`select (select count(*) from mock_exam_questions)::int m,
                              (select count(*) from questions where locale = 'kk')::int k`);
  assert(r.m === r.k && r.m === 31, JSON.stringify(r));
});
await check("seed: one free lesson per subject", async () => {
  const rows = await q(`select t.subject_id, count(*) filter (where l.is_free)::int f
                        from lessons l join topics t on t.id = l.topic_id group by t.subject_id`);
  assert(rows.length === 5 && rows.every((r) => r.f === 1), JSON.stringify(rows));
});
await check("config: UNT structure sums to 120 questions / 140 points", async () => {
  const [{ value: v }] = await q(`select value from app_settings where key = 'unt_structure'`);
  const qs = v.sections.reduce((a, s) => a + s.questions, 0);
  const pts = v.sections.reduce((a, s) => a + s.maxPoints, 0);
  const compOk = v.sections.every((s) => Object.values(s.composition).reduce((a, b) => a + b, 0) === s.questions);
  const ptsOk = v.sections.every((s) => {
    const c = s.composition;
    return (c.single ?? 0) * v.scoring.single + (c.context ?? 0) * v.scoring.context + (c.multiple ?? 0) * v.scoring.multiple.maxPoints === s.maxPoints;
  });
  assert(qs === v.totalQuestions && qs === 120 && pts === v.maxScore && pts === 140 && compOk && ptsOk, `${qs}/${pts}/${compOk}/${ptsOk}`);
});

await check("content RLS: anon cannot read subjects", () => expectFail(as("anon", null, "select * from subjects")));
await check("content RLS: student sees subjects/topics/lessons metadata", async () => {
  const [r] = await as("authenticated", s2.id, `select (select count(*) from subjects)::int s, (select count(*) from lessons)::int l`);
  assert(r.s === 5 && r.l === 13, JSON.stringify(r));
});
for (const table of ["questions", "question_options", "question_groups", "lesson_videos", "mock_exam_questions", "ai_explanations"]) {
  await check(`content RLS: student reads 0 rows from ${table}`, async () => {
    const rows = await as("authenticated", s2.id, `select * from ${table}`);
    assert(rows.length === 0, String(rows.length));
  });
}
await check("content RLS: admin reads questions and options", async () => {
  const [r] = await as("authenticated", admin.id, `select (select count(*) from questions)::int q, (select count(*) from question_options)::int o`);
  assert(r.q === 34 && r.o === 170, JSON.stringify(r));
});
await check("lesson_contents: free student sees only 5 free summaries", async () => {
  const rows = await as("authenticated", s2.id, "select lesson_id from lesson_contents");
  assert(rows.length === 5, String(rows.length));
});
await check("lesson_contents: full-access student sees all 13", async () => {
  await q(`insert into access_grants (email, user_id, ends_at) values ('other@test.kz', $1, now() + interval '10 days')`, [s2.id]);
  const rows = await as("authenticated", s2.id, "select lesson_id from lesson_contents");
  assert(rows.length === 13, String(rows.length));
});
await check("content: student cannot write lessons", () =>
  expectFail(as("authenticated", admin.id, "update lessons set is_free = true")),
);

// Тест әрекеттері
const [mock] = await q(`select id from mock_exams limit 1`);
const [qq] = await q(`select id from questions limit 1`);
const [att] = await q(
  `insert into attempts (user_id, kind, locale, mock_exam_id) values ($1, 'mock', 'kk', $2) returning id`,
  [s1.id, mock.id],
);
await q(`insert into attempt_answers (attempt_id, question_id, user_id, selected_option_ids, is_correct, points) values ($1, $2, $3, '{}', false, 0)`, [att.id, qq.id, s1.id]);
await check("attempt_answers hidden while mock in progress", async () => {
  const rows = await as("authenticated", s1.id, "select * from attempt_answers");
  const attempts = await as("authenticated", s1.id, "select id from attempts");
  assert(rows.length === 0 && attempts.length === 1, `${rows.length}/${attempts.length}`);
});
await check("attempt_answers visible after mock finished", async () => {
  await q(`update attempts set status = 'finished', finished_at = now() where id = $1`, [att.id]);
  const rows = await as("authenticated", s1.id, "select is_correct from attempt_answers");
  assert(rows.length === 1, String(rows.length));
});
await check("attempts: other student sees nothing", async () => {
  const rows = await as("authenticated", s2.id, "select * from attempts");
  assert(rows.length === 0, String(rows.length));
});
await check("attempts: only one active mock per user", async () => {
  await q(`insert into attempts (user_id, kind, locale, mock_exam_id) values ($1, 'mock', 'kk', $2)`, [s1.id, mock.id]);
  await expectFail(q(`insert into attempts (user_id, kind, locale, mock_exam_id) values ($1, 'mock', 'kk', $2)`, [s1.id, mock.id]));
});
await check("attempts: student cannot write answers", () =>
  expectFail(as("authenticated", s1.id, `insert into attempt_answers (attempt_id, question_id, user_id) values ('${att.id}', '${qq.id}', auth.uid())`)),
);

await check("xp_events: idempotent per reason+ref", async () => {
  await q(`insert into xp_events (user_id, amount, reason, ref_id) values ($1, 20, 'lesson_complete', 'L1')`, [s1.id]);
  await expectFail(q(`insert into xp_events (user_id, amount, reason, ref_id) values ($1, 20, 'lesson_complete', 'L1')`, [s1.id]));
});

// Лигалар
const [grp] = await q(`insert into league_groups (tier, week_start) values (1, '2026-11-02') returning id`);
await q(`update profiles set nickname = 'Aliya' where id = $1`, [s1.id]);
await q(`insert into league_members (group_id, user_id, week_start, weekly_xp) values ($1, $2, '2026-11-02', 120), ($1, $3, '2026-11-02', 80)`, [grp.id, s1.id, s2.id]);
await check("league: members see their group (no RLS recursion)", async () => {
  const rows = await as("authenticated", s1.id, "select user_id from league_members");
  assert(rows.length === 2, String(rows.length));
});
await check("league_standings: names only, no email, ordered", async () => {
  const rows = await as("authenticated", s1.id, `select * from league_standings('${grp.id}')`);
  assert(rows.length === 2 && rows[0].display_name === "Aliya" && rows[0].is_me && !("email" in rows[0]), JSON.stringify(rows));
});
await check("league_standings: outsider gets nothing", async () => {
  const rows = await as("authenticated", admin.id, `select * from league_standings('${grp.id}')`);
  assert(rows.length === 0, String(rows.length));
});

// Хабарламалар
await check("notifications_settings: created automatically", async () => {
  const [r] = await q(`select count(*)::int n from notifications_settings`);
  assert(r.n === 3, String(r.n));
});
await check("notifications_settings: student toggles own", async () => {
  await as("authenticated", s1.id, "update notifications_settings set push_streak = false where user_id = auth.uid()");
  await as("authenticated", s1.id, `update notifications_settings set push_streak = false where user_id = '${s2.id}'`);
  const rows = await q(`select user_id, push_streak from notifications_settings where user_id in ($1, $2)`, [s1.id, s2.id]);
  const mine = rows.find((r) => r.user_id === s1.id);
  const other = rows.find((r) => r.user_id === s2.id);
  assert(mine.push_streak === false && other.push_streak === true, JSON.stringify(rows));
});
await check("profiles: student cannot set own xp/league via new columns", () =>
  expectFail(as("authenticated", s1.id, "update profiles set league_tier = 5 where id = auth.uid()")),
);
await check("profiles: student can set target specialty", async () => {
  const [sp] = await q(`select id from specialties limit 1`);
  await as("authenticated", s1.id, `update profiles set target_specialty_id = '${sp.id}' where id = auth.uid()`);
});
await check("app_settings: readable by students, not writable", async () => {
  const rows = await as("authenticated", s1.id, "select key from app_settings");
  assert(rows.length === 6, String(rows.length));
  await expectFail(as("authenticated", admin.id, "update app_settings set value = '{}' where key = 'xp'"));
});
await check("storage: question-images bucket private, no svg", async () => {
  const [b] = await q(`select public, allowed_mime_types from storage.buckets where id = 'question-images'`);
  assert(b.public === false && !b.allowed_mime_types.includes("image/svg+xml"), JSON.stringify(b));
});

// ================= 4-кезең: award_xp =================
await check("award_xp: awards once, updates xp and level", async () => {
  const before = (await q(`select xp, level from profiles where id = $1`, [s2.id]))[0];
  const [a] = await q(`select * from award_xp($1, 120, 'lesson_complete', 'LX')`, [s2.id]);
  const [b] = await q(`select * from award_xp($1, 120, 'lesson_complete', 'LX')`, [s2.id]);
  const after = (await q(`select xp, level from profiles where id = $1`, [s2.id]))[0];
  assert(before.xp === 0 && a.awarded && a.xp === 120 && a.level === 2 && a.level_up, JSON.stringify({ before, a }));
  assert(!b.awarded && b.xp === 120 && after.xp === 120 && after.level === 2, JSON.stringify({ b, after }));
});
await check("award_xp: level thresholds from config", async () => {
  const [r] = await q(`select level_for_xp(0) a, level_for_xp(99) b, level_for_xp(100) c, level_for_xp(99999) d`);
  assert(r.a === 1 && r.b === 1 && r.c === 2 && r.d === 10, JSON.stringify(r));
});
await check("award_xp: not callable by students", () =>
  expectFail(as("authenticated", s1.id, `select * from award_xp(auth.uid(), 1000, 'hack', 'x')`)),
);
await check("award_xp: rejects non-positive amounts", () =>
  expectFail(q(`select * from award_xp($1, 0, 'zero', 'z')`, [s2.id])),
);

// ================= 7-кезең: ai_usage_hit =================
await check("ai_usage_hit: allows up to max, then blocks", async () => {
  const r = [];
  for (let i = 0; i < 4; i++) r.push((await q(`select ai_usage_hit($1, '2026-11-01', 'explain', 3) as v`, [s1.id]))[0].v);
  const [u] = await q(`select count from ai_usage where user_id = $1 and day = '2026-11-01' and kind = 'explain'`, [s1.id]);
  assert(JSON.stringify(r) === "[true,true,true,false]" && u.count === 3, JSON.stringify({ r, u }));
});
await check("ai_usage_refund: gives one back", async () => {
  await q(`select ai_usage_refund($1, '2026-11-01', 'explain')`, [s1.id]);
  const [r] = await q(`select ai_usage_hit($1, '2026-11-01', 'explain', 3) as v`, [s1.id]);
  assert(r.v === true, JSON.stringify(r));
});
await check("ai_usage_hit: separate per day and kind", async () => {
  const [a] = await q(`select ai_usage_hit($1, '2026-11-02', 'explain', 3) as v`, [s1.id]);
  const [b] = await q(`select ai_usage_hit($1, '2026-11-01', 'plan', 3) as v`, [s1.id]);
  assert(a.v && b.v, JSON.stringify({ a, b }));
});
await check("ai_usage_hit: not callable by students", () =>
  expectFail(as("authenticated", s1.id, `select ai_usage_hit(auth.uid(), '2026-11-01', 'explain', 999)`)),
);
await check("ai_limits: default model is claude-opus-5-5", async () => {
  const [r] = await q(`select value->>'model' m from app_settings where key = 'ai_limits'`);
  assert(r.m === "claude-opus-5-5", r.m);
});

// ================= 8-кезең: геймификация =================
const [g1] = await q(`insert into auth.users (email, raw_user_meta_data) values ('gamer@test.kz', '{"full_name":"Ерлан Т"}') returning id`);
const today = (await q(`select almaty_today()::text d`))[0].d;
const prof = async () => (await q(`select xp, level, streak, longest_streak, streak_freezes, last_active_date::text d, league_tier from profiles where id = $1`, [g1.id]))[0];

await check("streak: first activity → 1, no bonus", async () => {
  await q(`select * from award_xp($1, 10, 'test', 'a1')`, [g1.id]);
  const p = await prof();
  assert(p.streak === 1 && p.d === today && p.xp === 10, JSON.stringify(p));
});
await check("streak: same day → unchanged", async () => {
  await q(`select * from award_xp($1, 10, 'test', 'a2')`, [g1.id]);
  const p = await prof();
  assert(p.streak === 1 && p.xp === 20, JSON.stringify(p));
});
await check("streak: yesterday active → +1 and +10 bonus XP", async () => {
  await q(`update profiles set last_active_date = almaty_today() - 1, streak = 4 where id = $1`, [g1.id]);
  await q(`select * from award_xp($1, 10, 'test', 'a3')`, [g1.id]);
  const p = await prof();
  assert(p.streak === 5 && p.xp === 40 && p.longest_streak === 5, JSON.stringify(p));
});
await check("streak: one missed day without freeze → reset to 1", async () => {
  await q(`update profiles set last_active_date = almaty_today() - 2, streak = 9, streak_freezes = 0 where id = $1`, [g1.id]);
  await q(`delete from xp_events where user_id = $1 and reason = 'streak_day'`, [g1.id]);
  await q(`select * from award_xp($1, 10, 'test', 'a4')`, [g1.id]);
  const p = await prof();
  assert(p.streak === 1, JSON.stringify(p));
});
await check("streak: one missed day with freeze → kept (+1), freeze used", async () => {
  await q(`update profiles set last_active_date = almaty_today() - 2, streak = 9, streak_freezes = 1 where id = $1`, [g1.id]);
  await q(`delete from xp_events where user_id = $1 and reason = 'streak_day'`, [g1.id]);
  await q(`select * from award_xp($1, 10, 'test', 'a5')`, [g1.id]);
  const p = await prof();
  assert(p.streak === 10 && p.streak_freezes === 0 && p.longest_streak === 10, JSON.stringify(p));
});
await check("achievement: streak_7 earned with XP reward", async () => {
  const rows = await q(`select achievement_code from user_achievements where user_id = $1`, [g1.id]);
  assert(rows.some((r) => r.achievement_code === "streak_7"), JSON.stringify(rows));
  const [e] = await q(`select amount from xp_events where user_id = $1 and reason = 'achievement' and ref_id = 'streak_7'`, [g1.id]);
  assert(e?.amount === 50, JSON.stringify(e));
});
await check("buy_streak_freeze: costs 200 XP, level not lowered, max 2", async () => {
  await q(`update profiles set xp = 450, level = 3 where id = $1`, [g1.id]);
  const r1 = (await q(`select buy_streak_freeze($1) r`, [g1.id]))[0].r;
  const r2 = (await q(`select buy_streak_freeze($1) r`, [g1.id]))[0].r;
  const r3 = (await q(`select buy_streak_freeze($1) r`, [g1.id]))[0].r;
  const p = await prof();
  assert(r1 === "ok" && r2 === "ok" && r3 === "max_reached" && p.xp === 50 && p.streak_freezes === 2 && p.level === 3, JSON.stringify({ r1, r2, r3, p }));
});
await check("buy_streak_freeze: not enough XP", async () => {
  await q(`update profiles set streak_freezes = 0, xp = 100 where id = $1`, [g1.id]);
  const r = (await q(`select buy_streak_freeze($1) r`, [g1.id]))[0].r;
  assert(r === "not_enough_xp", r);
});
await check("league: XP joins this week's group and adds weekly XP", async () => {
  const [m] = await q(`select weekly_xp, week_start::text w from league_members where user_id = $1`, [g1.id]);
  const [w] = await q(`select league_week_start()::text w`);
  assert(m && m.w === w.w && m.weekly_xp > 0, JSON.stringify({ m, w }));
});
await check("league_week_start: Monday", async () => {
  const [r] = await q(`select extract(isodow from league_week_start())::int d, league_week_start('2026-11-01')::text a, league_week_start('2026-11-02')::text b`);
  assert(r.d === 1 && r.a === "2026-10-26" && r.b === "2026-11-02", JSON.stringify(r));
});
await check("league: group size cap creates a new group", async () => {
  await q(`update app_settings set value = value || '{"groupSize": 3}' where key = 'league'`);
  const ids = [];
  for (let i = 0; i < 4; i++) {
    const [u] = await q(`insert into auth.users (email) values ($1) returning id`, [`lg${i}@test.kz`]);
    ids.push(u.id);
    await q(`select * from award_xp($1, ${10 + i * 10}, 'test', 'lg')`, [u.id]);
  }
  const groups = await q(`select group_id, count(*)::int n from league_members where user_id = any($1) group by group_id`, [ids]);
  assert(groups.length >= 2 && groups.every((g) => g.n <= 3), JSON.stringify(groups));
});
await check("close_league_week: promote top, demote bottom, closes groups", async () => {
  await q(`update app_settings set value = value || '{"promote": 1, "demote": 1}' where key = 'league'`);
  // 4 оқушыны бір топқа жинап, тексереміз
  const [grp] = await q(`insert into league_groups (tier, week_start) values (2, '2026-10-19') returning id`);
  const users = [];
  for (const [i, xp] of [[0, 300], [1, 200], [2, 100], [3, 50]]) {
    const [u] = await q(`insert into auth.users (email) values ($1) returning id`, [`wk${i}@test.kz`]);
    await q(`update profiles set league_tier = 2 where id = $1`, [u.id]);
    await q(`insert into league_members (group_id, user_id, week_start, weekly_xp) values ($1, $2, '2026-10-19', $3)`, [grp.id, u.id, xp]);
    users.push(u.id);
  }
  const [{ n }] = await q(`select close_league_week('2026-10-19') n`);
  const rows = await q(`select m.user_id, m.final_rank, m.outcome, p.league_tier from league_members m join profiles p on p.id = m.user_id where m.group_id = $1 order by m.final_rank`, [grp.id]);
  const [g] = await q(`select closed_at from league_groups where id = $1`, [grp.id]);
  assert(n === 1 && g.closed_at, JSON.stringify({ n, g }));
  assert(rows[0].outcome === "promoted" && rows[0].league_tier === 3, JSON.stringify(rows[0]));
  assert(rows[1].outcome === "stayed" && rows[2].outcome === "stayed", JSON.stringify(rows));
  assert(rows[3].outcome === "demoted" && rows[3].league_tier === 1, JSON.stringify(rows[3]));
  const [a] = await q(`select count(*)::int c from user_achievements where user_id = $1 and achievement_code = 'league_promoted'`, [users[0]]);
  assert(a.c === 1, "league_promoted not given");
  const [{ again }] = await q(`select close_league_week('2026-10-19') again`);
  assert(again === 0, "closed twice");
});
await check("gamification functions not callable by students", async () => {
  await expectFail(as("authenticated", g1.id, `select buy_streak_freeze(auth.uid())`));
  await expectFail(as("authenticated", g1.id, `select close_league_week('2026-10-19')`));
  await expectFail(as("authenticated", g1.id, `select * from check_achievements(auth.uid())`));
});
await check("user_achievements: student can mark own as seen, nothing else", async () => {
  await as("authenticated", g1.id, `update user_achievements set seen_at = now() where user_id = auth.uid()`);
  const [r] = await q(`select count(*) filter (where seen_at is null)::int unseen from user_achievements where user_id = $1`, [g1.id]);
  assert(r.unseen === 0, JSON.stringify(r));
  await expectFail(as("authenticated", g1.id, `update user_achievements set achievement_code = 'mock_100' where user_id = auth.uid()`));
});

// ================= 10-кезең: хабарламалар журналы =================
await check("notification_log: one row per user+kind+ref (dedupe)", async () => {
  await q(`insert into notification_log (user_id, kind, ref, channel) values ($1, 'push_streak', '2026-11-01', 'push')`, [s1.id]);
  await expectFail(q(`insert into notification_log (user_id, kind, ref, channel) values ($1, 'push_streak', '2026-11-01', 'push')`, [s1.id]));
  await q(`insert into notification_log (user_id, kind, ref, channel) values ($1, 'push_streak', '2026-11-02', 'push')`, [s1.id]);
});
await check("notification_log: admin-only read, students cannot write", async () => {
  const own = await as("authenticated", s1.id, "select id from notification_log");
  const adm = await as("authenticated", admin.id, "select id from notification_log");
  assert(own.length === 0 && adm.length >= 2, `${own.length}/${adm.length}`);
  await expectFail(as("authenticated", s1.id, `insert into notification_log (user_id, kind, ref, channel) values (auth.uid(), 'push_week', 'x', 'push')`));
});
await check("notification_log: unknown kind rejected", () =>
  expectFail(q(`insert into notification_log (user_id, kind, ref, channel) values ($1, 'spam', 'x', 'push')`, [s1.id])),
);
await check("league_members.notified_zone accepts only up/down/mid", async () => {
  const [m] = await q(`select group_id, user_id from league_members limit 1`);
  await q(`update league_members set notified_zone = 'up' where group_id = $1 and user_id = $2`, [m.group_id, m.user_id]);
  await expectFail(q(`update league_members set notified_zone = 'top' where group_id = $1 and user_id = $2`, [m.group_id, m.user_id]));
});
await check("push_subscriptions: student can delete own only", async () => {
  await q(`insert into push_subscriptions (user_id, endpoint, p256dh, auth) values ($1, 'https://push.example/a', 'p256dh-key-123', 'auth-key-123'), ($2, 'https://push.example/b', 'p256dh-key-123', 'auth-key-123')`, [s1.id, s2.id]);
  await as("authenticated", s1.id, `delete from push_subscriptions`);
  const rows = await q(`select user_id from push_subscriptions`);
  assert(rows.length === 1 && rows[0].user_id === s2.id, JSON.stringify(rows));
  await expectFail(q(`insert into push_subscriptions (user_id, endpoint, p256dh, auth) values ($1, 'http://insecure', 'x', 'y')`, [s1.id]));
});

// ================= 12-кезең: админ статистикасы =================
await check("admin_overview: returns counts", async () => {
  const [{ o }] = await q(`select admin_overview() o`);
  assert(o.students >= 3 && o.questions === 34 && o.lessons === 13 && "avgMock30" in o, JSON.stringify(o));
});
await check("admin_hardest_questions: orders by accuracy", async () => {
  await q(`insert into attempts (user_id, kind, locale) values ($1, 'practice', 'kk') returning id`, [s2.id]);
  const qs = await q(`select id from questions order by id limit 2`);
  for (const [i, qq] of qs.entries()) {
    for (let k = 0; k < 5; k++) {
      const [u] = await q(`insert into auth.users (email) values ($1) returning id`, [`hq${i}${k}@test.kz`]);
      const [a] = await q(`insert into attempts (user_id, kind, locale) values ($1, 'practice', 'kk') returning id`, [u.id]);
      await q(`insert into attempt_answers (attempt_id, question_id, user_id, is_correct, points, answered_at) values ($1, $2, $3, $4, 0, now())`, [a.id, qq.id, u.id, i === 0 ? false : k < 4]);
    }
  }
  const rows = await q(`select question_id, total::int, correct::int from admin_hardest_questions(5, 10)`);
  assert(rows[0].question_id === qs[0].id && rows[0].correct === 0, JSON.stringify(rows.slice(0, 2)));
  const acc = await q(`select * from admin_question_accuracy($1)`, [qs.map((x) => x.id)]);
  assert(acc.length === 2, JSON.stringify(acc));
});
await check("admin functions not callable by students or admins via API", async () => {
  await expectFail(as("authenticated", s1.id, `select admin_overview()`));
  await expectFail(as("authenticated", admin.id, `select * from admin_hardest_questions(1, 5)`));
});

await check("fair rewards: empty mock gives no first_mock, half-answered mock does", async () => {
  const [u] = await q(`insert into auth.users (email) values ('fair@test.kz') returning id`);
  const [m] = await q(`select id from mock_exams limit 1`);
  const qs = (await q(`select id from questions order by id limit 4`)).map((r) => r.id);
  const [empty] = await q(
    `insert into attempts (user_id, kind, locale, mock_exam_id, question_ids, status, finished_at, score, max_score)
     values ($1, 'mock', 'kk', $2, $3, 'finished', now(), 0, 4) returning id`,
    [u.id, m.id, qs],
  );
  const [{ e1 }] = await q(`select attempt_is_engaged($1) e1`, [empty.id]);
  assert(e1 === false, "empty attempt must not be engaged");
  let codes = (await q(`select * from check_achievements($1) c`, [u.id])).map((r) => r.c);
  assert(!codes.includes("first_mock"), JSON.stringify(codes));

  for (const qid of qs.slice(0, 2)) {
    await q(`insert into attempt_answers (attempt_id, question_id, user_id, is_correct, points, answered_at) values ($1, $2, $3, true, 1, now())`, [empty.id, qid, u.id]);
  }
  codes = (await q(`select * from check_achievements($1) c`, [u.id])).map((r) => r.c);
  assert(codes.includes("first_mock"), JSON.stringify(codes));
  await expectFail(as("authenticated", u.id, `select attempt_is_engaged('${empty.id}')`));
});
await check("mock_100 uses the 140-point scale", async () => {
  const [u] = await q(`insert into auth.users (email) values ('scale@test.kz') returning id`);
  const [m] = await q(`select id from mock_exams limit 1`);
  const [qid] = (await q(`select id from questions order by id limit 1`)).map((r) => r.id);
  const [a] = await q(
    `insert into attempts (user_id, kind, locale, mock_exam_id, question_ids, status, finished_at, score, max_score)
     values ($1, 'mock', 'kk', $2, $3, 'finished', now(), 30, 34) returning id`,
    [u.id, m.id, [qid]],
  );
  await q(`insert into attempt_answers (attempt_id, question_id, user_id, is_correct, points, answered_at) values ($1, $2, $3, true, 1, now())`, [a.id, qid, u.id]);
  const codes = (await q(`select * from check_achievements($1) c`, [u.id])).map((r) => r.c);
  assert(codes.includes("mock_100"), JSON.stringify(codes)); // 30/34 → 123.5 / 140
});
await check("admin_students: search + access filter + paging", async () => {
  const all = await q(`select id, has_access from admin_students('TEST.kz', null, 50, 0)`);
  const ids = all.map((r) => r.id);
  assert(ids.includes(s1.id) && ids.includes(s2.id) && !ids.includes(admin.id), JSON.stringify(all));
  const full = (await q(`select id from admin_students(null, 'full', 200, 0)`)).map((r) => r.id);
  const free = (await q(`select id from admin_students(null, 'free', 200, 0)`)).map((r) => r.id);
  assert(full.includes(s2.id) && !full.includes(s1.id) && free.includes(s1.id) && !free.includes(s2.id), "access filter");
  const byName = await q(`select id from admin_students('Әлия', null, 10, 0)`);
  assert(byName.length === 1 && byName[0].id === s1.id, JSON.stringify(byName));
  const page2 = await q(`select id from admin_students(null, null, 1, 1)`);
  assert(page2.length === 1, "paging");
  await expectFail(as("authenticated", admin.id, `select * from admin_students()`));
});

console.log(failures ? `\n${failures} FAILED` : "\nall passed");
process.exit(failures ? 1 : 0);
