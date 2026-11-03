// Сынақ ҰБТ — клиент пен сервер арасындағы деректер пішіні.

export type MockSection = {
  subject: string;
  title: string;
  /** attempt.question_ids ішіндегі бастапқы индекс */
  start: number;
  count: number;
};

export type MockAnswerState = {
  selected: string[];
  flagged: boolean;
  timeSpentMs: number;
};

export type MockState = {
  attemptId: string;
  title: string;
  /** Оқушының аты-жөні (сынақ экранының жоғарғы жолағында) */
  studentName: string;
  deadlineAt: string;
  /** Сервер уақыты — клиент сағатының ауытқуын түзету үшін */
  serverNow: string;
  sections: MockSection[];
  questionIds: string[];
  answers: Record<string, MockAnswerState>;
};

export type MockErrorKey =
  | "locked"
  | "not_found"
  | "time_over"
  | "invalid_input"
  | "rate_limited"
  | "unauthenticated"
  | "no_questions"
  | "unknown";

export type MockResult<T> = { ok: true; data: T } | { ok: false; error: MockErrorKey };
