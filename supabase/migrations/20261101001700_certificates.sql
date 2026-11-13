-- =====================================================================
-- 1) Дуэль алынып тасталды (attempt_kind-тағы 'duel' мәні ескі жазбалар үшін қалады).
-- 2) Әкімші бұзушылықты «қате дабыл» деп белгілей алады — адалдық индексіне есептелмейді.
-- 3) «Прокторингпен расталған нәтиже» сертификаттары: QR-код арқылы ашық тексеріледі.
--    Сертификат берілген сәттегі нәтиже көшірмесін сақтайды (прокторинг фотолары 30 күннен кейін өшеді).
-- =====================================================================

drop table if exists public.duels;

alter table public.proctoring_events
  add column dismissed_at timestamptz,
  add column dismissed_by uuid references auth.users (id) on delete set null;

create table public.certificates (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[A-Z2-9]{10}$'),   -- тексеру сілтемесіндегі код
  attempt_id uuid not null unique references public.attempts (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  student_name text not null,
  score numeric(6, 2) not null,
  max_score numeric(6, 2) not null,
  sections jsonb not null default '[]'::jsonb,                -- [{ "title": "...", "score": 18, "max": 20 }]
  exam_date timestamptz not null,
  issued_by uuid references auth.users (id) on delete set null,  -- null — автоматты (индекс жеткілікті)
  status text not null default 'valid' check (status in ('valid', 'revoked')),
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);
create index certificates_user_idx on public.certificates (user_id, created_at desc);

-- Оқушы тек өз сертификатын оқиды; жазу мен ашық тексеру — тек сервер арқылы
alter table public.certificates enable row level security;
revoke all on public.certificates from anon, authenticated;
grant select on public.certificates to authenticated;
create policy certificates_select_own on public.certificates for select to authenticated
  using (user_id = (select auth.uid()));
