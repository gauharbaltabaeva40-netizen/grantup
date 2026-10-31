// Клиент пен сервер арасындағы тест деректерінің пішіні.
// Маңызды: QuizQuestion ішінде дұрыс жауап та, түсіндірме де ЖОҚ — олар тек жауап берілгеннен кейін AnswerFeedback-те келеді.

export type QuizOption = { id: string; content: string };

export type AnswerFeedback = {
  isCorrect: boolean;
  points: number;
  maxPoints: number;
  selectedOptionIds: string[];
  correctOptionIds: string[];
  explanation: string;
  xpAwarded: number;
};

export type QuizQuestion = {
  attemptId: string;
  index: number;
  total: number;
  questionId: string;
  type: "single" | "multiple";
  stem: string;
  passage: string | null;
  imageUrl: string | null;
  options: QuizOption[];
  /** Бұрын жауап берілген болса (бетті жаңартқанда) */
  feedback: AnswerFeedback | null;
};

export type QuizResult = {
  correct: number;
  total: number;
  percent: number;
  passPercent: number;
  passed: boolean;
  lessonXp: number;
  level: number | null;
  levelUp: boolean;
};

export type QuizErrorKey =
  | "locked"
  | "no_questions"
  | "not_found"
  | "already_answered"
  | "invalid_input"
  | "rate_limited"
  | "unauthenticated"
  | "unknown";

export type ActionResult<T> = { ok: true; data: T } | { ok: false; error: QuizErrorKey };
