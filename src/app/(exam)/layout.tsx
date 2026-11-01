// Сынақ ҰБТ экраны — назар аударуға кедергі келтірмеу үшін негізгі мәзірсіз.
export default function ExamLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-dvh bg-background">{children}</div>;
}
