-- =====================================================================
-- 1) Прокторинг: оқиға қай сұрақта болғаны (сұрақ нөмірі) және «камера қайта қосылды» оқиғасы.
-- 2) ҰБТ-2026 спецификациясы: Қазақстан тарихы = 10 жеке сұрақ + 2 контекст × 5 сұрақ.
-- =====================================================================

alter table public.proctoring_events
  add column question_no smallint check (question_no between 1 and 500);

alter table public.proctoring_events drop constraint proctoring_events_type_check;
alter table public.proctoring_events add constraint proctoring_events_type_check check (type in (
  'consent',          -- келісім берілді, камера қосылды
  'snapshot',         -- кезекті фото
  'no_face',          -- камерада бет жоқ
  'multiple_faces',   -- камерада бірнеше адам
  'camera_off',       -- камера өшірілді / рұқсат алынды
  'camera_on',        -- өшкен камера қайта қосылды
  'tab_hidden',       -- басқа бетке/қолданбаға ауысты
  'detector_unavailable' -- құрылғыда бет анықтау жұмыс істемейді (тек фото)
));

-- Админ әлі өзгертпеген болса ғана (тарих бөлімі бұрынғы «20 жеке сұрақ» күйінде)
update public.app_settings
set value = jsonb_set(value, '{sections,0,composition}', '{"single": 10, "context": 10}'::jsonb)
where key = 'unt_structure'
  and value #>> '{sections,0,subject}' = 'history_kz'
  and value #> '{sections,0,composition}' = '{"single": 20}'::jsonb;
