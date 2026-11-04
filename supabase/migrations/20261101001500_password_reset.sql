-- =====================================================================
-- Құпиясөзді әкімші арқылы қалпына келтіру (email жоқ болғандықтан).
-- Құпиясөз ешқашан көрінбейді (Supabase тек хэшін сақтайды): әкімші уақытша құпиясөз береді,
-- оқушы келесі кіргенде оны өз құпиясөзіне ауыстыруы міндетті.
-- =====================================================================

-- Оқушы өзі өзгерте алмайды (profiles-ке тек нақты бағандарға update рұқсаты бар)
alter table public.profiles add column must_change_password boolean not null default false;

-- Оқушының барлық сессиясын жабу (уақытша құпиясөз берілгенде). Тек сервер (service_role).
create or replace function public.admin_revoke_sessions(p_user uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  n integer;
begin
  delete from auth.sessions where user_id = p_user;
  get diagnostics n = row_count;
  return n;
end;
$$;
revoke execute on function public.admin_revoke_sessions(uuid) from public, anon, authenticated;
grant execute on function public.admin_revoke_sessions(uuid) to service_role;
