// Жаттығудағы сұрақ саны нұсқалары (клиент пен сервер ортақ қолданады)
export const PRACTICE_SIZES = [10, 20, 30] as const;
export type PracticeSize = (typeof PRACTICE_SIZES)[number];
