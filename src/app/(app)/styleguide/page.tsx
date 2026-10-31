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
import { MotionDemo } from "./motion-demo";

// Дизайн жүйесінің беті — тек әзірлеу кезінде (production-да 404).
export const metadata: Metadata = { title: "Styleguide", robots: { index: false } };

const swatches = [
  { name: "brand-sky", className: "bg-brand-sky", hex: "#0A84FF" },
  { name: "brand / primary", className: "bg-brand", hex: "#0047FF" },
  { name: "brand-violet", className: "bg-brand-violet", hex: "#7B3FF2" },
  { name: "success", className: "bg-success", hex: "#22C55E" },
  { name: "danger", className: "bg-danger", hex: "#EF4444" },
  { name: "streak", className: "bg-streak", hex: "#F59E0B" },
  { name: "background", className: "bg-background ring-1 ring-border", hex: "#F5F8FF" },
  { name: "gradient", className: "bg-brand-gradient", hex: "135°" },
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
