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
