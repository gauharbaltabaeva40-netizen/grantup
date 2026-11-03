# GrantUp.kz — ҰБТ-ға дайындық платформасы

Next.js 15 (App Router) · TypeScript · Tailwind CSS v4 · shadcn/ui (Base UI) · Supabase (Postgres, Auth, Storage) ·
Claude API (AI-тьютор) · next-intl (қаз/орыс) · PWA + Web Push · Vercel.

**Қазір жұмыс істеп тұр:** https://grantup-alpha.vercel.app (Vercel, `fra1`) + Supabase `grantup-db` (Frankfurt, Free).

---

## Мазмұны

1. [Жергілікті іске қосу](#1-жергілікті-іске-қосу)
2. [Командалар және тесттер](#2-командалар-және-тесттер)
3. [Орта айнымалылары](#3-орта-айнымалылары)
4. [Деплой: нөлден production-ға](#4-деплой-нөлден-production-ға)
5. [Деплойдан кейінгі тексеру тізімі](#5-деплойдан-кейінгі-тексеру-тізімі)
6. [Күнделікті жұмыс (админ)](#6-күнделікті-жұмыс-админ)
7. [Техникалық қызмет көрсету](#7-техникалық-қызмет-көрсету)
8. [Архитектура және қауіпсіздік](#8-архитектура-және-қауіпсіздік)
9. [Белгілі шектеулер](#9-белгілі-шектеулер)
10. [Құрылым](#10-құрылым)

---

## 1. Жергілікті іске қосу

Керек: Node.js 20+ (тексерілген: 24), npm.

```bash
npm install
cp .env.example .env.local
npm run dev            # http://localhost:3000
```

- **Кілтсіз (демо режим):** `.env.local` бос болса, беттер макет деректерімен ашылады, кіру/тіркелу жұмыс істемейді.
  Админ-панель тек `npm run dev`-те бос деректермен көрінеді (production-да кілтсіз — 404).
- **Нақты дерекқормен:** Supabase кілттерін қойыңыз (3-бөлім). Production кілттерін Vercel-ден тартып алуға болады:
  `npx vercel env pull .env.vercel --environment=development` → керек мәндерді `.env.local`-ға көшіріңіз.
  ⚠️ `vercel env pull .env.local` бар файлды **үстінен жазады** (APP_SECRET, VAPID жоғалады).

## 2. Командалар және тесттер

| Команда | Не істейді |
| --- | --- |
| `npm run dev` | Әзірлеу сервері (Turbopack) |
| `npm run build` / `npm run start` | Production жинағы және оны іске қосу |
| `npm run lint` | ESLint |
| `npm test` | Барлық тест: unit + дерекқор |
| `npm run test:unit` | Таза логика: ҰБТ бағалау, деңгей/streak, грант болжамы, құрылғы cookie-і, импорт, сынақ құрастыру, баптаулар, CSV |
| `npm run test:db` | Барлық миграция + `seed.sql` кірістірілген Postgres-те (PGlite): RLS, триггерлер, XP/streak/лига, лимиттер, админ функциялары — **90 тексеріс**, Supabase керек емес |

Жаңа миграция жазсаңыз — `npm run test:db` міндетті түрде өтуі керек.

## 3. Орта айнымалылары

`NEXT_PUBLIC_` бар айнымалылар браузерге түседі, қалғандары **тек серверде**. Құпияларды ешқашан чатқа/git-ке жазбаңыз.

| Айнымалы | Міндетті | Қайда қолданылады | Қалай алу |
| --- | --- | --- | --- |
| `NEXT_PUBLIC_SITE_URL` | иә | email сілтемелері, редиректтер | `https://grantup.kz` (домен қосылғанша — Vercel адресі) |
| `APP_SECRET` | иә | құрылғы cookie қолтаңбасы, кодтар хэші | `openssl rand -base64 48` (≥ 32 таңба). Өзгертсе — барлық құрылғы қайта тексеріледі |
| `NEXT_PUBLIC_SUPABASE_URL` | иә | Supabase | Project Settings → API |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (немесе `…_ANON_KEY`) | иә | браузер/сервер, RLS-пен | Project Settings → API Keys |
| `SUPABASE_SECRET_KEY` (немесе `SUPABASE_SERVICE_ROLE_KEY`) | иә | тек сервер, RLS-ті айналып өтеді | Project Settings → API Keys |
| `ANTHROPIC_API_KEY` | AI үшін | түсіндіру, жеке жоспар | console.anthropic.com → API Keys. Жоқ болса — AI батырмалары қатесіз өшеді, жоспар ережелермен құрылады |
| `RESEND_API_KEY`, `EMAIL_FROM` | email үшін | апталық есеп, доступ мерзімі, админге хабарлама | resend.com (расталған домен керек) |
| `ADMIN_NOTIFY_EMAIL` | жоқ | 3-ші құрылғы сұранысы туралы хат | админ email-і |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | push үшін | Web Push | `npx web-push generate-vapid-keys` |
| `CRON_SECRET` | иә (prod) | `/api/cron/*` қорғауы | `openssl rand -hex 32`. Vercel Cron оны `Authorization: Bearer` етіп жібереді |

Vercel-дегі қазіргі күй: Supabase айнымалыларын Marketplace интеграциясы өзі қосқан; `APP_SECRET`, `CRON_SECRET`,
VAPID, `NEXT_PUBLIC_SITE_URL`, `ADMIN_NOTIFY_EMAIL` қолмен қосылған. **Әлі жоқ:** `ANTHROPIC_API_KEY`, `RESEND_API_KEY`.

Айнымалыны қосу/өзгерту: Vercel → grantup → Settings → Environment Variables (немесе `npx vercel env add NAME production`),
содан кейін **Redeploy** (жаңа мән тек жаңа деплойда күшіне енеді).

## 4. Деплой: нөлден production-ға

### 4.1 Supabase

1. Жоба ашыңыз — аймақ **Frankfurt** (Қазақстанға жақын). Ең оңай жол — Vercel Marketplace:
   `npx vercel integration add supabase --billing-plan free --meta region=fra1` (кілттер Vercel-ге өзі қосылады).
   Немесе supabase.com-да қолмен ашып, кілттерді 3-бөлімдегідей қойыңыз.
2. **Миграциялар** — `supabase/migrations/` ішіндегі файлдарды **аты бойынша ретімен**, содан кейін бір рет `supabase/seed.sql`
   (демо контент). Тәсілдер:
   - SQL Editor-ге әр файлды кезекпен қойып, Run;
   - немесе Supabase CLI: `npx supabase link --project-ref <ref>` → `npx supabase db push`.
3. **Authentication → URL Configuration:**
   Site URL — `NEXT_PUBLIC_SITE_URL`; Redirect URLs — `https://<сайт>/**` және `http://localhost:3000/**`.
4. **Authentication → Sign In / Providers:** Email қосулы, құпиясөз ≥ 8 таңба. *Confirm email* — 4.4-ті қараңыз.
5. **Админ:** `bekzatshemetaev24@gmail.com` осы email-мен тіркелгенде автоматты түрде `admin` болады
   (`20261101000200_admin_bootstrap.sql`). Басқа админ қосу: SQL Editor →
   `insert into public.admin_emails (email) values ('new@admin.kz');` (тіркелмей тұрып) немесе
   `update public.profiles set role = 'admin' where email = '…';`.

### 4.2 Vercel

1. GitHub репозиторийін Vercel-ге импорттаңыз (Framework: Next.js, қалғаны әдепкі).
2. Орта айнымалыларын қойыңыз (3-бөлім).
3. `vercel.json`: функциялар аймағы `fra1` (дерекқорға жақын), cron-дар:
   - `/api/cron/daily` — күн сайын 15:00 UTC (Алматы 20:00): streak еске салу, доступ мерзімі, апталық есеп;
   - `/api/cron/league-weekly` — жексенбі 19:00 UTC (дүйсенбі 00:00 Алматы): лига аптасын жабу.
4. `main` тармағына push → автоматты деплой.

### 4.3 Өз доменіңіз (grantup.kz)

1. Доменді сатып алыңыз (мысалы, ps.kz, hoster.kz).
2. Vercel → grantup → Settings → Domains → `grantup.kz` және `www.grantup.kz` қосыңыз; Vercel көрсеткен DNS жазбаларын
   (A / CNAME) домен панеліне енгізіңіз.
3. `NEXT_PUBLIC_SITE_URL=https://grantup.kz` етіп өзгертіп, Redeploy.
4. Supabase → URL Configuration: Site URL мен Redirect URLs-ке жаңа доменді қосыңыз.

### 4.4 Пошта (email растау, құпиясөзді қалпына келтіру)

**Қазіргі күй (2026-11):** SMTP әлі бапталмағандықтан Supabase-те *Confirm email* **өшірулі** — оқушы тіркелгенде
бірден кіреді (код бұл жағдайды да, растау қосулы жағдайды да қолдайды). «Құпиясөзді ұмыттым» хаты әзірге **жетпейді**.
Supabase-тің SMTP бетінде бұрын енгізілген қате мәндер қалған — пошта дайын болғанда оларды міндетті түрде ауыстырыңыз.

Нұсқалар:
- **Resend (ұсынылады, домен керек):** resend.com → доменді растау (DNS: SPF, DKIM) → API key →
  Supabase → Authentication → Emails → SMTP Settings: host `smtp.resend.com`, port `465`, user `resend`,
  password = API key, sender `noreply@grantup.kz`. Сол кілтті Vercel-ге `RESEND_API_KEY` етіп те қойыңыз.
- **Gmail (доменсіз, уақытша):** бөлек Gmail → 2-Step Verification → App Password (16 әріп) →
  SMTP: host `smtp.gmail.com`, port `465`, user және sender = толық Gmail адресі, password = App Password.

SMTP қосылған соң:
1. Authentication → Emails → Templates:
   - *Confirm sign up*: сілтеме `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email&next=/device`
   - *Reset password*: сілтеме `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/reset-password`
   (осылай сілтеме кез келген құрылғыда ашылады; әдепкі шаблон тек тіркелген браузерде жұмыс істейді).
2. Sign In / Providers → **Confirm email** қайта қосыңыз.
3. Тексеру: жаңа email-мен тіркеліп, хаттағы сілтемені телефоннан ашыңыз.

### 4.5 AI-тьютор және push

- `ANTHROPIC_API_KEY` қойып, Redeploy. Модель мен күндік лимиттер — Админ → Баптаулар → `ai_limits`.
  Түсіндірмелер кэштеледі (бір сұрақ+жауап+тіл үшін бір рет төленеді).
- Push VAPID кілттерімен бірден жұмыс істейді; iPhone-да тек сайт «Басты экранға қосылғанда» (PWA) жұмыс істейді.

## 5. Деплойдан кейінгі тексеру тізімі

- [ ] `/login`, `/signup` ашылады; кірмеген адам `/`-ден `/login`-ге жіберіледі
- [ ] Тіркелу → `/device` → басты бет (админ үшін онбордингсіз, оқушы үшін онбординг + диагностика)
- [ ] `/admin` тек админге ашылады; оқушыға — 404
- [ ] Үшінші браузерден кіру → құрылғы сұранысы `/admin/devices`-те шығады → код → кіру
- [ ] Админ → Доступ: оқушыға доступ беру → оқушыда ақылы сабақтар ашылады
- [ ] Тегін сабақ: видео, конспект, тест; ақылы сабақ доступсыз — құлып
- [ ] Сынақ ҰБТ: камера тексеру → бастау → бет жаңарту (жауаптар сақталады) → аяқтау → нәтиже және талдау
- [ ] Админ → Прокторинг: сол сынақтың фотолары мен оқиғалары көрінеді
- [ ] Profile → push қосу (компьютерде Chrome)
- [ ] Vercel → Settings → Cron Jobs: екі cron көрінеді

## 6. Күнделікті жұмыс (админ)

Админ-панель: `/admin` (интерфейсі қазақша).

| Бөлім | Не істейді |
| --- | --- |
| Шолу | оқушылар, белсенділік, сынақтардың орташа балы, ең қиын сұрақтар |
| Оқушылар | іздеу, прогресс, құрылғылар, қауіпсіздік оқиғалары, доступ |
| Доступ | email бойынша жеке немесе CSV арқылы көп оқушыға (`email, басталуы, аяқталуы, ескертпе`) |
| Құрылғы сұраныстары | рұқсат беру (бір реттік код) / бас тарту |
| Контент | пән → тақырып → сабақ; рет; YouTube (Unlisted видео); конспект (Markdown + формула) |
| Сұрақтар | редактор, сурет, контекстік мәтіндер, **Excel/CSV импорт** (үлгіні сол беттен жүктеңіз, 500 жолға дейін) |
| Сынақ ҰБТ | құрылым бойынша автоматты құрастыру → тексеру → жариялау |
| Прокторинг | сынақтар бойынша бұзушылықтар саны, фотолар, оқиғалар журналы |
| Баптаулар | ҰБТ құрылымы, XP, деңгейлер, лига, AI лимиттері; мамандықтардың шекті балдары |
| Журнал | қауіпсіздік оқиғалары және барлық админ әрекеттері |

**Іске қосар алдында:**
1. Демо контентті нақтымен ауыстырыңыз (seed-тегі сабақтар/сұрақтар — үлгі ғана).
2. Мамандықтардың шекті балдарын **ресми мәндермен** ауыстырыңыз (seed-тегілер ойдан алынған).
3. Әр тілге кемінде бір толық сынақ ҰБТ варианты (120 сұрақ) құрастырып, жариялаңыз.

Оқушы қолданған жазбалар (сабақ, сұрақ, вариант, мамандық) өшірілмейді — жасырыңыз/белсенді емес етіңіз.

## 7. Техникалық қызмет көрсету

- **Жаңа миграция:** `supabase/migrations/`-ке келесі нөмірмен файл (`20261101001100_…sql`) → `npm run test:db` →
  production-да SQL Editor-де немесе `npx supabase db push` арқылы орындаңыз → кодты push.
  Типтер: `src/lib/supabase/types.ts` (қолмен; немесе `npx supabase gen types typescript --project-id <id>`).
- **Логтар:** Vercel → grantup → Logs (Hobby жоспарында ~1 сағат сақталады); қауіпсіздік — Админ → Журнал.
- **Резервтік көшірме:** Free жоспарда автоматты backup жоқ. Кемінде аптасына бір рет:
  Supabase → Database → Backups (Pro) немесе `pg_dump "$POSTGRES_URL_NON_POOLING" > backup.sql`.
- **Кілтті ауыстыру:** Vercel-де мәнді өзгерту → Redeploy. `APP_SECRET` өзгерсе — барлық оқушы құрылғысын қайта
  растайды (сұраныссыз, автоматты; тек cookie жаңарады). Supabase secret key-ді Supabase-те ауыстырып, Vercel-ге қойыңыз.
- **Тәуелділіктер:** айына бір рет `npm outdated`; жаңартқаннан кейін `npm run lint && npm test && npm run build`.

## 8. Архитектура және қауіпсіздік

- **Қорғау қабаттары:** middleware (кіру + қолтаңбалы құрылғы cookie-і, 10 минут сайын дерекқордан қайта тексеріледі) →
  әр server action ішінде `requireUser()` / `requireAdmin()` → Postgres RLS. Барлық кестеде RLS қосулы.
- **Freemium:** толық доступ тек админ берген, мерзімі жүріп тұрған грант болса (`access_grants`); мерзім біткенде —
  автоматты түрде тегін. Тіркелмеген email-ге берілген доступ тіркелгенде өзі қосылады.
- **Құрылғылар:** аккаунтқа ең көбі 2 белсенді құрылғы (админге шексіз). 3-ші құрылғы → админге сұраныс →
  6 таңбалы бір реттік код (дерекқорда тек хэші, 24 сағат, 5 қате әрекет).
- **Контент:** сұрақтар, дұрыс жауаптар, видео ID API арқылы мүлдем оқылмайды — сервер доступты тексеріп береді.
  Сынақ кезінде дұрыс/бұрысы көрсетілмейді. Лигада басқа оқушылардың тек аты/аватары көрінеді.
- **Контентті қорғау:** әлсіз су таңбасы (GrantUp.kz логотипі, орны ауысып тұрады), көшіру/оң жақ мәзір өшірулі,
  скриншот/басып шығару пернелерінде экран жабылады және журналға жазылады, басқа терезеге ауысқанда бұлыңғырланады.
  Nonce-пен қатаң CSP.
- **Сынақ ҰБТ прокторингі (камера):** бастамас бұрын келісім + камера тексеру (бет көрінуі керек). Сынақ кезінде бет
  браузердің өзінде анықталады (MediaPipe, видео серверге жіберілмейді); серверге тек келісім фотосы, 3 минут сайынғы
  фото, бұзушылық сәтіндегі фото (бет жоқ ≥ 5 с, бірнеше адам ≥ 3 с) және оқиғалар (басқа бетке ауысу, камера өшті)
  жазылады. Бұзушылық **тек тіркеледі** — сынақ тоқтатылмайды. Админ → Прокторинг: әр сынақтың фотолары мен журналы.
  Фотолар жабық `proctoring` бакетінде, 30 күннен кейін күнделікті cron өшіреді. MediaPipe WASM файлдары
  `npm install` кезінде `public/mediapipe/`-ге көшіріледі (`scripts/copy-mediapipe.mjs`), модель — `public/models/`.
- **Күдікті кіру:** 1 сағат ішінде басқа қаладан кіру `security_events`-ке жазылады.
- **Rate limit:** тіркелу, кіру, құрылғы, AI сұраныстары (дерекқордағы атомарлы есептегіштер).

**Дерекқор кестелері:**

| Топ | Кестелер |
| --- | --- |
| Пайдаланушы | `profiles`, `access_grants`, `devices`, `device_requests`, `notifications_settings`, `push_subscriptions` |
| Контент | `subjects`, `topics`, `lessons`, `lesson_contents`, `lesson_videos`, `question_groups`, `questions`, `question_options`, `mock_exams`, `mock_exam_questions`, `specialties` |
| Оқу | `lesson_progress`, `attempts`, `attempt_answers`, `user_mistakes`, `study_plans` |
| Геймификация | `xp_events`, `achievements`, `user_achievements`, `leagues`, `league_groups`, `league_members` |
| AI | `ai_explanations` (кэш), `ai_usage` (күндік лимит) |
| Жүйе | `app_settings`, `security_events`, `audit_log`, `rate_limits`, `admin_emails`, `notification_log`, `proctoring_events` |

**Өнімділік (Lighthouse, телефон, 2026-11):** өнімділік 90–94, қолжетімділік / best practices / SEO — 100
(ақ және қараңғы тақырыпта, негізгі 9 бет).

## 9. Белгілі шектеулер

- **Скриншот пен экран жазуды веб-сайтта бұғаттау мүмкін емес** — браузерлер мұндай мүмкіндік бермейді (тек мобильді
  қосымшада: Android-та толық, iPhone-да тек жазуды анықтау). Мақсат — таратуды қиындату және авторлықты көрсету.
- **Прокторинг** алдауды толық болдырмайды (мысалы, камерадан тыс екінші құрылғы), бірақ тіркеп, тежейді. Бірінші
  сынақта ~13 МБ бет анықтау файлы жүктеледі (кейін кэште). Оқушылардың көбі кәмелетке толмаған — фотоларды тек
  тексеру үшін қолданыңыз, 30 күннен ұзақ сақтамаңыз.
- **Supabase Free:** 7 күн белсенділік болмаса жоба «ұйықтайды» (Supabase панелінен бір батырмамен оятылады);
  500 МБ дерекқор, 1 ГБ файл. Нақты оқушылар көбейгенде Pro ($25/ай) ұсынылады.
- **Vercel Hobby:** коммерциялық жобаға ресми түрде Pro керек; cron күніне бір реттен жиі емес.
- **Email:** 4.4-ті қараңыз — SMTP бапталмайынша растау өшірулі және құпиясөзді қалпына келтіру хаты жетпейді.
- **YouTube:** видео «Unlisted» болуы керек; YouTube ID-ін техникалық тұрғыда толық жасыру мүмкін емес
  (ойнатқыш браузерде жүктеледі), бірақ ол API арқылы берілмейді және сілтемелер жабық.

## 10. Құрылым

```
supabase/migrations/          дерекқор схемасы, RLS, SQL функциялары (ретімен)
supabase/seed.sql             демо контент
tests/unit/                   таза логика тесттері (node:test)
tests/sql/database.mjs        дерекқор тесттері (PGlite)
messages/{kk,ru}.json         аудармалар
src/app/(app)/                оқушы беттері: басты, сабақтар, жаттығу, сынақ, жоспар, лига, профиль
src/app/(auth)/               кіру, тіркелу, құрылғы
src/app/(exam)/               сынақ ҰБТ тапсыру беті (толық экран)
src/app/(onboarding)/         онбординг + диагностика
src/app/admin/                админ-панель
src/app/api/                  AI түсіндіру (стрим), cron
src/components/               UI (brand, layout, quiz, mock, admin, protection …)
src/lib/                      сервер логикасы (auth, device, quiz, mock, ai, plan, gamification, notify, admin …)
src/middleware.ts             сессия, кіру, құрылғы, CSP
vercel.json                   аймақ (fra1) және cron
```

Дизайн токендері — `src/app/globals.css` (`brand #0047FF`, `brand-violet #7B3FF2`, `success`, `danger`, `streak`;
қараңғы режим — `.dark`). Логотип — `public/logo.png`, `public/icons/*`, `src/app/icon.png`.
