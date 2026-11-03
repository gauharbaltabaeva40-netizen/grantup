-- =====================================================================
-- Сынақ ҰБТ прокторингі (камера). Бұзушылықтар тек тіркеледі — сынақ тоқтатылмайды.
-- Оқушы фотолары жабық бакетте, тек админ қысқа мерзімді сілтемемен көреді; 30 күннен кейін өшіріледі (cron).
-- Барлық жазу — сервер арқылы (service_role), оқушыларға API арқылы рұқсат жоқ.
-- =====================================================================

create table public.proctoring_events (
  id bigint generated always as identity primary key,
  attempt_id uuid not null references public.attempts (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  type text not null check (type in (
    'consent',          -- келісім берілді, камера қосылды
    'snapshot',         -- кезекті фото
    'no_face',          -- камерада бет жоқ
    'multiple_faces',   -- камерада бірнеше адам
    'camera_off',       -- камера өшірілді / рұқсат алынды
    'tab_hidden',       -- басқа бетке/қолданбаға ауысты
    'detector_unavailable' -- құрылғыда бет анықтау жұмыс істемейді (тек фото)
  )),
  detail jsonb not null default '{}'::jsonb,
  image_path text,
  created_at timestamptz not null default now()
);
create index proctoring_events_attempt_idx on public.proctoring_events (attempt_id, created_at);
create index proctoring_events_created_idx on public.proctoring_events (created_at);

alter table public.proctoring_events enable row level security;
-- Саясат жоқ: authenticated/anon оқи да, жаза да алмайды.
revoke all on public.proctoring_events from anon, authenticated;

-- Фотолар: жабық бакет, тек JPEG, ≤ 300 КБ
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('proctoring', 'proctoring', false, 307200, array['image/jpeg'])
on conflict (id) do nothing;

-- Админ үшін: сынақтар бойынша бұзушылықтар саны (жаңалары бірінші)
create or replace function public.admin_proctoring_attempts(p_limit integer default 50, p_offset integer default 0, p_user uuid default null)
returns table (
  attempt_id uuid,
  user_id uuid,
  started_at timestamptz,
  finished_at timestamptz,
  status public.attempt_status,
  no_face bigint,
  multiple_faces bigint,
  camera_off bigint,
  tab_hidden bigint,
  snapshots bigint
)
language sql
stable
security definer
set search_path = ''
as $$
  select t.id, t.user_id, t.started_at, t.finished_at, t.status,
    count(*) filter (where e.type = 'no_face'),
    count(*) filter (where e.type = 'multiple_faces'),
    count(*) filter (where e.type = 'camera_off'),
    count(*) filter (where e.type = 'tab_hidden'),
    count(*) filter (where e.image_path is not null)
  from public.attempts t
  join public.proctoring_events e on e.attempt_id = t.id
  where t.kind = 'mock' and (p_user is null or t.user_id = p_user)
  group by t.id
  order by t.started_at desc
  limit least(greatest(p_limit, 1), 200) offset greatest(p_offset, 0);
$$;

revoke execute on function public.admin_proctoring_attempts(integer, integer, uuid) from public, anon, authenticated;
grant execute on function public.admin_proctoring_attempts(integer, integer, uuid) to service_role;
