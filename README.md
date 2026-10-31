# GrantUp.kz — ҰБТ-ға дайындық платформасы

Next.js 15 (App Router) · TypeScript · Tailwind CSS v4 · shadcn/ui (Base UI) · Framer Motion · next-intl (қаз/орыс) · PWA.

## Іске қосу

```bash
npm install
cp .env.example .env.local   # 1-кезеңде кілттер міндетті емес
npm run dev                  # http://localhost:3000
```

Басқа командалар: `npm run build`, `npm run start`, `npm run lint`.

## Құрылым

```
messages/{kk,ru}.json        аудармалар (кілттер TypeScript-пен тексеріледі)
src/app/(app)/               оқушы беттері (AppShell: бүйір мәзір / төменгі панель)
src/app/(app)/styleguide     дизайн жүйесі беті (тек dev режимде)
src/app/manifest.ts          PWA манифесі
src/components/brand/        Logo, GradientCard, StatPill, ProgressRing, ContinueButton, EmptyState
src/components/layout/       AppShell, Sidebar, BottomNav, TopBar, тіл/тақырып ауыстырғыштар
src/components/motion/       FadeIn, XpBurst
src/components/ui/           shadcn/ui компоненттері
src/config/nav.ts            навигация пункттері
src/i18n/                    next-intl баптауы (тіл NEXT_LOCALE cookie-де)
src/lib/demo.ts              УАҚЫТША макет деректері (Supabase қосылғанда жойылады)
```

## Дизайн токендері

Барлық түстер `src/app/globals.css`-те: `brand-sky #0A84FF`, `brand #0047FF`, `brand-violet #7B3FF2`,
`success`, `danger`, `streak`, фон `#F5F8FF`; қараңғы режим `.dark` класында.
Утилиталар: `bg-brand-gradient`, `text-brand-gradient`, `shadow-soft`, `shadow-brand`.
Батырмалар: `variant="brand" | "white"`, `size="xl" | "2xl"`.

## Логотип

`public/logo.png` және `public/icons/*`, `src/app/icon.png`, `src/app/apple-icon.png` баннерден қиылып жасалған.
Өз файлыңызбен ауыстыру үшін сол аттармен (512×512 PNG) алмастырыңыз.

## Supabase баптау (2-кезеңнен бастап)

Кілттер қойылмаса, қосымша **демо режимде** ашылады: беттер макет деректерімен көрінеді, кіру/тіркелу жұмыс істемейді.

