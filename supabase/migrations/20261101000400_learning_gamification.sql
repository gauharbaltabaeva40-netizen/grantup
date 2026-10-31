-- =====================================================================
-- 3-кезең (2/3): оқу прогресі, тест әрекеттері, «Қателерім», жоспар,
-- геймификация (XP, жетістіктер, лигалар), AI кэші мен лимиттері, хабарламалар.
-- Барлық жазу — сервер (service_role) арқылы; оқушы тек өз деректерін оқиды.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Профильге қосымша өрістер
-- ---------------------------------------------------------------------
alter table public.profiles
  add column longest_streak integer not null default 0 check (longest_streak >= 0),
  add column last_active_date date,                         -- Asia/Almaty күні
  add column streak_freezes smallint not null default 0 check (streak_freezes between 0 and 5),
  add column league_tier smallint not null default 1,
  add column onboarding_completed_at timestamptz;

-- ---------------------------------------------------------------------
-- Сабақ прогресі (видеоның қай жеріне дейін көрілгені т.б.)
-- ---------------------------------------------------------------------
create table public.lesson_progress (
  user_id uuid not null references auth.users (id) on delete cascade,
  lesson_id uuid not null references public.lessons (id) on delete cascade,
  video_position_seconds integer not null default 0 check (video_position_seconds >= 0),
  video_completed boolean not null default false,
  quiz_best_percent smallint check (quiz_best_percent between 0 and 100),
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (user_id, lesson_id)
);
create trigger lesson_progress_updated_at before update on public.lesson_progress
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- Тест әрекеттері: диагностика, сабақ тесті, жаттығу, «Қателерім», сынақ ҰБТ
-- ---------------------------------------------------------------------
create type public.attempt_kind as enum ('diagnostic', 'lesson_quiz', 'practice', 'mistakes', 'mock');
create type public.attempt_status as enum ('in_progress', 'finished', 'expired', 'abandoned');

create table public.attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  kind public.attempt_kind not null,
  status public.attempt_status not null default 'in_progress',
  locale public.content_locale not null,
  lesson_id uuid references public.lessons (id) on delete set null,
  topic_id uuid references public.topics (id) on delete set null,
  subject_id smallint references public.subjects (id) on delete set null,
  mock_exam_id uuid references public.mock_exams (id) on delete set null,
  -- Сервер жасаған рет (сынақ ҰБТ-да араластырылған): сұрақтар және әр сұрақтың нұсқалар реті
  question_ids uuid[] not null default '{}',
  option_order jsonb not null default '{}'::jsonb,
  structure jsonb,                                           -- сынақ ҰБТ құрылымының көшірмесі
  started_at timestamptz not null default now(),
  deadline_at timestamptz,
  finished_at timestamptz,
  score numeric(6, 2),
  max_score numeric(6, 2),
  section_scores jsonb,                                      -- {subject_code: {score, max, correct, total}}
  time_by_subject jsonb,                                     -- {subject_code: секунд}
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (kind <> 'mock' or mock_exam_id is not null),
  check (kind <> 'lesson_quiz' or lesson_id is not null)
);
create index attempts_user_idx on public.attempts (user_id, kind, created_at desc);
-- Бір мезгілде бір ғана аяқталмаған сынақ ҰБТ
create unique index attempts_one_active_mock_idx on public.attempts (user_id) where kind = 'mock' and status = 'in_progress';
create trigger attempts_updated_at before update on public.attempts
  for each row execute function public.set_updated_at();

