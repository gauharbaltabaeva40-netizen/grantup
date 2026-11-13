import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BookOpen } from "lucide-react";
import { ContinueButton } from "@/components/brand/continue-button";
import { EmptyState } from "@/components/brand/empty-state";
import { GradientCard } from "@/components/brand/gradient-card";
import { Logo } from "@/components/brand/logo";
import { ProgressRing } from "@/components/brand/progress-ring";
import { StatPill } from "@/components/brand/stat-pill";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Markdown } from "@/components/content/markdown";
import { LessonPath } from "@/components/lessons/lesson-path";
import type { CatalogSubject } from "@/lib/content/catalog";
import { BarList, TopicHeatmap } from "@/components/mock/charts";
import { HistoryChart } from "@/components/mock/history-chart";
import { OnboardingFlow } from "@/components/onboarding/onboarding-flow";
import { Protected } from "@/components/protection/protection";
import { MotionDemo } from "./motion-demo";
import { ProctorDemo } from "./proctor-demo";
import { QuizDemo } from "./quiz-demo";

// Дизайн жүйесінің беті — тек әзірлеу кезінде (production-да 404).
export const metadata: Metadata = { title: "Styleguide", robots: { index: false } };

const demoSubject: CatalogSubject = {
  id: 4,
  code: "math",
  title: "Математика",
  kind: "profile",
  icon: "sigma",
  color: "#0047FF",
  totalLessons: 6,
  completedLessons: 2,
  currentLessonId: "l3",
  topics: [
    {
      id: "t1",
      title: "Теңдеулер",
      lessons: [
        { id: "l1", title: "Сызықтық теңдеулер", isFree: true, status: "completed", durationSeconds: 600, xpReward: 20, topicId: "t1" },
        { id: "l2", title: "Квадрат теңдеулер", isFree: false, status: "completed", durationSeconds: 600, xpReward: 20, topicId: "t1" },
        { id: "l3", title: "Виет теоремасы", isFree: false, status: "current", durationSeconds: 600, xpReward: 20, topicId: "t1" },
        { id: "l4", title: "Теңсіздіктер", isFree: false, status: "available", durationSeconds: 600, xpReward: 20, topicId: "t1" },
      ],
    },
    {
      id: "t2",
      title: "Логарифмдер",
      lessons: [
        { id: "l5", title: "Логарифм анықтамасы", isFree: false, status: "locked", durationSeconds: 600, xpReward: 20, topicId: "t2" },
        { id: "l6", title: "Логарифм қасиеттері", isFree: false, status: "locked", durationSeconds: 600, xpReward: 20, topicId: "t2" },
      ],
    },
  ],
};

const demoMarkdown = `## Квадрат теңдеу

$$ax^2 + bx + c = 0, \\quad a \\ne 0$$

- Дискриминант: $D = b^2 - 4ac$
- Түбірлері: $x_{1,2} = \\dfrac{-b \\pm \\sqrt{D}}{2a}$

> Есте сақта: $D < 0$ болса, нақты түбір жоқ.

| $x$ | $\\sin x$ | $\\cos x$ |
| --- | --- | --- |
| $30^\\circ$ | $\\frac{1}{2}$ | $\\frac{\\sqrt{3}}{2}$ |`;

const swatches = [
  { name: "brand-sky", className: "bg-brand-sky", hex: "#3A5BB8" },
  { name: "brand / primary", className: "bg-brand", hex: "#1D3A8A" },
  { name: "brand-violet", className: "bg-brand-violet", hex: "#D9482B" },
  { name: "success", className: "bg-success", hex: "#2F9E5F" },
  { name: "danger", className: "bg-danger", hex: "#C02626" },
  { name: "streak", className: "bg-streak", hex: "#E0861A" },
  { name: "background", className: "bg-background ring-1 ring-border", hex: "#FBF8F1" },
  { name: "gradient", className: "bg-brand-gradient", hex: "140°" },
];

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-sm font-bold tracking-wide text-muted-foreground uppercase">{title}</h2>
      {children}
    </section>
  );
}

