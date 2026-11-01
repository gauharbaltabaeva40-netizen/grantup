-- =====================================================================
-- 10-кезең: хабарламалар журналы (бір хабарлама екі рет жіберілмеуі үшін) және лига аймағы.
-- =====================================================================

create table public.notification_log (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('push_streak', 'push_league_zone', 'push_week', 'email_weekly', 'email_access_expiry')),
  ref text not null,                     -- мысалы, күн, апта немесе грант ID
  channel text not null check (channel in ('push', 'email')),
  delivered integer not null default 0,  -- сәтті жеткізілген құрылғы/хат саны
  created_at timestamptz not null default now(),
  unique (user_id, kind, ref)
);
create index notification_log_created_idx on public.notification_log (created_at desc);

alter table public.notification_log enable row level security;
create policy "notification_log: тек админ оқиды" on public.notification_log for select to authenticated
  using ((select public.is_admin()));
revoke insert, update, delete on public.notification_log from anon, authenticated;
revoke select on public.notification_log from anon;

-- Лигадағы соңғы хабарланған аймақ: 'up' | 'down' | 'mid'
alter table public.league_members add column notified_zone text check (notified_zone in ('up', 'down', 'mid'));
