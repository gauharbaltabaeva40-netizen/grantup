// Басты жанына бұруды бет детекторының нүктелерінен бағалау (қосымша модельсіз).
// BlazeFace нүктелері: 0 — оң көз, 1 — сол көз, 2 — мұрын ұшы, 3 — ауыз, 4–5 — құлақтар (0..1 аралығында).

export type Point = { x: number; y: number };

/**
 * Басты бұру көрсеткіші: мұрынның көздердің ортасынан көлденең ығысуы, көз аралығына бөлінген.
 * Тура қарағанда ≈ 0; бас жанына бұрылған сайын модулі өседі. Нүктелер жетіспесе — null.
 */
export function headYaw(keypoints: readonly Point[] | undefined): number | null {
  if (!keypoints || keypoints.length < 3) return null;
  const [rightEye, leftEye, nose] = keypoints;
  const eyeDistance = Math.abs(rightEye.x - leftEye.x);
  if (eyeDistance < 0.01) return null;
  return (nose.x - (rightEye.x + leftEye.x) / 2) / eyeDistance;
}

export function median(values: readonly number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * Оқушының өз «тура» қалпынан (сынақ басындағы орташа мән) ауытқу шектен асты ма.
 * Төмен қарау тіркелмейді: ҰБТ-да жоба қағазына жазу — қалыпты нәрсе.
 */
export function isTurnedAway(yaw: number | null, baseline: number | null, threshold: number): boolean {
  if (yaw === null || baseline === null) return false;
  return Math.abs(yaw - baseline) > threshold;
}

/**
 * Face Landmarker-дің 4×4 түрлендіру матрицасынан (бағаналар бойынша) бастың көлденең бұрышы, градуспен.
 * Тура қарағанда ≈ 0; оңға/солға бұрылғанда таңбасы әр түрлі.
 */
export function yawFromMatrix(data: ArrayLike<number> | undefined): number | null {
  if (!data || data.length < 16) return null;
  return (Math.atan2(-data[2], Math.hypot(data[6], data[10])) * 180) / Math.PI;
}

/** Көздің жанына қарау көрсеткіші (0..1): көздердің ішке/сыртқа қарау blendshape-терінің ең үлкені */
export function sideGaze(blendshapes: ReadonlyArray<{ categoryName: string; score: number }> | undefined): number {
  if (!blendshapes) return 0;
  const sides = new Set(["eyeLookInLeft", "eyeLookOutLeft", "eyeLookInRight", "eyeLookOutRight"]);
  return blendshapes.reduce((max, c) => (sides.has(c.categoryName) ? Math.max(max, c.score) : max), 0);
}

/** Бас бұрышы «тура» қалыптан шектен көп ауытқыды ма немесе көз жанына қарап тұр ма */
export function isLookingAway(
  pose: { yaw: number; gaze: number },
  baselineYaw: number | null,
  limits: { yawDeg: number; gaze: number },
): boolean {
  if (baselineYaw === null) return false;
  return Math.abs(pose.yaw - baselineYaw) > limits.yawDeg || pose.gaze > limits.gaze;
}