create table public.attempt_answers (
  attempt_id uuid not null references public.attempts (id) on delete cascade,
  question_id uuid not null references public.questions (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  selected_option_ids uuid[] not null default '{}',
  is_correct boolean,
  points numeric(4, 2),
  flagged boolean not null default false,                    -- «белгіленген» (кейін қарау)
  time_spent_ms integer not null default 0 check (time_spent_ms >= 0),
  answered_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (attempt_id, question_id)
);
create index attempt_answers_user_idx on public.attempt_answers (user_id, question_id);
create trigger attempt_answers_updated_at before update on public.attempt_answers
  for each row execute function public.set_updated_at();

-- «Қателерім»: қате жауап берілген сұрақтар (түзелгенде resolved_at қойылады)
create table public.user_mistakes (
  user_id uuid not null references auth.users (id) on delete cascade,
  question_id uuid not null references public.questions (id) on delete cascade,
  wrong_count integer not null default 1 check (wrong_count >= 1),
  last_wrong_at timestamptz not null default now(),
  resolved_at timestamptz,
  primary key (user_id, question_id)
);
create index user_mistakes_open_idx on public.user_mistakes (user_id, last_wrong_at desc) where resolved_at is null;

-- ---------------------------------------------------------------------
-- Жеке оқу жоспары (AI құрады)
-- ---------------------------------------------------------------------
create table public.study_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  source text not null check (source in ('diagnostic', 'mock', 'manual', 'weekly')),
  source_attempt_id uuid references public.attempts (id) on delete set null,
  week_start date not null,
  plan jsonb not null,                                       -- {days: [{date, items: [{type, topicId, lessonId, questions}]}]}
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
create unique index study_plans_active_idx on public.study_plans (user_id) where is_active;

-- ---------------------------------------------------------------------
-- XP оқиғалары (идемпотентті: бір себеп + бір объект үшін бір рет)
-- ---------------------------------------------------------------------
create table public.xp_events (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  amount integer not null,
  reason text not null check (char_length(reason) <= 50),
  ref_id text,
  created_at timestamptz not null default now(),
  unique nulls not distinct (user_id, reason, ref_id)
);
create index xp_events_user_idx on public.xp_events (user_id, created_at desc);

-- ---------------------------------------------------------------------
-- Жетістіктер
-- ---------------------------------------------------------------------
create table public.achievements (
  code text primary key check (code ~ '^[a-z0-9_]+$'),
  title_kk text not null,
  title_ru text not null,
  description_kk text not null,
  description_ru text not null,
  icon text not null,
  xp_reward integer not null default 0,
  position smallint not null default 0
);

create table public.user_achievements (
  user_id uuid not null references auth.users (id) on delete cascade,
  achievement_code text not null references public.achievements (code) on delete cascade,
  earned_at timestamptz not null default now(),
  primary key (user_id, achievement_code)
);

-- ---------------------------------------------------------------------
-- Апталық лигалар
-- ---------------------------------------------------------------------
create table public.leagues (
  tier smallint primary key check (tier between 1 and 20),
  code text not null unique,
  name_kk text not null,
  name_ru text not null,
  color text not null check (color ~ '^#[0-9a-fA-F]{6}$')
);

-- Лига деңгейлері (атауларын админ кейін өзгерте алады)
insert into public.leagues (tier, code, name_kk, name_ru, color) values
  (1, 'bronze',   'Қола',   'Бронза',  '#B87333'),
  (2, 'silver',   'Күміс',  'Серебро', '#9CA3AF'),
  (3, 'gold',     'Алтын',  'Золото',  '#F59E0B'),
  (4, 'sapphire', 'Сапфир', 'Сапфир',  '#0047FF'),
  (5, 'diamond',  'Алмаз',  'Алмаз',   '#7B3FF2');

create table public.league_groups (
  id uuid primary key default gen_random_uuid(),
  tier smallint not null references public.leagues (tier),
  week_start date not null,                                   -- дүйсенбі (Asia/Almaty)
  closed_at timestamptz,
  created_at timestamptz not null default now()
);
create index league_groups_week_idx on public.league_groups (week_start, tier);

create table public.league_members (
  group_id uuid not null references public.league_groups (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  week_start date not null,
  weekly_xp integer not null default 0 check (weekly_xp >= 0),
  final_rank smallint,
  outcome text check (outcome in ('promoted', 'demoted', 'stayed')),
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id),
  unique (user_id, week_start)
);
create index league_members_rank_idx on public.league_members (group_id, weekly_xp desc);

alter table public.profiles
  add constraint profiles_league_tier_fkey foreign key (league_tier) references public.leagues (tier);

-- Ағымдағы пайдаланушы мүше болған топтар (RLS рекурсиясыз)
create or replace function public.my_league_group_ids()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select group_id from public.league_members where user_id = (select auth.uid());
$$;
revoke execute on function public.my_league_group_ids() from public, anon;
grant execute on function public.my_league_group_ids() to authenticated;

-- Лига кестесі: тек лақап ат/аты және аватар (email емес). Тек өз тобыңызды көресіз.
create or replace function public.league_standings(p_group uuid)
returns table (user_id uuid, display_name text, avatar text, weekly_xp integer, is_me boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select
    m.user_id,
    coalesce(nullif(p.nickname, ''), nullif(split_part(p.full_name, ' ', 1), ''), 'GrantUp'),
    p.avatar,
    m.weekly_xp,
    m.user_id = (select auth.uid())
  from public.league_members m
  join public.profiles p on p.id = m.user_id
  where m.group_id = p_group
    and exists (select 1 from public.league_members me where me.group_id = p_group and me.user_id = (select auth.uid()))
  order by m.weekly_xp desc, m.joined_at asc;
$$;
revoke execute on function public.league_standings(uuid) from public, anon;
grant execute on function public.league_standings(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- AI-тьютор: түсіндірмелер кэші және күндік лимит есебі
-- ---------------------------------------------------------------------
create table public.ai_explanations (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.questions (id) on delete cascade,
  answer_key text not null,                                   -- таңдалған нұсқа ID-лерінің сұрыпталған тізбесі
  locale public.content_locale not null,
  content text not null,
  model text not null,
  created_at timestamptz not null default now(),
  unique (question_id, answer_key, locale)
);

create table public.ai_usage (
  user_id uuid not null references auth.users (id) on delete cascade,
  day date not null,                                          -- Asia/Almaty күні
  kind text not null check (kind in ('explain', 'plan')),
  count integer not null default 0 check (count >= 0),
  primary key (user_id, day, kind)
);

-- ---------------------------------------------------------------------
-- Хабарламалар
-- ---------------------------------------------------------------------
create table public.notifications_settings (
  user_id uuid primary key references auth.users (id) on delete cascade,
  push_streak boolean not null default true,
  push_league boolean not null default true,
  push_weekly boolean not null default true,
  email_weekly boolean not null default true,
  email_access_expiry boolean not null default true,
  updated_at timestamptz not null default now()
);
create trigger notifications_settings_updated_at before update on public.notifications_settings
  for each row execute function public.set_updated_at();

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  endpoint text not null unique check (endpoint ~ '^https://'),
  p256dh text not null,
  auth text not null,
  user_agent text check (char_length(user_agent) <= 500),
  created_at timestamptz not null default now(),
  last_used_at timestamptz
);
create index push_subscriptions_user_idx on public.push_subscriptions (user_id);

-- Жаңа профильге әдепкі хабарлама баптаулары
create or replace function public.handle_new_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.notifications_settings (user_id) values (new.id) on conflict do nothing;
  return new;
end;
$$;
create trigger on_profile_created after insert on public.profiles
  for each row execute function public.handle_new_profile();

-- ---------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------
alter table public.lesson_progress enable row level security;
alter table public.attempts enable row level security;
alter table public.attempt_answers enable row level security;
alter table public.user_mistakes enable row level security;
alter table public.study_plans enable row level security;
alter table public.xp_events enable row level security;
alter table public.achievements enable row level security;
alter table public.user_achievements enable row level security;
alter table public.leagues enable row level security;
alter table public.league_groups enable row level security;
alter table public.league_members enable row level security;
alter table public.ai_explanations enable row level security;
alter table public.ai_usage enable row level security;
alter table public.notifications_settings enable row level security;
alter table public.push_subscriptions enable row level security;

-- Өз деректері (+ админ оқиды)
create policy "lesson_progress: өзінікі" on public.lesson_progress for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));
create policy "attempts: өзінікі" on public.attempts for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));
-- Сынақ ҰБТ жүріп жатқанда жауаптардың дұрыс/бұрысы көрінбейді — тек аяқталғаннан кейін
create policy "attempt_answers: өзінікі, сынақ аяқталғаннан кейін" on public.attempt_answers for select to authenticated
  using (
    (select public.is_admin())
    or (
      user_id = (select auth.uid())
      and not exists (
        select 1 from public.attempts a
        where a.id = attempt_id and a.kind = 'mock' and a.status = 'in_progress'
      )
    )
  );
