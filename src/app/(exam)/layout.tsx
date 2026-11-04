import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { WatermarkProvider } from "@/components/protection/protection";
import { getCurrentProfile } from "@/lib/auth/session";
import { getWatermarkText } from "@/lib/security/watermark";

// Жеке беттер іздеу жүйелерінде көрсетілмейді
export const metadata: Metadata = { robots: { index: false, follow: false } };

// Сынақ ҰБТ экраны — назар аударуға кедергі келтірмеу үшін негізгі мәзірсіз.
export default async function ExamLayout({ children }: { children: React.ReactNode }) {
  // Әкімші уақытша құпиясөз берген болса — алдымен өз құпиясөзін қояды
  if ((await getCurrentProfile())?.must_change_password) redirect("/change-password");
  return (
    <WatermarkProvider mark={await getWatermarkText()}>
      <div className="min-h-dvh bg-background">{children}</div>
    </WatermarkProvider>
  );
}
