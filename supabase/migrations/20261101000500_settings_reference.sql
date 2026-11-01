-- =====================================================================
-- 3-кезең (3/3): баптаулар (админ-панельден өзгертілетін конфиг), анықтамалық деректер, Storage.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Баптаулар: ҰБТ құрылымы, балл есептеу, AI лимиттері, лига, XP, деңгейлер.
-- Формат өзгерсе — кодты емес, осы мәндерді өзгертесіз (12-кезеңдегі «Баптаулар» беті).
-- ---------------------------------------------------------------------
create table public.app_settings (
  key text primary key check (key ~ '^[a-z_]+$'),
  value jsonb not null,
  description text,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null
);
create trigger app_settings_updated_at before update on public.app_settings
  for each row execute function public.set_updated_at();

alter table public.app_settings enable row level security;
create policy "app_settings: кірген әр адам оқиды" on public.app_settings for select to authenticated using (true);
revoke insert, update, delete on public.app_settings from anon, authenticated;
revoke select on public.app_settings from anon;

insert into public.app_settings (key, value, description) values
(
  'unt_structure',
  $json${
    "year": 2026,
    "durationMinutes": 240,
    "totalQuestions": 120,
    "maxScore": 140,
    "sections": [
      { "subject": "history_kz",       "questions": 20, "maxPoints": 20, "composition": { "single": 20 } },
      { "subject": "reading_literacy", "questions": 10, "maxPoints": 10, "composition": { "context": 10 } },
      { "subject": "math_literacy",    "questions": 10, "maxPoints": 10, "composition": { "single": 10 } },
      { "subject": "math",             "questions": 40, "maxPoints": 50, "composition": { "single": 25, "context": 5, "multiple": 10 } },
      { "subject": "informatics",      "questions": 40, "maxPoints": 50, "composition": { "single": 25, "context": 5, "multiple": 10 } }
    ],
    "scoring": {
      "single": 1,
      "context": 1,
      "multiple": { "maxPoints": 2, "byMistakes": [2, 1] }
    }
  }$json$::jsonb,
  'ҰБТ құрылымы. multiple.byMistakes: қате саны → балл (0 қате = 2, 1 қате = 1, одан көп = 0). Қате = артық таңдалған немесе таңдалмай қалған дұрыс нұсқа.'
),
(
  'diagnostic',
  '{ "durationMinutes": 20, "perSubject": { "history_kz": 4, "reading_literacy": 3, "math_literacy": 3, "math": 5, "informatics": 5 } }'::jsonb,
  'Онбордингтегі диагностикалық тест'
),
(
  'ai_limits',
  '{ "paidDailyExplanations": 30, "freeDailyExplanations": 3, "planRegenerationsPerWeek": 3, "model": "claude-opus-5-5" }'::jsonb,
  'AI-тьютор лимиттері (бір оқушыға, Asia/Almaty тәулігі)'
),
(
  'league',
  '{ "groupSize": 30, "promote": 7, "demote": 5, "timezone": "Asia/Almaty", "weekResetDay": "monday" }'::jsonb,
  'Апталық лига параметрлері'
),
(
  'xp',
  '{ "lessonComplete": 20, "questionCorrect": 2, "mistakeFixed": 5, "streakDay": 10, "mockFinished": 50, "diagnosticFinished": 30, "streakFreezeCost": 200, "quizPassPercent": 70 }'::jsonb,
  'XP мөлшерлері және сабақ тестінің өту шегі'
),
(
  'levels',
  $json$[
    { "level": 1,  "xp": 0,     "name_kk": "Бастаушы",     "name_ru": "Новичок" },
    { "level": 2,  "xp": 100,   "name_kk": "Ізденуші",     "name_ru": "Искатель" },
    { "level": 3,  "xp": 300,   "name_kk": "Талапкер",     "name_ru": "Абитуриент" },
    { "level": 4,  "xp": 600,   "name_kk": "Білімпаз",     "name_ru": "Знаток" },
    { "level": 5,  "xp": 1000,  "name_kk": "Зерделі",      "name_ru": "Эрудит" },
    { "level": 6,  "xp": 1600,  "name_kk": "Шебер",        "name_ru": "Мастер" },
    { "level": 7,  "xp": 2400,  "name_kk": "Сарапшы",      "name_ru": "Эксперт" },
    { "level": 8,  "xp": 3500,  "name_kk": "Ұстаз",        "name_ru": "Наставник" },
    { "level": 9,  "xp": 5000,  "name_kk": "Грант иесі",   "name_ru": "Грантник" },
    { "level": 10, "xp": 7000,  "name_kk": "Аңыз",         "name_ru": "Легенда" }
  ]$json$::jsonb,
  'Деңгейлер: жиналған жалпы XP шегі және атауы'
);