create policy "user_mistakes: өзінікі" on public.user_mistakes for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));
create policy "study_plans: өзінікі" on public.study_plans for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));
create policy "xp_events: өзінікі" on public.xp_events for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));
create policy "user_achievements: өзінікі" on public.user_achievements for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));
create policy "ai_usage: өзінікі" on public.ai_usage for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));
create policy "push_subscriptions: өзінікі" on public.push_subscriptions for select to authenticated
  using (user_id = (select auth.uid()));
create policy "push_subscriptions: өзінікін өшіру" on public.push_subscriptions for delete to authenticated
  using (user_id = (select auth.uid()));

-- Хабарлама баптаулары: оқушы өзі өзгертеді
create policy "notifications_settings: өзінікі" on public.notifications_settings for select to authenticated
  using (user_id = (select auth.uid()));
create policy "notifications_settings: өзі жаңартады" on public.notifications_settings for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- Анықтамалықтар
create policy "achievements: кірген әр адам" on public.achievements for select to authenticated using (true);
create policy "leagues: кірген әр адам" on public.leagues for select to authenticated using (true);
create policy "league_groups: өз тобы" on public.league_groups for select to authenticated
  using (id in (select public.my_league_group_ids()) or (select public.is_admin()));
-- Басқа мүшелердің аты мен аватары тек league_standings() арқылы
create policy "league_members: өз тобы" on public.league_members for select to authenticated
  using (group_id in (select public.my_league_group_ids()) or (select public.is_admin()));

-- ai_explanations: саясат жоқ — тек сервер

revoke insert, update, delete on
  public.lesson_progress, public.attempts, public.attempt_answers, public.user_mistakes, public.study_plans,
  public.xp_events, public.achievements, public.user_achievements, public.leagues, public.league_groups,
  public.league_members, public.ai_explanations, public.ai_usage, public.notifications_settings,
  public.push_subscriptions
from anon, authenticated;
revoke select on
  public.lesson_progress, public.attempts, public.attempt_answers, public.user_mistakes, public.study_plans,
  public.xp_events, public.achievements, public.user_achievements, public.leagues, public.league_groups,
  public.league_members, public.ai_explanations, public.ai_usage, public.notifications_settings,
  public.push_subscriptions
from anon;

grant update (push_streak, push_league, push_weekly, email_weekly, email_access_expiry)
  on public.notifications_settings to authenticated;
grant delete on public.push_subscriptions to authenticated;
