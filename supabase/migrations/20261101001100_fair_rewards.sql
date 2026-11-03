-- =====================================================================
-- Әділ марапат: бос аяқталған сынақ/диагностикаға XP мен жетістік берілмейді.
-- Ереже (қосымшадағы isEngaged() сияқты): сұрақтардың кемінде жартысына жауап берілген болуы керек.
-- Сонымен қатар «100+ балл» жетістігі 140 баллдық шкалаға келтіріліп тексеріледі.
-- =====================================================================

create or replace function public.attempt_is_engaged(p_attempt uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(array_length(t.question_ids, 1), 0) > 0
     and (
       select count(*) from public.attempt_answers a
       where a.attempt_id = t.id and a.answered_at is not null
     ) * 2 >= coalesce(array_length(t.question_ids, 1), 0)
  from public.attempts t
  where t.id = p_attempt;
$$;

revoke execute on function public.attempt_is_engaged(uuid) from public, anon, authenticated;
grant execute on function public.attempt_is_engaged(uuid) to service_role;

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
      when 'diagnostic' then exists (
        select 1 from public.attempts t
        where t.user_id = p_user and t.kind = 'diagnostic' and t.status = 'finished' and public.attempt_is_engaged(t.id)
      )
      when 'first_mock' then exists (
        select 1 from public.attempts t
        where t.user_id = p_user and t.kind = 'mock' and t.status in ('finished', 'expired') and public.attempt_is_engaged(t.id)
      )
      when 'streak_7' then v_profile.longest_streak >= 7
      when 'streak_30' then v_profile.longest_streak >= 30
      when 'questions_100' then v_answers >= 100
      when 'questions_1000' then v_answers >= 1000
      when 'mistakes_fixed_50' then v_fixed >= 50
      -- 140 баллдық шкалаға келтіріп салыстырамыз (вариантта сұрақ аз болса да әділ)
      when 'mock_100' then exists (
        select 1 from public.attempts t
        where t.user_id = p_user and t.kind = 'mock' and t.status in ('finished', 'expired')
          and t.max_score > 0 and t.score / t.max_score * 140 >= 100
      )
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
