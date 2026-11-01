-- =====================================================================
-- 8-кезең: геймификация — streak (+ freeze), апталық лигалар, жетістіктер, мерекелеу белгілері.
-- Барлық есептеу дерекқорда, атомарлы: award_xp() бір шақыруда XP, streak, лига XP-і және жетістіктерді жаңартады.
-- Күн шекарасы — Asia/Almaty.
-- =====================================================================

alter table public.profiles
  add column celebrated_level integer not null default 1,
  add column celebrated_streak_date date;

alter table public.user_achievements
  add column seen_at timestamptz;

-- ---------------------------------------------------------------------
-- Көмекшілер
-- ---------------------------------------------------------------------
create or replace function public.almaty_today()
returns date
language sql
stable
set search_path = ''
as $$
  select (now() at time zone 'Asia/Almaty')::date;
$$;

-- Ағымдағы лига аптасының басы (дүйсенбі, Asia/Almaty)
create or replace function public.league_week_start(p_day date default null)
returns date
language sql
stable
set search_path = ''
as $$
  select (coalesce(p_day, public.almaty_today()) - ((extract(isodow from coalesce(p_day, public.almaty_today()))::int - 1)))::date;
$$;

create or replace function public.setting_int(p_key text, p_path text, p_default integer)
returns integer
language sql
stable
set search_path = ''
as $$
  select coalesce((select (value ->> p_path)::int from public.app_settings where key = p_key), p_default);
$$;

