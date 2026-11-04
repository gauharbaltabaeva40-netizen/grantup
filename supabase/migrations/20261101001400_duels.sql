-- =====================================================================
-- Дуэль: екі оқушы бірдей 5 сұраққа жауап береді (кезекпен — бір уақытта онлайн болу міндетті емес).
-- Әр ойыншыға attempts-те бөлек әрекет (kind = 'duel') ашылады: тексеру, «Қателерім», XP — ортақ механизм.
-- Жеңімпаз: көп дұрыс жауап; тең болса — аз уақыт.
-- Барлық жазу сервер арқылы (service_role); оқушы API арқылы тек өз дуэлін оқи алады.
-- =====================================================================

alter type public.attempt_kind add value if not exists 'duel';

create table public.duels (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[A-Z2-9]{6}$'),   -- шақыру коды (сілтемеде)
  subject_id smallint references public.subjects (id) on delete set null,  -- null — аралас пәндер
  locale public.content_locale not null,
  question_ids uuid[] not null check (cardinality(question_ids) between 1 and 20),
  option_order jsonb not null default '{}'::jsonb,
  creator_id uuid not null references auth.users (id) on delete cascade,
  opponent_id uuid references auth.users (id) on delete cascade,
  creator_attempt_id uuid references public.attempts (id) on delete set null,
  opponent_attempt_id uuid references public.attempts (id) on delete set null,
  is_open boolean not null default false,                     -- кездейсоқ қарсыласқа ашық
  winner_id uuid references auth.users (id) on delete set null,
  is_draw boolean not null default false,
  expires_at timestamptz not null default now() + interval '48 hours',
  finished_at timestamptz,
  created_at timestamptz not null default now(),
  check (opponent_id is null or opponent_id <> creator_id)
);
create index duels_creator_idx on public.duels (creator_id, created_at desc);
create index duels_opponent_idx on public.duels (opponent_id, created_at desc) where opponent_id is not null;
-- Кездейсоқ қарсылас іздеу: ашық, қарсыласы жоқ дуэльдер
create index duels_open_idx on public.duels (locale, created_at) where is_open and opponent_id is null and finished_at is null;

alter table public.duels enable row level security;
revoke all on public.duels from anon, authenticated;
grant select on public.duels to authenticated;
create policy duels_select_own on public.duels for select to authenticated
  using ((select auth.uid()) in (creator_id, opponent_id));
