"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Award, Flame, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { markCelebrated } from "@/lib/gamification/actions";
import type { Celebrations as CelebrationData } from "@/lib/gamification/data";

type Step =
  | { kind: "level"; level: number; name: string }
  | { kind: "streak"; count: number }
  | { kind: "achievement"; title: string; description: string; xp: number };

async function fireConfetti() {
  const confetti = (await import("canvas-confetti")).default;
  const colors = ["#0A84FF", "#0047FF", "#7B3FF2", "#22C55E", "#F59E0B"];
  confetti({ particleCount: 120, spread: 80, origin: { y: 0.6 }, colors, disableForReducedMotion: true });
  setTimeout(() => confetti({ particleCount: 60, angle: 60, spread: 60, origin: { x: 0 }, colors, disableForReducedMotion: true }), 200);
  setTimeout(() => confetti({ particleCount: 60, angle: 120, spread: 60, origin: { x: 1 }, colors, disableForReducedMotion: true }), 300);
}

/** Деңгей көтерілгенде — конфетти, серия ұзарғанда — от анимациясы, жаңа жетістіктер — белгілер. */
export function Celebrations({ data }: { data: CelebrationData }) {
  const t = useTranslations("celebrate");
  const router = useRouter();
  const reduce = useReducedMotion();
  const [steps] = useState<Step[]>(() => [
    ...(data.levelUp ? [{ kind: "level" as const, ...data.levelUp }] : []),
    ...(data.streak ? [{ kind: "streak" as const, count: data.streak }] : []),
    ...data.achievements.map((a) => ({ kind: "achievement" as const, title: a.title, description: a.description, xp: a.xp })),
  ]);
  const [index, setIndex] = useState(0);
  const step = steps[index];

  useEffect(() => {
    if (step && step.kind !== "streak") void fireConfetti();
  }, [step]);

  const next = () => {
    if (index + 1 < steps.length) return setIndex(index + 1);
    setIndex(steps.length);
    void markCelebrated().then(() => router.refresh());
  };

  return (
    <AnimatePresence>
      {step && (
        <motion.div
          key="overlay"
          className="fixed inset-0 z-[80] grid place-items-center bg-background/70 p-4 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="celebration-title"
        >
          <motion.div
            key={index}
            className="w-full max-w-sm rounded-3xl bg-card p-7 text-center shadow-2xl"
            initial={reduce ? false : { scale: 0.85, y: 20, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            transition={{ type: "spring", stiffness: 260, damping: 20 }}
          >
            {step.kind === "streak" ? (
              <motion.div
                className="mx-auto mb-4 grid size-24 place-items-center rounded-full bg-streak/15"
                animate={reduce ? undefined : { scale: [1, 1.12, 1], rotate: [0, -4, 4, 0] }}
                transition={{ duration: 1.2, repeat: Infinity }}
              >
                <Flame className="size-14 fill-streak/40 text-streak" aria-hidden />
              </motion.div>
            ) : (
              <div className="mx-auto mb-4 grid size-24 place-items-center rounded-full bg-brand-gradient text-white shadow-brand">
                {step.kind === "level" ? <Star className="size-12 fill-white/30" aria-hidden /> : <Award className="size-12" aria-hidden />}
              </div>
            )}

            <h2 id="celebration-title" className="text-2xl font-extrabold">
              {step.kind === "level" ? t("levelUp") : step.kind === "streak" ? t("streak", { count: step.count }) : t("achievement")}
            </h2>
            <p className="mt-2 text-[15px] text-muted-foreground">
              {step.kind === "level"
                ? t("levelText", { level: step.level, name: step.name })
                : step.kind === "streak"
                  ? t("streakText")
                  : `${step.title} — ${step.description}`}
            </p>
            {step.kind === "achievement" && step.xp > 0 && <p className="mt-2 font-extrabold text-success">{t("xp", { xp: step.xp })}</p>}

            <Button variant="brand" size="2xl" className="mt-6 w-full" onClick={next} autoFocus>
              {t("continue")}
            </Button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
