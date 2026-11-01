-- =====================================================================
-- 12-кезең: админ-панель статистикасы (тек service_role шақырады).
-- =====================================================================

-- Жалпы көрсеткіштер
create or replace function public.admin_overview()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'students', (select count(*) from public.profiles where role = 'student'),
    'active7', (select count(*) from public.profiles where role = 'student' and last_active_date >= public.almaty_today() - 6),
    'activeToday', (select count(*) from public.profiles where role = 'student' and last_active_date = public.almaty_today()),
    'fullAccess', (
      select count(distinct coalesce(g.user_id::text, g.email)) from public.access_grants g
      where g.revoked_at is null and now() >= g.starts_at and now() < g.ends_at
    ),
    'mocks30', (select count(*) from public.attempts where kind = 'mock' and status in ('finished', 'expired') and finished_at >= now() - interval '30 days'),
    'avgMock30', (
      select round(avg(score / nullif(max_score, 0) * 140)::numeric, 1) from public.attempts
      where kind = 'mock' and status in ('finished', 'expired') and finished_at >= now() - interval '30 days'
    ),
    'answers7', (select count(*) from public.attempt_answers where answered_at >= now() - interval '7 days'),
    'pendingDevices', (select count(*) from public.device_requests where status = 'pending'),
    'warnings7', (select count(*) from public.security_events where severity <> 'info' and created_at >= now() - interval '7 days'),
    'questions', (select count(*) from public.questions where is_active),
    'lessons', (select count(*) from public.lessons where is_published)
  );
$$;

-- Ең қиын сұрақтар: кемінде p_min жауабы бар, дұрыс жауап үлесі ең аз
create or replace function public.admin_hardest_questions(p_min integer default 5, p_limit integer default 10)
returns table (question_id uuid, total bigint, correct bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select a.question_id, count(*) as total, count(*) filter (where a.is_correct) as correct
  from public.attempt_answers a
  where a.is_correct is not null and a.answered_at is not null
  group by a.question_id
  having count(*) >= p_min
  order by count(*) filter (where a.is_correct)::numeric / count(*) asc, count(*) desc
  limit p_limit;
$$;

-- Әр сұрақтың статистикасы (сұрақтар тізімі үшін)
create or replace function public.admin_question_accuracy(p_ids uuid[])
returns table (question_id uuid, total bigint, correct bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select a.question_id, count(*), count(*) filter (where a.is_correct)
  from public.attempt_answers a
  where a.question_id = any (p_ids) and a.is_correct is not null and a.answered_at is not null
  group by a.question_id;
$$;

-- Оқушылар тізімі: іздеу (аты/email/лақап ат) + доступ сүзгісі ('full' | 'free') + беттеу
create or replace function public.admin_students(
  p_q text default null,
  p_access text default null,
  p_limit integer default 30,
  p_offset integer default 0
)
returns table (
  id uuid,
  email text,
  full_name text,
  grade public.grade_level,
  level integer,
  xp integer,
  streak integer,
  last_active_date date,
  created_at timestamptz,
  has_access boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  with filtered as (
    select p.*, public.user_has_full_access(p.id) as has_access
    from public.profiles p
    where p.role = 'student'
      and (
        coalesce(p_q, '') = ''
        or strpos(lower(p.email), lower(p_q)) > 0
        or strpos(lower(p.full_name), lower(p_q)) > 0
        or strpos(lower(coalesce(p.nickname, '')), lower(p_q)) > 0
      )
  )
  select f.id, f.email, f.full_name, f.grade, f.level, f.xp, f.streak, f.last_active_date, f.created_at, f.has_access
  from filtered f
  where p_access is null or (p_access = 'full' and f.has_access) or (p_access = 'free' and not f.has_access)
  order by f.created_at desc, f.id
  limit least(greatest(p_limit, 1), 200) offset greatest(p_offset, 0);
$$;

revoke execute on function public.admin_overview() from public, anon, authenticated;
revoke execute on function public.admin_hardest_questions(integer, integer) from public, anon, authenticated;
revoke execute on function public.admin_question_accuracy(uuid[]) from public, anon, authenticated;
revoke execute on function public.admin_students(text, text, integer, integer) from public, anon, authenticated;
grant execute on function public.admin_overview() to service_role;
grant execute on function public.admin_students(text, text, integer, integer) to service_role;
grant execute on function public.admin_hardest_questions(integer, integer) to service_role;
grant execute on function public.admin_question_accuracy(uuid[]) to service_role;
