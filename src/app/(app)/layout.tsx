import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { getCurrentProfile } from "@/lib/auth/session";

// Жеке беттер іздеу жүйелерінде көрсетілмейді
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function StudentLayout({ children }: { children: React.ReactNode }) {
  // Жаңа оқушы алдымен онбордингтен өтеді (админдерден басқа)
  const profile = await getCurrentProfile();
  // Әкімші уақытша құпиясөз берген болса — алдымен өз құпиясөзін қояды
  if (profile?.must_change_password) redirect("/change-password");
  if (profile && !profile.onboarding_completed_at && profile.role !== "admin") redirect("/onboarding");

  return <AppShell>{children}</AppShell>;
}
