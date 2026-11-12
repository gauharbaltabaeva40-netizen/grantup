-- =====================================================================
-- Прокторинг: телефон анықтау және басты жанына бұру (көзқарас).
-- Анықтау оқушының браузерінде жүреді; серверге тек оқиға мен сол сәттегі фото келеді.
-- =====================================================================

alter table public.proctoring_events drop constraint proctoring_events_type_check;
alter table public.proctoring_events add constraint proctoring_events_type_check check (type in (
  'consent',          -- келісім берілді, камера қосылды
  'snapshot',         -- кезекті фото
  'no_face',          -- камерада бет жоқ
  'multiple_faces',   -- камерада бірнеше адам
  'phone_detected',   -- камерада телефон
  'looking_away',     -- басын жанына ұзақ бұрды
  'camera_off',       -- камера өшірілді / рұқсат алынды
  'camera_on',        -- өшкен камера қайта қосылды
  'tab_hidden',       -- басқа бетке/қолданбаға ауысты
  'detector_unavailable' -- құрылғыда бет анықтау жұмыс істемейді (тек фото)
));

-- Қайтаратын бағандар өзгерді — функцияны қайта құрамыз
drop function public.admin_proctoring_attempts(integer, integer, uuid);
create function public.admin_proctoring_attempts(p_limit integer default 50, p_offset integer default 0, p_user uuid default null)
returns table (
  attempt_id uuid,
  user_id uuid,
  started_at timestamptz,
  finished_at timestamptz,
  status public.attempt_status,
  no_face bigint,
  multiple_faces bigint,
  phone_detected bigint,
  looking_away bigint,
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
    count(*) filter (where e.type = 'phone_detected'),
    count(*) filter (where e.type = 'looking_away'),
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
