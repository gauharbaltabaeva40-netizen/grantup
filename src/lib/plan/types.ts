// Жеке оқу жоспары — study_plans.plan бағанының пішіні.

export type PlanItemType = "lesson" | "practice" | "mistakes" | "mock";

export type PlanItem = {
  type: PlanItemType;
  title: string;
  subjectCode: string | null;
  topicId: string | null;
  lessonId: string | null;
  questions: number | null;
};

export type PlanDay = { date: string; items: PlanItem[] };

export type StudyPlanData = {
  summary: string;
  days: PlanDay[];
  /** "ai" — Claude құрды; "rules" — AI қолжетімсіз болғанда ережелермен */
  generatedBy: "ai" | "rules";
};

/** Жоспар тапсырмасының сілтемесі */
export function planItemHref(item: PlanItem): string {
  switch (item.type) {
    case "lesson":
      return item.subjectCode && item.lessonId ? `/lessons/${item.subjectCode}/${item.lessonId}` : "/lessons";
    case "practice":
      return item.subjectCode ? `/practice/${item.subjectCode}${item.topicId ? `?topic=${item.topicId}` : ""}` : "/practice";
    case "mistakes":
      return "/practice/mistakes";
    case "mock":
      return "/mock-exam";
  }
}
