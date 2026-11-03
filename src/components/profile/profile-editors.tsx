"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Field } from "@/components/forms/fields";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { saveGoal } from "@/lib/onboarding/actions";
import { AVATARS } from "@/lib/profile/avatars";
import { updateNotifications, updateProfile } from "@/lib/profile/actions";
import { cn } from "@/lib/utils";

const chip = (active: boolean) =>
  cn(
    "h-11 rounded-xl border-2 px-3 text-sm font-semibold transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
    active ? "border-primary bg-secondary text-primary" : "border-border bg-card hover:bg-muted",
  );

export function ProfileForm(props: {
  fullName: string;
  nickname: string | null;
  avatar: string | null;
  grade: "10" | "11" | "graduate" | null;
}) {
  const t = useTranslations("profileEdit");
  const ta = useTranslations("auth");
  const router = useRouter();
  const [fullName, setFullName] = useState(props.fullName);
  const [nickname, setNickname] = useState(props.nickname ?? "");
  const [avatar, setAvatar] = useState(props.avatar);
  const [grade, setGrade] = useState(props.grade);
  const [pending, startTransition] = useTransition();

  const save = () =>
    startTransition(async () => {
      const result = await updateProfile({ fullName, nickname, avatar: avatar as (typeof AVATARS)[number] | null, grade });
      if (result.ok) {
        toast.success(t("saved"));
        router.refresh();
      } else toast.error(t("error"));
    });

  return (
    <div className="space-y-4">
      <fieldset>
        <legend className="mb-2 text-sm font-semibold">{t("avatar")}</legend>
        <div className="grid grid-cols-8 gap-1.5">
          {AVATARS.map((a) => (
            <button
              key={a}
              type="button"
              aria-pressed={avatar === a}
              aria-label={a}
              onClick={() => setAvatar(avatar === a ? null : a)}
              className={cn(
                "grid aspect-square place-items-center rounded-xl text-2xl transition-transform hover:scale-105",
                avatar === a ? "bg-secondary ring-2 ring-primary" : "bg-muted",
              )}
            >
              {a}
            </button>
          ))}
        </div>
      </fieldset>
      <Field label={t("fullName")} htmlFor="pf-name">
        <Input id="pf-name" value={fullName} onChange={(e) => setFullName(e.target.value)} maxLength={100} autoComplete="name" />
      </Field>
      <Field label={t("nickname")} htmlFor="pf-nick" hint={t("nicknameHint")}>
        <Input id="pf-nick" value={nickname} onChange={(e) => setNickname(e.target.value)} maxLength={30} />
      </Field>
      <fieldset>
        <legend className="mb-2 text-sm font-semibold">{t("grade")}</legend>
        <div className="grid grid-cols-3 gap-2">
          {(["10", "11", "graduate"] as const).map((g) => (
            <button key={g} type="button" className={chip(grade === g)} aria-pressed={grade === g} onClick={() => setGrade(g)}>
              {ta(g === "graduate" ? "gradeGraduate" : `grade${g}`)}
            </button>
          ))}
        </div>
      </fieldset>
      <Button variant="brand" size="xl" onClick={save} disabled={pending || fullName.trim().length < 2}>
        {pending && <Loader2 className="animate-spin" aria-hidden />}
        {t("save")}
      </Button>
    </div>
  );
}

export function GoalForm({
  targetScore,
  specialtyId,
  specialties,
}: {
  targetScore: number | null;
  specialtyId: string | null;
  specialties: { id: string; code: string; name: string; threshold: number }[];
}) {
  const t = useTranslations("onboarding.goal");
  const tp = useTranslations("profileEdit");
  const router = useRouter();
  const [mode, setMode] = useState<"score" | "specialty">(specialtyId ? "specialty" : "score");
  const [score, setScore] = useState(targetScore ?? 110);
  const [selected, setSelected] = useState(specialtyId);
  const [pending, startTransition] = useTransition();

  const save = () =>
    startTransition(async () => {
      const result = await saveGoal(
        mode === "specialty" && selected ? { targetScore: null, specialtyId: selected } : { targetScore: score, specialtyId: null },
      );
      if (result.ok) {
        toast.success(tp("goalSaved"));
        router.refresh();
      } else toast.error(tp("error"));
    });

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2">
        <button type="button" className={chip(mode === "score")} aria-pressed={mode === "score"} onClick={() => setMode("score")}>
          {t("byScore")}
        </button>
        <button type="button" className={chip(mode === "specialty")} aria-pressed={mode === "specialty"} onClick={() => setMode("specialty")}>
          {t("bySpecialty")}
        </button>
      </div>
      {mode === "score" ? (
        <div className="flex items-center gap-4">
          <input
            type="range"
            min={50}
            max={140}
            value={score}
            onChange={(e) => setScore(Number(e.target.value))}
            aria-label={t("byScore")}
            className="flex-1 accent-[#0047FF]"
          />
          <span className="w-12 text-right text-2xl font-extrabold tabular-nums text-primary">{score}</span>
        </div>
      ) : specialties.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("noSpecialties")}</p>
      ) : (
        <select
          value={selected ?? ""}
          onChange={(e) => setSelected(e.target.value || null)}
          aria-label={t("bySpecialty")}
          className="h-12 w-full rounded-xl border border-input bg-card px-3 text-base"
        >
          <option value="">—</option>
          {specialties.map((s) => (
            <option key={s.id} value={s.id}>
              {s.code} · {s.name} ({s.threshold})
            </option>
          ))}
        </select>
      )}
      <Button variant="brand" size="xl" onClick={save} disabled={pending || (mode === "specialty" && !selected)}>
        {pending && <Loader2 className="animate-spin" aria-hidden />}
        {tp("save")}
      </Button>
    </div>
  );
}

type NotificationKey = "push_streak" | "push_league" | "push_weekly" | "email_weekly" | "email_access_expiry";

export function NotificationsForm({ initial }: { initial: Record<NotificationKey, boolean> }) {
  const t = useTranslations("profileEdit");
  const [values, setValues] = useState(initial);
  const [, startTransition] = useTransition();
  const labels: Record<NotificationKey, string> = {
    push_streak: t("pushStreak"),
    push_league: t("pushLeague"),
    push_weekly: t("pushWeekly"),
    email_weekly: t("emailWeekly"),
    email_access_expiry: t("emailExpiry"),
  };

  const toggle = (key: NotificationKey) => {
    const next = { ...values, [key]: !values[key] };
    setValues(next);
    startTransition(async () => {
      const result = await updateNotifications(next);
      if (!result.ok) {
        setValues(values);
        toast.error(t("error"));
      }
    });
  };

  return (
    <ul className="divide-y">
      {(Object.keys(labels) as NotificationKey[]).map((key) => (
        <li key={key} className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0">
          <span className="text-[15px]">{labels[key]}</span>
          <button
            type="button"
            role="switch"
            aria-checked={values[key]}
            aria-label={labels[key]}
            onClick={() => toggle(key)}
            className={cn(
              "relative h-7 w-12 shrink-0 rounded-full transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
              values[key] ? "bg-primary" : "bg-muted-foreground/30",
            )}
          >
            <span className={cn("absolute top-0.5 left-0 size-6 rounded-full bg-white shadow transition-transform", values[key] ? "translate-x-5.5" : "translate-x-0.5")} />
          </button>
        </li>
      ))}
    </ul>
  );
}
