import { notFound, redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { z } from "zod";
import { MockExam } from "@/components/mock/mock-exam";
import { getMockState } from "@/lib/mock/data";

type Params = { params: Promise<{ attemptId: string }> };

export async function generateMetadata() {
  const t = await getTranslations("mockExam");
  return { title: t("title"), robots: { index: false } };
}

export default async function ExamPage({ params }: Params) {
  const { attemptId } = await params;
  if (!z.uuid().safeParse(attemptId).success) notFound();

  const state = await getMockState(attemptId, await getLocale());
  if (state === "finished") redirect(`/mock-exam/${attemptId}/result`);
  if (!state) notFound();

  return <MockExam state={state} />;
}
