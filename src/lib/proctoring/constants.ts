// Прокторинг параметрлері (клиент пен сервер ортақ).

/** Фотолар мен оқиғалар осы күннен кейін автоматты өшіріледі (күнделікті cron). */
export const PROCTORING_RETENTION_DAYS = 30;
/** Кезекті фото аралығы */
export const SNAPSHOT_INTERVAL_MS = 3 * 60_000;
/** Бет көрінбесе — осы уақыттан кейін бұзушылық тіркеледі */
export const NO_FACE_AFTER_MS = 5_000;
/** Бірнеше бет — осы уақыттан кейін */
export const MULTIPLE_FACES_AFTER_MS = 3_000;
/** Бір түрлі бұзушылық қайта тіркелгенше күту (журнал толып кетпес үшін) */
export const VIOLATION_COOLDOWN_MS = 60_000;
/** Фото өлшемі (сервер ≤ 300 КБ қабылдайды) */
export const SNAPSHOT_WIDTH = 320;
export const SNAPSHOT_MAX_BYTES = 300 * 1024;
