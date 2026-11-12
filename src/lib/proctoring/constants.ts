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

/** Басты жанына бұру / көзді жанына қарату (Face Landmarker):
 * бас бұрышы оқушының өз «тура» қалпынан осынша градустан көп ауытқыса немесе
 * көздің жанына қарау көрсеткіші (0..1) осыдан асса, және бұл осынша уақыт сақталса — тіркеледі */
export const LOOK_AWAY_YAW_DEG = 20;
export const LOOK_AWAY_GAZE = 0.6;
export const LOOK_AWAY_AFTER_MS = 3_000;
/** Face Landmarker жүктелмесе — бет детекторының нүктелерімен шамалап бағалау шегі (headYaw бірлігі) */
export const LOOK_AWAY_YAW_FALLBACK = 0.3;
/** Сынақ басында «тура» қалыпты анықтау үшін қанша өлшем алынады (1 секундтан) */
export const POSE_CALIBRATION_SAMPLES = 8;
/** Телефон анықтау: тексеру аралығы, ең төмен сенімділік, қатарынан неше рет көрінсе тіркеледі.
 * Нақты кадрлардағы өлшем: телефон бар — 0,5–0,6, телефон жоқ — ≤ 0,2. */
export const PHONE_CHECK_INTERVAL_MS = 2_000;
export const PHONE_MIN_SCORE = 0.35;
export const PHONE_CONFIRM_HITS = 2;
