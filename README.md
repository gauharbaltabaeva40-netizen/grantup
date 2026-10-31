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