export default function StyleguidePage() {
  if (process.env.NODE_ENV === "production") notFound();

  return (
    <div className="space-y-10">
      <PageHeader title="Дизайн жүйесі" description="GrantUp түстері, шрифті және базалық компоненттері." />

      <Section title="Логотип">
        <div className="flex flex-wrap items-center gap-6">
          <Logo size={48} />
          <Logo size={36} showText={false} />
        </div>
      </Section>

      <Section title="Түстер">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {swatches.map((s) => (
            <div key={s.name} className="rounded-2xl bg-card p-2 shadow-soft">
              <div className={`h-14 rounded-xl ${s.className}`} />
              <p className="mt-2 px-1 text-sm font-semibold">{s.name}</p>
              <p className="px-1 text-xs text-muted-foreground">{s.hex}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Типографика (Manrope)">
        <div className="space-y-2 rounded-2xl bg-card p-5 shadow-soft">
          <p className="text-3xl font-extrabold tracking-tight">Ұлттық бірыңғай тестілеу</p>
          <p className="text-xl font-bold">Әә Ғғ Ққ Ңң Өө Ұұ Үү Һһ Іі</p>
          <p className="text-base">Оқушыға жылы, қарапайым тілмен: «Бүгін грантқа тағы бір қадам жақындаймыз».</p>
          <p className="text-base">Русский текст: Подготовка к ЕНТ — понятно и удобно.</p>
          <p className="text-sm text-muted-foreground">0123456789 · 140 балл · 240 минут</p>
        </div>
      </Section>

      <Section title="Батырмалар">
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="brand" size="2xl">Жалғастыру</Button>
          <Button size="xl">Primary</Button>
          <Button size="xl" variant="secondary">Secondary</Button>
          <Button size="xl" variant="outline">Outline</Button>
          <Button size="xl" variant="ghost">Ghost</Button>
          <Button size="xl" variant="destructive">Қате</Button>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge>Жаңа</Badge>
          <Badge variant="secondary">Тегін</Badge>
          <Badge variant="outline">Математика</Badge>
        </div>
      </Section>

      <Section title="Карталар">
        <div className="grid gap-4 md:grid-cols-2">
          <GradientCard>
            <p className="text-sm font-semibold text-white/80">Бүгінгі жоспар</p>
            <p className="mt-1 text-2xl font-extrabold">2 сабақ + 15 сұрақ</p>
            <ContinueButton href="/" tone="white" className="mt-5">Жалғастыру</ContinueButton>
          </GradientCard>
          <Card className="rounded-2xl shadow-soft ring-0">
            <CardHeader>
              <CardTitle className="text-base font-bold">Қарапайым карта</CardTitle>
              <CardDescription>rounded-2xl + жұмсақ көлеңке</CardDescription>
            </CardHeader>
            <CardContent className="flex items-center gap-4">
              <ProgressRing value={96} max={140} size={88}>
                <span className="text-lg font-extrabold">96</span>
              </ProgressRing>
              <div className="flex flex-wrap gap-2">
                <StatPill variant="streak" value={7} label="Streak" />
                <StatPill variant="xp" value={1250} label="XP" />
                <StatPill variant="level" value={5} label="Деңгей" />
              </div>
            </CardContent>
          </Card>
        </div>
      </Section>

      <Section title="Конспект (Markdown + KaTeX)">
        <div className="rounded-2xl bg-card p-5 shadow-soft">
          <Markdown>{demoMarkdown}</Markdown>
        </div>
      </Section>

      <Section title="Сабақтар картасы">
        <div className="mx-auto max-w-md">
          <LessonPath subject={demoSubject} />
        </div>
      </Section>

      <Section title="Сынақ нәтижесі графиктері">
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-2xl bg-card p-5 shadow-soft">
            <BarList
              ariaLabel="Пәндер бойынша"
              max={1}
              rows={[
                { key: "h", label: "Қазақстан тарихы", value: 14, max: 20, hint: "14/20 дұрыс" },
                { key: "r", label: "Оқу сауаттылығы", value: 8, max: 10 },
                { key: "ml", label: "Математикалық сауаттылық", value: 6, max: 10 },
                { key: "m", label: "Математика", value: 31, max: 50 },
                { key: "i", label: "Информатика", value: 38, max: 50 },
              ]}
              formatValue={(r) => `${r.value} / ${r.max}`}
            />
          </div>
          <div className="rounded-2xl bg-card p-5 shadow-soft">
            <HistoryChart
              ariaLabel="Балл динамикасы"
              yMax={140}
              points={[
                { attemptId: "a", finishedAt: "2026-09-10", score: 78, maxScore: 140, current: false },
                { attemptId: "b", finishedAt: "2026-09-24", score: 86, maxScore: 140, current: false },
                { attemptId: "c", finishedAt: "2026-10-08", score: 84, maxScore: 140, current: false },
                { attemptId: "d", finishedAt: "2026-10-22", score: 97, maxScore: 140, current: true },
              ]}
            />
          </div>
        </div>
        <div className="rounded-2xl bg-card p-5 shadow-soft">
          <TopicHeatmap
            legendLow="0%"
            legendHigh="100%"
            groups={[
              {
                title: "Математика",
                topics: [
                  { id: "1", title: "Теңдеулер", percent: 90, correct: 9, total: 10 },
                  { id: "2", title: "Функциялар және логарифмдер", percent: 55, correct: 6, total: 11 },
                  { id: "3", title: "Тригонометрия", percent: 25, correct: 2, total: 8 },
                ],
              },
              {
                title: "Информатика",
                topics: [
                  { id: "4", title: "Санау жүйелері", percent: 70, correct: 7, total: 10 },
                  { id: "5", title: "Алгоритмдер және Python", percent: 40, correct: 4, total: 10 },
                ],
              },
            ]}
          />
        </div>
      </Section>

      <Section title="Контентті қорғау">
        <Protected>
          <div className="rounded-2xl bg-card p-5 shadow-soft">
            <p className="font-bold">Қорғалған мәтін (таңдау, көшіру, оң жақ мәзір өшірулі)</p>
            <p className="mt-2 text-[15px] text-muted-foreground">
              Ctrl/Cmd+P, Ctrl/Cmd+S, Cmd+Shift+4 немесе PrintScreen басып көріңіз — экран бұлыңғырланады. Басқа терезеге ауысқанда да мазмұн жасырылады.
            </p>
            <input className="mt-3 h-10 w-full rounded-lg border px-3" placeholder="Бұл өрісте мәтін енгізуге болады" />
          </div>
        </Protected>
      </Section>

      <Section title="Онбординг">
        <div className="mx-auto max-w-xl rounded-3xl border border-dashed p-4">
          <OnboardingFlow
            initialTarget={null}
            diagnosticCount={20}
            diagnosticMinutes={20}
            specialties={[
              { id: "00000000-0000-4000-8000-000000000001", code: "B057", name: "Ақпараттық технологиялар", threshold: 110 },
              { id: "00000000-0000-4000-8000-000000000002", code: "B058", name: "Ақпараттық қауіпсіздік", threshold: 115 },
            ]}
          />
        </div>
      </Section>

      <Section title="Тест сұрағы">
        <QuizDemo />
      </Section>

      <Section title="Прокторинг: камера тексеру">
        <ProctorDemo />
      </Section>

      <Section title="Анимациялар">
        <MotionDemo />
      </Section>

      <Section title="Бос және жүктелу күйлері">
        <EmptyState icon={BookOpen} title="Әзірге бос" description="Мұнда мазмұн пайда болады." />
        <div className="space-y-2">
          <Skeleton className="h-6 w-1/2 rounded-lg" />
          <Skeleton className="h-24 w-full rounded-2xl" />
        </div>
      </Section>
    </div>
  );
}
