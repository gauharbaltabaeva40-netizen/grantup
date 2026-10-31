-- =====================================================================
-- 4-кезең: XP беру (атомарлы, идемпотентті) және деңгейді есептеу.
-- 8-кезеңде (геймификация) streak пен апталық лига XP-і осы функцияға қосылады.
-- =====================================================================

-- Жалпы XP бойынша деңгей (app_settings.levels конфигінен)
create or replace function public.level_for_xp(p_xp integer)
returns integer
language sql
stable
set search_path = ''
as $$
  select coalesce(max((l ->> 'level')::int), 1)
  from public.app_settings s, jsonb_array_elements(s.value) l
  where s.key = 'levels' and (l ->> 'xp')::int <= p_xp;
$$;

/**
 * XP беру. Бір (пайдаланушы, себеп, объект) үшін тек бір рет — қайта шақырылса, ештеңе өзгермейді.
 * Қайтарады: awarded (берілді ме), xp (жаңа жалпы XP), level (жаңа деңгей), level_up (деңгей көтерілді ме).
 */
create or replace function public.award_xp(p_user uuid, p_amount integer, p_reason text, p_ref text)
returns table (awarded boolean, xp integer, level integer, level_up boolean)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_inserted integer;
  v_old_level integer;
  v_xp integer;
  v_level integer;
begin
  if p_amount <= 0 then
    raise exception 'XP amount must be positive';
  end if;

  insert into public.xp_events (user_id, amount, reason, ref_id)
  values (p_user, p_amount, p_reason, p_ref)
  on conflict do nothing;
  get diagnostics v_inserted = row_count;

  select p.xp, p.level into v_xp, v_old_level from public.profiles p where p.id = p_user for update;

  if v_inserted = 0 then
    return query select false, v_xp, v_old_level, false;
    return;
  end if;

  v_xp := v_xp + p_amount;
  v_level := public.level_for_xp(v_xp);
  update public.profiles set xp = v_xp, level = v_level where id = p_user;

  return query select true, v_xp, v_level, v_level > v_old_level;
end;
$$;

revoke execute on function public.award_xp(uuid, integer, text, text) from public, anon, authenticated;
grant execute on function public.award_xp(uuid, integer, text, text) to service_role;
grant execute on function public.level_for_xp(integer) to authenticated, service_role;