1. [supabase.com](https://supabase.com)-да жоба ашыңыз (аймақ: Frankfurt / eu-central-1).
2. **SQL Editor** → `supabase/migrations/` ішіндегі 5 файлды аты бойынша ретімен орындаңыз,
   содан кейін демо деректер үшін `supabase/seed.sql`-ды орындаңыз.
   (Немесе Supabase CLI: `npx supabase link --project-ref <id>` → `npx supabase db push`.)
3. **Authentication → Sign In / Providers → Email**: Email қосулы, **Confirm email** қосулы, құпиясөз ұзындығы ≥ 8.
4. **Authentication → URL Configuration**:
   - Site URL: `http://localhost:3000` (production: `https://grantup.kz`)
   - Redirect URLs: `http://localhost:3000/**`, `https://grantup.kz/**`
5. **Authentication → Email Templates** (сілтеме кез келген құрылғыда ашылуы үшін):
   - *Confirm signup*: `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email&next=/device`
   - *Reset password*: `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/reset-password`
6. **Project Settings → API Keys** → `.env.local`-ға: `NEXT_PUBLIC_SUPABASE_URL`, publishable (немесе anon) кілт, secret (немесе service_role) кілт.
7. Production-да Supabase-тің кіріктірілген поштасы сағатына бірнеше хатпен шектеледі — **Authentication → SMTP** арқылы Resend SMTP қосыңыз.

**Админ:** `bekzatshemetaev24@gmail.com` осы email-мен тіркелгенде автоматты түрде `admin` рөлін алады
(`supabase/migrations/20261101000200_admin_bootstrap.sql`). Админ панель: `/admin`.

## Қолжетімділік және құрылғылар — қалай жұмыс істейді

- **Freemium:** толық доступ тек админ берген, мерзімі жүріп тұрған грант болса (`access_grants`). Мерзім біткенде
  оқушы автоматты түрде тегін нұсқаға қайтады. Тіркелмеген email-ге берілген доступ тіркелгенде өзі қосылады.
  Тексеру: серверде `getAccess()`, дерекқорда `has_full_access()` (3-кезеңнен бастап контент RLS-інде).
- **Құрылғылар:** бір аккаунт — ең көбі 2 белсенді құрылғы (админдерге шектеу жоқ). Құрылғы = localStorage ID + браузер
  фингерпринті. 3-ші құрылғыдан кіргенде сұраныс `/admin/devices`-ке түседі (+ `ADMIN_NOTIFY_EMAIL`-ге хат).
  Админ рұқсат бергенде 6 таңбалы код **сол сәтте бір рет** көрсетіледі (дерекқорда тек хэші), админ оны оқушыға өзі
  жеткізеді. Код 24 сағат жарамды, 5 қате әрекеттен кейін бұғатталады.
- **Қорғау қабаттары:** middleware (кіру + қолтаңбалы құрылғы cookie-і, 10 минут сайын дерекқордан қайта тексеріледі) →
  server action ішінде `requireUser()` / `requireAdmin()` → Postgres RLS.
- **Күдікті кіру:** 1 сағат ішінде басқа қаладан/IP-ден кіру `security_events`-ке `suspicious_login` болып жазылады.

### Құрылғы шегін тексеру
1. Аккаунтпен 2 түрлі браузерде кіріңіз (мысалы, Chrome және Safari).
2. Үшінші браузерде (немесе инкогнитода) кіріңіз → «Жаңа құрылғыны растау» экраны шығады.
3. Админ аккаунтымен `/admin/devices` → ескі құрылғыны таңдап, «Рұқсат беру» → код шығады.
4. Кодты үшінші браузерге енгізіңіз → кіресіз; таңдалған ескі құрылғы 10 минут ішінде ажыратылады.

## Деректер базасы (3-кезең)

| Топ | Кестелер |
| --- | --- |
| Пайдаланушы | `profiles`, `access_grants`, `devices`, `device_requests`, `notifications_settings`, `push_subscriptions` |
| Контент | `subjects`, `topics`, `lessons`, `lesson_contents`, `lesson_videos`, `question_groups`, `questions`, `question_options`, `mock_exams`, `mock_exam_questions`, `specialties` |
| Оқу | `lesson_progress`, `attempts`, `attempt_answers`, `user_mistakes`, `study_plans` |
| Геймификация | `xp_events`, `achievements`, `user_achievements`, `leagues`, `league_groups`, `league_members` |
| AI | `ai_explanations` (кэш), `ai_usage` (күндік лимит) |
| Жүйе | `app_settings`, `security_events`, `audit_log`, `rate_limits`, `admin_emails` |

**Контентті қорғау (RLS):**
- Пән/тақырып/сабақ атаулары — кірген әр оқушыға (карта үшін). Конспект — тегін сабақта немесе толық доступта.
- Сұрақтар, жауап нұсқалары, дұрыс жауаптар, түсіндірмелер, видео ID — API арқылы **мүлдем оқылмайды**;
  оларды сервер доступты тексеріп, бір-бірлеп береді (anon кілт браузерде ашық, сондықтан бұл міндетті).
- Сынақ ҰБТ жүріп жатқанда жауаптардың дұрыс/бұрысы оқушыға көрінбейді.
- Лигада басқа оқушылардың тек лақап аты/аты мен аватары көрінеді (`league_standings()`), email емес.

**Админ өзгертетін конфиг** (`app_settings`): `unt_structure` (120 сұрақ / 140 балл / 240 мин, пәндер құрамы,
бірнеше жауапты сұрақтың балл ережесі), `diagnostic`, `ai_limits`, `league`, `xp`, `levels`.

**Демо деректер** (`seed.sql`): 5 пән, 12 тақырып, 13 сабақ (әр пәннің біреуі тегін), 34 сұрақ (оның ішінде
контекстік мәтін, бірнеше жауапты, KaTeX, Python коды), 1 сынақ ҰБТ (сұрақтары аз — демо), 5 мамандық.
⚠️ Мамандықтардың шекті балдары — **ойдан алынған демо мәндер**, ресми мәндермен ауыстырыңыз.