-- ---------------------------------------------------------------------
-- Пәндер (тұрақты анықтамалық)
-- ---------------------------------------------------------------------
insert into public.subjects (code, title_kk, title_ru, kind, icon, color, position) values
  ('history_kz',       'Қазақстан тарихы',          'История Казахстана',          'mandatory', 'landmark',     '#B45309', 1),
  ('math_literacy',    'Математикалық сауаттылық',  'Математическая грамотность',  'mandatory', 'calculator',   '#0A84FF', 2),
  ('reading_literacy', 'Оқу сауаттылығы',           'Грамотность чтения',          'mandatory', 'book-open',    '#16A34A', 3),
  ('math',             'Математика',                'Математика',                  'profile',   'sigma',        '#0047FF', 4),
  ('informatics',      'Информатика',               'Информатика',                 'profile',   'code',         '#7B3FF2', 5);

-- ---------------------------------------------------------------------
-- Жетістіктер
-- ---------------------------------------------------------------------
insert into public.achievements (code, title_kk, title_ru, description_kk, description_ru, icon, xp_reward, position) values
  ('first_lesson',   'Алғашқы қадам',   'Первый шаг',        'Алғашқы сабақты аяқтадыңыз',            'Вы завершили первый урок',              'footprints', 10, 1),
  ('diagnostic',     'Бастапқы нүкте',  'Точка отсчёта',     'Диагностикалық тесттен өттіңіз',        'Вы прошли диагностический тест',        'compass',    10, 2),
  ('first_mock',     'Алғашқы сынақ',   'Первое пробное',    'Алғашқы сынақ ҰБТ-ны тапсырдыңыз',      'Вы сдали первое пробное ЕНТ',           'flag',       30, 3),
  ('streak_7',       '7 күндік streak', 'Серия 7 дней',      '7 күн қатарынан оқыдыңыз',              'Вы занимались 7 дней подряд',           'flame',      50, 4),
  ('streak_30',      '30 күндік streak','Серия 30 дней',     '30 күн қатарынан оқыдыңыз',             'Вы занимались 30 дней подряд',          'flame',     150, 5),
  ('questions_100',  '100 сұрақ',       '100 вопросов',      '100 сұраққа жауап бердіңіз',            'Вы ответили на 100 вопросов',           'target',     30, 6),
  ('questions_1000', '1000 сұрақ',      '1000 вопросов',     '1000 сұраққа жауап бердіңіз',           'Вы ответили на 1000 вопросов',          'target',    100, 7),
  ('mistakes_fixed_50','Қатемен жұмыс', 'Работа над ошибками','50 қатені түзедіңіз',                 'Вы исправили 50 ошибок',                'wrench',     50, 8),
  ('history_master', 'Тарих шебері',    'Мастер истории',    'Қазақстан тарихының барлық тақырыбын аяқтадыңыз', 'Вы прошли все темы по истории Казахстана', 'landmark', 100, 9),
  ('mock_100',       '100+ балл',       '100+ баллов',       'Сынақ ҰБТ-дан 100-ден астам балл жинадыңыз', 'Набрали больше 100 баллов на пробном ЕНТ', 'trophy', 100, 10),
  ('league_promoted','Жоғары лигаға',   'Повышение',         'Келесі лигаға көтерілдіңіз',            'Вы поднялись в следующую лигу',         'trending-up', 30, 11);

-- ---------------------------------------------------------------------
-- Storage: сұрақ суреттері. Жабық бакет — суреттерді сервер қысқа мерзімді signed URL арқылы береді.
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('question-images', 'question-images', false, 2097152, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do nothing;
-- storage.objects-ке оқушыларға саясат жоқ: жүктеу/оқу тек service_role арқылы.
