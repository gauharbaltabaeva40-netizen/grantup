-- =====================================================================
-- 2-кезең: профильдер, рөлдер, доступ (freemium / толық), құрылғылар,
-- қауіпсіздік оқиғалары, audit log, rate limiting.
-- Қалған кестелер (пәндер, сұрақтар, т.б.) 3-кезеңде қосылады.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Типтер
-- ---------------------------------------------------------------------
create type public.user_role as enum ('student', 'admin');
create type public.grade_level as enum ('10', '11', 'graduate');
create type public.app_locale as enum ('kk', 'ru');
create type public.device_request_status as enum ('pending', 'approved', 'rejected', 'used', 'blocked', 'expired');

-- ---------------------------------------------------------------------
-- Ортақ: updated_at триггері
-- ---------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- Админ болатын email-дер (тіркелгенде рөл автоматты қойылады)
-- ---------------------------------------------------------------------
create table public.admin_emails (
  email text primary key check (email = lower(email))
);
alter table public.admin_emails enable row level security;
-- Саясат жоқ: тек service_role / SQL editor арқылы өзгертіледі.

-- ---------------------------------------------------------------------
-- Профильдер
-- ---------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null unique check (email = lower(email)),
  role public.user_role not null default 'student',
  full_name text not null default '' check (char_length(full_name) <= 100),
  nickname text check (char_length(nickname) between 2 and 30),
  avatar text check (char_length(avatar) <= 50),
  grade public.grade_level,
  locale public.app_locale not null default 'kk',
  profile_pair text not null default 'math_informatics',
  target_score smallint check (target_score between 0 and 140),
  xp integer not null default 0 check (xp >= 0),
  level integer not null default 1 check (level >= 1),
  streak integer not null default 0 check (streak >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;

-- Ағымдағы пайдаланушы админ бе? (RLS ішінде рекурсиясыз қолдану үшін security definer)
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role = 'admin'
  );
$$;

create policy "profiles: өзін немесе админ оқиды"
  on public.profiles for select to authenticated
  using (id = (select auth.uid()) or (select public.is_admin()));

create policy "profiles: өзін жаңартады"
  on public.profiles for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- Оқушы тек осы бағандарды өзгерте алады (role, xp, streak т.б. — тек сервер).
revoke insert, update, delete on public.profiles from anon, authenticated;
grant update (full_name, nickname, avatar, grade, locale, target_score) on public.profiles to authenticated;

-- ---------------------------------------------------------------------
-- Доступ (толық курс). Тіркелмеген email-ге де алдын ала беруге болады.
-- ---------------------------------------------------------------------
create table public.access_grants (
  id uuid primary key default gen_random_uuid(),
  email text not null check (email = lower(email)),
  user_id uuid references auth.users (id) on delete set null,
  starts_at timestamptz not null default now(),
  ends_at timestamptz not null,
  revoked_at timestamptz,
  granted_by uuid references auth.users (id) on delete set null,
  note text check (char_length(note) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at)
);

create index access_grants_email_idx on public.access_grants (email);
create index access_grants_user_idx on public.access_grants (user_id);

create trigger access_grants_updated_at before update on public.access_grants
  for each row execute function public.set_updated_at();

alter table public.access_grants enable row level security;

create policy "access_grants: өзінікін немесе админ оқиды"
  on public.access_grants for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));

revoke insert, update, delete on public.access_grants from anon, authenticated;

-- Сервер / админ үшін: кез келген пайдаланушының толық доступы бар ма
create or replace function public.user_has_full_access(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.access_grants g
    where (g.user_id = p_user or g.email = (select p.email from public.profiles p where p.id = p_user))
      and g.revoked_at is null
      and now() >= g.starts_at
      and now() < g.ends_at
  );
$$;

revoke execute on function public.user_has_full_access(uuid) from public, anon, authenticated;
grant execute on function public.user_has_full_access(uuid) to service_role;

-- RLS саясаттары үшін (3-кезеңнен бастап ақылы контентке): ағымдағы пайдаланушы
create or replace function public.has_full_access()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.user_has_full_access((select auth.uid()));
$$;

revoke execute on function public.has_full_access() from public, anon;
grant execute on function public.has_full_access() to authenticated, service_role;

-- ---------------------------------------------------------------------
-- Құрылғылар (бір аккаунтқа ең көбі 2 белсенді)
-- ---------------------------------------------------------------------
create table public.devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  device_key text not null check (char_length(device_key) between 16 and 100),
  fingerprint text not null check (char_length(fingerprint) <= 128),
  label text not null check (char_length(label) <= 100),
  user_agent text check (char_length(user_agent) <= 500),
  last_ip inet,
  last_city text,
  last_country text,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  revoked_at timestamptz,
  revoked_by uuid references auth.users (id) on delete set null
);

create unique index devices_active_key_idx on public.devices (user_id, device_key) where revoked_at is null;
create index devices_user_idx on public.devices (user_id) where revoked_at is null;

alter table public.devices enable row level security;

create policy "devices: өзінікін немесе админ оқиды"
  on public.devices for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));

revoke insert, update, delete on public.devices from anon, authenticated;

