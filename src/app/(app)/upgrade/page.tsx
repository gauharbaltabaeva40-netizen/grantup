import { getFormatter, getTranslations } from "next-intl/server";
import { BookOpen, Check, ClipboardCheck, Sparkles, Target } from "lucide-react";
import { ContinueButton } from "@/components/brand/continue-button";
import { GradientCard } from "@/components/brand/gradient-card";
import { FadeIn } from "@/components/motion/fade-in";
import { Card, CardContent } from "@/components/ui/card";
import { getAccess } from "@/lib/access";
import { getViewer } from "@/lib/viewer";

export async function generateMetadata() {
  const t = await getTranslations("upgrade");
  return { title: t("title") };
}

// «Толық курсқа қосылу»: құлыпталған контенттен келетін бет. Сыртқы сілтеме жоқ — доступты админ береді.
export default async function UpgradePage() {
  const [t, tc, format, access, viewer] = await Promise.all([
    getTranslations("upgrade"),
    getTranslations("common"),
    getFormatter(),
    getAccess(),
    getViewer(),
  ]);

  const features = [
    { icon: BookOpen, text: t("f1") },
    { icon: Target, text: t("f2") },
    { icon: ClipboardCheck, text: t("f3") },
    { icon: Sparkles, text: t("f4") },
  ];

  return (
    <FadeIn className="space-y-5">
      <GradientCard>
        <h1 className="text-2xl font-extrabold sm:text-3xl">{t("title")}</h1>
        <p className="mt-1.5 text-white/85">{t("description")}</p>
        <ul className="mt-5 grid gap-3 sm:grid-cols-2">
          {features.map(({ icon: Icon, text }) => (
            <li key={text} className="flex items-start gap-3 rounded-xl bg-white/12 p-3">
              <Icon className="mt-0.5 size-5 shrink-0" aria-hidden />
              <span className="text-[15px] font-semibold">{text}</span>
            </li>
          ))}
        </ul>
      </GradientCard>

      <Card className="rounded-2xl shadow-soft ring-0">
        <CardContent className="space-y-2">
          {access.tier === "full" ? (
            <p className="flex items-center gap-2 font-semibold text-success">
              <Check className="size-5" aria-hidden />
              {t("alreadyFull", {
                date: format.dateTime(new Date(new Date(access.endsAt).getTime() - 1), { dateStyle: "long" }),
              })}
            </p>
          ) : (
            <>
              <h2 className="text-lg font-bold">{t("howTitle")}</h2>
              <p className="text-[15px] leading-relaxed text-muted-foreground">{t("howText")}</p>
              {viewer && !viewer.demo && (
                <p className="pt-1 text-sm font-semibold">{t("yourEmail", { email: viewer.email })}</p>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <ContinueButton href="/">{tc("toHome")}</ContinueButton>
    </FadeIn>
  );
}