-- ---------------------------------------------------------------------
-- Streak: бүгінгі белсенділікті тіркеу.
-- Кеше белсенді болса — +1; бір күн өткізілсе және freeze болса — freeze жұмсалып, серия сақталады; әйтпесе 1-ден.
-- Қайтарады: жаңа күн басталды ма және ағымдағы серия.
-- ---------------------------------------------------------------------
create or replace function public.register_activity(p_user uuid)
returns table (new_day boolean, streak integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_today date := public.almaty_today();
  v_last date;
  v_streak integer;
  v_freezes smallint;
begin
  select p.last_active_date, p.streak, p.streak_freezes into v_last, v_streak, v_freezes
  from public.profiles p where p.id = p_user for update;

  if v_last = v_today then
    return query select false, v_streak;
    return;
  end if;

  if v_last = v_today - 1 then
    v_streak := v_streak + 1;
  elsif v_last = v_today - 2 and v_freezes > 0 then
    v_streak := v_streak + 1;
    v_freezes := v_freezes - 1;
  else
    v_streak := 1;
  end if;

  update public.profiles
  set last_active_date = v_today,
      streak = v_streak,
      longest_streak = greatest(longest_streak, v_streak),
      streak_freezes = v_freezes
  where id = p_user;

  return query select true, v_streak;
end;
$$;

-- ---------------------------------------------------------------------
-- Лига: оқушыны осы аптаның тобына қосу (бос орны бар топ, болмаса жаңа топ)
-- ---------------------------------------------------------------------
create or replace function public.ensure_league_member(p_user uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_week date := public.league_week_start();
  v_group uuid;
  v_tier smallint;
  v_size integer := public.setting_int('league', 'groupSize', 30);
begin
  select m.group_id into v_group from public.league_members m where m.user_id = p_user and m.week_start = v_week;
  if v_group is not null then
    return v_group;
  end if;

  select p.league_tier into v_tier from public.profiles p where p.id = p_user;

  select g.id into v_group
  from public.league_groups g
  where g.tier = v_tier and g.week_start = v_week and g.closed_at is null
    and (select count(*) from public.league_members m where m.group_id = g.id) < v_size
  order by g.created_at
  limit 1
  for update skip locked;

  if v_group is null then
    insert into public.league_groups (tier, week_start) values (v_tier, v_week) returning id into v_group;
  end if;

  insert into public.league_members (group_id, user_id, week_start)
  values (v_group, p_user, v_week)
  on conflict (user_id, week_start) do nothing;

  select m.group_id into v_group from public.league_members m where m.user_id = p_user and m.week_start = v_week;
  return v_group;
end;
$$;

-- ---------------------------------------------------------------------
-- Жетістіктер: шарттарды тексеріп, жаңаларын береді (+ олардың XP-і). Қайтарады: жаңа жетістік кодтары.
-- ---------------------------------------------------------------------
create or replace function public.check_achievements(p_user uuid)
returns setof text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_code text;
  v_reward integer;
  v_profile record;
  v_answers integer;
  v_fixed integer;
  v_earned boolean;
begin
  select p.longest_streak into v_profile from public.profiles p where p.id = p_user;
  select count(*) into v_answers from public.attempt_answers a where a.user_id = p_user and a.answered_at is not null;
  select count(*) into v_fixed from public.user_mistakes m where m.user_id = p_user and m.resolved_at is not null;

  for v_code, v_reward in
    select a.code, a.xp_reward from public.achievements a
    where not exists (select 1 from public.user_achievements u where u.user_id = p_user and u.achievement_code = a.code)
  loop
    v_earned := case v_code
      when 'first_lesson' then exists (select 1 from public.lesson_progress lp where lp.user_id = p_user and lp.completed_at is not null)
      when 'diagnostic' then exists (select 1 from public.attempts t where t.user_id = p_user and t.kind = 'diagnostic' and t.status = 'finished')
      when 'first_mock' then exists (select 1 from public.attempts t where t.user_id = p_user and t.kind = 'mock' and t.status in ('finished', 'expired'))
      when 'streak_7' then v_profile.longest_streak >= 7
      when 'streak_30' then v_profile.longest_streak >= 30
      when 'questions_100' then v_answers >= 100
      when 'questions_1000' then v_answers >= 1000
      when 'mistakes_fixed_50' then v_fixed >= 50
      when 'mock_100' then exists (select 1 from public.attempts t where t.user_id = p_user and t.kind = 'mock' and t.status in ('finished', 'expired') and t.score >= 100)
      when 'league_promoted' then exists (select 1 from public.league_members m where m.user_id = p_user and m.outcome = 'promoted')
      when 'history_master' then (
        exists (select 1 from public.lessons l join public.topics tp on tp.id = l.topic_id join public.subjects s on s.id = tp.subject_id
                where s.code = 'history_kz' and l.is_published)
        and not exists (
          select 1 from public.lessons l join public.topics tp on tp.id = l.topic_id join public.subjects s on s.id = tp.subject_id
          where s.code = 'history_kz' and l.is_published
            and not exists (select 1 from public.lesson_progress lp where lp.user_id = p_user and lp.lesson_id = l.id and lp.completed_at is not null)
        )
      )
      else false
    end;

    if v_earned then
      insert into public.user_achievements (user_id, achievement_code) values (p_user, v_code) on conflict do nothing;
      if v_reward > 0 then
        insert into public.xp_events (user_id, amount, reason, ref_id) values (p_user, v_reward, 'achievement', v_code) on conflict do nothing;
        update public.profiles set xp = xp + v_reward, level = greatest(level, public.level_for_xp(xp + v_reward)) where id = p_user;
      end if;
      return next v_code;
    end if;
  end loop;
end;
$$;

-- ---------------------------------------------------------------------
-- award_xp (қайта анықтау): XP + деңгей + streak (күндік бонус) + апталық лига XP-і + жетістіктер
-- ---------------------------------------------------------------------
create or replace function public.award_xp(p_user uuid, p_amount integer, p_reason text, p_ref text)
returns table (awarded boolean, xp integer, level integer, level_up boolean)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_inserted integer;
  v_old_level integer;
  v_total integer := p_amount;
  v_activity record;
  v_bonus integer := public.setting_int('xp', 'streakDay', 10);
  v_group uuid;
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

  -- Күннің алғашқы белсенділігі: серия жаңарады; серия ≥ 2 болса — бонус XP (күніне бір рет)
  select * into v_activity from public.register_activity(p_user);
  if v_activity.new_day and v_activity.streak >= 2 and v_bonus > 0 then
    insert into public.xp_events (user_id, amount, reason, ref_id)
    values (p_user, v_bonus, 'streak_day', public.almaty_today()::text)
    on conflict do nothing;
    get diagnostics v_inserted = row_count;
    if v_inserted > 0 then v_total := v_total + v_bonus; end if;
  end if;

  v_xp := v_xp + v_total;
  v_level := greatest(v_old_level, public.level_for_xp(v_xp));
  update public.profiles set xp = v_xp, level = v_level where id = p_user;

  -- Апталық лига
  v_group := public.ensure_league_member(p_user);
  update public.league_members set weekly_xp = weekly_xp + v_total
  where group_id = v_group and user_id = p_user;

  perform public.check_achievements(p_user);

  select p.xp, p.level into v_xp, v_level from public.profiles p where p.id = p_user;
  return query select true, v_xp, v_level, v_level > v_old_level;
end;
$$;

revoke execute on function public.award_xp(uuid, integer, text, text) from public, anon, authenticated;
grant execute on function public.award_xp(uuid, integer, text, text) to service_role;

-- ---------------------------------------------------------------------
-- Streak freeze сатып алу (XP-мен). Деңгей төмендемейді.
-- ---------------------------------------------------------------------
create or replace function public.buy_streak_freeze(p_user uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cost integer := public.setting_int('xp', 'streakFreezeCost', 200);
  v_max integer := 2;
  v_xp integer;
  v_freezes smallint;
begin
  select p.xp, p.streak_freezes into v_xp, v_freezes from public.profiles p where p.id = p_user for update;
  if v_freezes >= v_max then return 'max_reached'; end if;
  if v_xp < v_cost then return 'not_enough_xp'; end if;

  update public.profiles set xp = xp - v_cost, streak_freezes = streak_freezes + 1 where id = p_user;
  insert into public.xp_events (user_id, amount, reason, ref_id)
  values (p_user, -v_cost, 'streak_freeze', gen_random_uuid()::text);
  return 'ok';
end;
$$;

-- ---------------------------------------------------------------------
-- Апта қорытындысы (дүйсенбі 00:00 Asia/Almaty, cron): жоғарғы N көтеріледі, төменгі M түседі
-- ---------------------------------------------------------------------
create or replace function public.close_league_week(p_week date)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_promote integer := public.setting_int('league', 'promote', 7);
  v_demote integer := public.setting_int('league', 'demote', 5);
  v_max_tier smallint := (select max(tier) from public.leagues);
  v_group record;
  v_count integer;
  v_closed integer := 0;
begin
  for v_group in
    select g.id, g.tier from public.league_groups g
    where g.week_start = p_week and g.closed_at is null
    for update
  loop
    select count(*) into v_count from public.league_members m where m.group_id = v_group.id;

    with ranked as (
      select m.user_id, m.weekly_xp,
             row_number() over (order by m.weekly_xp desc, m.joined_at asc) as rnk
      from public.league_members m where m.group_id = v_group.id
    )
    update public.league_members m
    set final_rank = r.rnk,
        outcome = case
          when r.rnk <= v_promote and r.weekly_xp > 0 and v_group.tier < v_max_tier then 'promoted'
          when r.rnk > greatest(v_count - v_demote, v_promote) and v_group.tier > 1 then 'demoted'
          else 'stayed'
        end
    from ranked r
    where m.group_id = v_group.id and m.user_id = r.user_id;

    update public.profiles p
    set league_tier = case m.outcome when 'promoted' then p.league_tier + 1 when 'demoted' then p.league_tier - 1 else p.league_tier end
    from public.league_members m
    where m.group_id = v_group.id and m.user_id = p.id and m.outcome in ('promoted', 'demoted');

    perform public.check_achievements(m.user_id)
    from public.league_members m where m.group_id = v_group.id and m.outcome = 'promoted';

    update public.league_groups set closed_at = now() where id = v_group.id;
    v_closed := v_closed + 1;
  end loop;
  return v_closed;
end;
$$;

-- ---------------------------------------------------------------------
-- Құқықтар: тек сервер
-- ---------------------------------------------------------------------
revoke execute on function public.register_activity(uuid) from public, anon, authenticated;
revoke execute on function public.ensure_league_member(uuid) from public, anon, authenticated;
revoke execute on function public.check_achievements(uuid) from public, anon, authenticated;
revoke execute on function public.buy_streak_freeze(uuid) from public, anon, authenticated;
revoke execute on function public.close_league_week(date) from public, anon, authenticated;
grant execute on function public.register_activity(uuid) to service_role;
grant execute on function public.ensure_league_member(uuid) to service_role;
grant execute on function public.check_achievements(uuid) to service_role;
grant execute on function public.buy_streak_freeze(uuid) to service_role;
grant execute on function public.close_league_week(date) to service_role;
grant execute on function public.almaty_today() to authenticated, service_role;
grant execute on function public.league_week_start(date) to authenticated, service_role;

-- Оқушы жетістікті «көрдім» деп белгілей алады (мерекелеу терезесі)
grant update (seen_at) on public.user_achievements to authenticated;
create policy "user_achievements: өзі seen_at жаңартады" on public.user_achievements for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
