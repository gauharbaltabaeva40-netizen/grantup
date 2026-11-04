// Дуэль — клиент пен сервер арасындағы деректер пішіні.

export const DUEL_SIZE = 5;
/** Бір сұраққа берілетін уақыт (секунд) */
export const DUEL_SECONDS_PER_QUESTION = 30;
/** Дуэль сілтемесінің жарамдылық мерзімі */
export const DUEL_TTL_HOURS = 48;
export const DUEL_WIN_XP = 15;
/** Жеңіс XP-і тәулігіне ең көбі осынша рет (досыңмен XP «өсіруге» болмасын) */
export const DUEL_WIN_XP_PER_DAY = 5;

export type DuelPlayer = { name: string; avatar: string | null };

export type DuelSide = DuelPlayer & {
  /** null — әлі ойнамады */
  correct: number | null;
  seconds: number | null;
  finished: boolean;
  /** Әр сұрақ: true/false — дұрыс/қате, null — жауап берілмеді */
  marks: (boolean | null)[];
};

export type DuelStatus =
  | "play" //       менің кезегім (әлі ойнамадым)
  | "waiting" //    мен ойнадым, қарсылас әлі жоқ / ойнамады
  | "won"
  | "lost"
  | "draw"
  | "expired"; //   қарсылас мерзімінде ойнамады

export type DuelState = {
  id: string;
  code: string;
  subjectTitle: string | null;
  total: number;
  secondsPerQuestion: number;
  status: DuelStatus;
  isCreator: boolean;
  isOpen: boolean;
  me: DuelSide;
  opponent: DuelSide | null;
  /** Менің әрекетім (ойнап жатсам) */
  attemptId: string | null;
  /** Келесі жауап берілмеген сұрақ индексі */
  nextIndex: number;
  deadlineAt: string | null;
  serverNow: string;
  expiresAt: string;
  xpWon: number;
};

export type DuelListItem = {
  id: string;
  status: DuelStatus;
  opponent: DuelPlayer | null;
  subjectTitle: string | null;
  myCorrect: number | null;
  opponentCorrect: number | null;
  total: number;
  createdAt: string;
};

export type DuelErrorKey =
  | "no_questions"
  | "not_found"
  | "taken"
  | "expired"
  | "own_duel"
  | "time_over"
  | "invalid_input"
  | "rate_limited"
  | "unauthenticated"
  | "unknown";

export type DuelResult<T> = { ok: true; data: T } | { ok: false; error: DuelErrorKey };
