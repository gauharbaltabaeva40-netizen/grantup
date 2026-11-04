import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { z } from "zod";
import { DuelArena } from "@/components/duel/duel-arena";
import { getDuelPage } from "@/lib/duel/data";

export async function generateMetadata() {
  const t = await getTranslations("duel");
  return { title: t("title") };
}

export const dynamic = "force-dynamic";

export default async function DuelArenaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const state = await getDuelPage(id, await getLocale());
  if (!state) notFound();
  return <DuelArena initial={state} />;
}
