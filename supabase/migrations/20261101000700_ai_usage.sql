-- =====================================================================
-- 7-кезең: AI-тьютор лимиттері (атомарлы есептеуіш).
-- =====================================================================

/**
 * Күндік лимитті тексеріп, бір бірлікке арттыру. true — рұқсат (санауыш артты), false — лимит толды.
 * Бір мезгілдегі сұраныстар лимиттен аса алмайды (жол деңгейінде құлыптау).
 */
create or replace function public.ai_usage_hit(p_user uuid, p_day date, p_kind text, p_max integer)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  insert into public.ai_usage as u (user_id, day, kind, count)
  values (p_user, p_day, p_kind, 1)
  on conflict (user_id, day, kind) do update
    set count = u.count + 1
    where u.count < p_max
  returning count into v_count;

  return v_count is not null and v_count <= p_max;
end;
$$;

/** API қатесі болса — санауышты қайтару (оқушы лимитін жоғалтпауы үшін). */
create or replace function public.ai_usage_refund(p_user uuid, p_day date, p_kind text)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.ai_usage set count = greatest(count - 1, 0)
  where user_id = p_user and day = p_day and kind = p_kind;
$$;

revoke execute on function public.ai_usage_hit(uuid, date, text, integer) from public, anon, authenticated;
revoke execute on function public.ai_usage_refund(uuid, date, text) from public, anon, authenticated;
grant execute on function public.ai_usage_hit(uuid, date, text, integer) to service_role;
grant execute on function public.ai_usage_refund(uuid, date, text) to service_role;
