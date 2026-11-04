import type { Metadata } from "next";
import { WatermarkProvider } from "@/components/protection/protection";
import { getWatermarkText } from "@/lib/security/watermark";

// Жеке беттер іздеу жүйелерінде көрсетілмейді
export const metadata: Metadata = { robots: { index: false, follow: false } };

// Сынақ ҰБТ экраны — назар аударуға кедергі келтірмеу үшін негізгі мәзірсіз.
export default async function ExamLayout({ children }: { children: React.ReactNode }) {
  return (
    <WatermarkProvider mark={await getWatermarkText()}>
      <div className="min-h-dvh bg-background">{children}</div>
    </WatermarkProvider>
  );
}