-- ---------------------------------------------------------------------
-- Жаңа құрылғыны растау сұраныстары.
-- Код админ рұқсат бергенде жасалады, тек хэші сақталады (кодты админ бір рет көреді).
-- ---------------------------------------------------------------------
create table public.device_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  device_key text not null check (char_length(device_key) between 16 and 100),
  fingerprint text not null check (char_length(fingerprint) <= 128),
  label text not null check (char_length(label) <= 100),
  user_agent text check (char_length(user_agent) <= 500),
  ip inet,
  city text,
  country text,
  status public.device_request_status not null default 'pending',
  code_hash text,
  code_expires_at timestamptz,
  failed_attempts smallint not null default 0,
  replace_device_id uuid references public.devices (id) on delete set null,
  decided_by uuid references auth.users (id) on delete set null,
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Бір құрылғыға бір уақытта бір ғана ашық сұраныс
create unique index device_requests_open_idx on public.device_requests (user_id, device_key)
  where status in ('pending', 'approved', 'blocked');
create index device_requests_status_idx on public.device_requests (status, created_at desc);

create trigger device_requests_updated_at before update on public.device_requests
  for each row execute function public.set_updated_at();

alter table public.device_requests enable row level security;

create policy "device_requests: тек админ оқиды"
  on public.device_requests for select to authenticated
  using ((select public.is_admin()));

-- Код хэшін ешкім API арқылы оқымайды: кесте деңгейіндегі SELECT алынып, бағандар бөлек беріледі
revoke select, insert, update, delete on public.device_requests from anon, authenticated;
grant select (
  id, user_id, device_key, fingerprint, label, user_agent, ip, city, country, status,
  code_expires_at, failed_attempts, replace_device_id, decided_by, decided_at, created_at, updated_at
) on public.device_requests to authenticated;

-- ---------------------------------------------------------------------
-- Қауіпсіздік оқиғалары (кіру, күдікті белсенділік; 11-кезеңде скриншот т.б.)
-- ---------------------------------------------------------------------
create table public.security_events (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users (id) on delete cascade,
  type text not null check (char_length(type) <= 50),
  severity text not null default 'info' check (severity in ('info', 'warning', 'critical')),
  ip inet,
  city text,
  country text,
  user_agent text check (char_length(user_agent) <= 500),
  device_id uuid references public.devices (id) on delete set null,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index security_events_user_idx on public.security_events (user_id, created_at desc);
create index security_events_severity_idx on public.security_events (severity, created_at desc) where severity <> 'info';

alter table public.security_events enable row level security;

create policy "security_events: тек админ оқиды"
  on public.security_events for select to authenticated
  using ((select public.is_admin()));

revoke insert, update, delete on public.security_events from anon, authenticated;

-- ---------------------------------------------------------------------
-- Админ әрекеттерінің журналы
-- ---------------------------------------------------------------------
create table public.audit_log (
  id bigint generated always as identity primary key,
  actor_id uuid references auth.users (id) on delete set null,
  action text not null,
  target_type text,
  target_id text,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index audit_log_created_idx on public.audit_log (created_at desc);

alter table public.audit_log enable row level security;

create policy "audit_log: тек админ оқиды"
  on public.audit_log for select to authenticated
  using ((select public.is_admin()));

revoke insert, update, delete on public.audit_log from anon, authenticated;

-- ---------------------------------------------------------------------
-- Rate limiting (тіркелген терезе). true = рұқсат, false = шектеуден асты.
-- ---------------------------------------------------------------------
create table public.rate_limits (
  key text primary key,
  count integer not null,
  window_start timestamptz not null
);
alter table public.rate_limits enable row level security;

create or replace function public.rate_limit_hit(p_key text, p_max integer, p_window_seconds integer)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  insert into public.rate_limits as r (key, count, window_start)
  values (p_key, 1, now())
  on conflict (key) do update set
    count = case when r.window_start < now() - make_interval(secs => p_window_seconds) then 1 else r.count + 1 end,
    window_start = case when r.window_start < now() - make_interval(secs => p_window_seconds) then now() else r.window_start end
  returning count into v_count;

  return v_count <= p_max;
end;
$$;

revoke execute on function public.rate_limit_hit(text, integer, integer) from public, anon, authenticated;
grant execute on function public.rate_limit_hit(text, integer, integer) to service_role;

-- ---------------------------------------------------------------------
-- Жаңа пайдаланушы: профиль жасау, админ рөлі, алдын ала берілген доступты байлау
-- ---------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
begin
  insert into public.profiles (id, email, role, full_name, grade, locale)
  values (
    new.id,
    lower(new.email),
    case when exists (select 1 from public.admin_emails a where a.email = lower(new.email))
      then 'admin'::public.user_role else 'student'::public.user_role end,
    left(coalesce(meta ->> 'full_name', ''), 100),
    case when meta ->> 'grade' in ('10', '11', 'graduate') then (meta ->> 'grade')::public.grade_level end,
    case when meta ->> 'locale' = 'ru' then 'ru'::public.app_locale else 'kk'::public.app_locale end
  );

  update public.access_grants
  set user_id = new.id
  where email = lower(new.email) and user_id is null;

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
