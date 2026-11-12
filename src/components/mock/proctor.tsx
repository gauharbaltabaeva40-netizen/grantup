"use client";

/**
 * Сынақ ҰБТ прокторингі (камера).
 * - Бет анықтау браузердің өзінде (MediaPipe, WASM) — видео серверге ағынмен жіберілмейді.
 * - Серверге тек: келісім фотосы, 3 минут сайынғы фото, бұзушылық сәтіндегі фото және оқиғалар журналы.
 * - Бұзушылық (бет жоқ, бірнеше адам, телефон, басты жанына бұру, камера өшті, басқа бетке ауысу)
 *   тек тіркеледі — сынақ тоқтатылмайды.
 * - Әр оқиғамен бірге сол сәттегі сұрақ нөмірі жазылады.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Camera, CameraOff, Loader2, ScanFace, ShieldCheck, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { logProctoringEvent, uploadProctoringSnapshot } from "@/lib/proctoring/actions";
import {
  LOOK_AWAY_AFTER_MS,
  LOOK_AWAY_GAZE,
  LOOK_AWAY_YAW_DEG,
  LOOK_AWAY_YAW_FALLBACK,
  MULTIPLE_FACES_AFTER_MS,
  NO_FACE_AFTER_MS,
  PHONE_CHECK_INTERVAL_MS,
  PHONE_CONFIRM_HITS,
  PHONE_MIN_SCORE,
  POSE_CALIBRATION_SAMPLES,
  PROCTORING_RETENTION_DAYS,
  SNAPSHOT_INTERVAL_MS,
  SNAPSHOT_MAX_BYTES,
  SNAPSHOT_WIDTH,
  VIOLATION_COOLDOWN_MS,
} from "@/lib/proctoring/constants";
import { headYaw, isLookingAway, isTurnedAway, median, sideGaze, yawFromMatrix } from "@/lib/proctoring/head-pose";
import type { ProctoringEventType } from "@/lib/supabase/types";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------
// Бет анықтау (бір рет жүктеледі, беттер арасында ортақ)
// ---------------------------------------------------------------------

type Frame = HTMLVideoElement | HTMLImageElement | HTMLCanvasElement;
type FaceSample = { count: number; yaw: number | null };
type Detector = { sample: (frame: Frame) => FaceSample; close: () => void };
type PhoneDetector = { score: (frame: Frame) => number; close: () => void };
/** Бас бұрышы (градус) және көздің жанына қарауы (0..1) */
type Pose = { yaw: number; gaze: number };
type Landmarker = { pose: (frame: Frame) => Pose | null; close: () => void };

let detectorPromise: Promise<Detector | null> | null = null;
let phoneDetectorPromise: Promise<PhoneDetector | null> | null = null;
let landmarkerPromise: Promise<Landmarker | null> | null = null;
/** Жүктеліп болған Face Landmarker (секунд сайынғы циклде күтпеу үшін) */
let landmarkerReady: Landmarker | null = null;

/** detectForVideo уақыт белгісі әр детектор үшін қатаң өсуі керек */
function monotonicClock() {
  let last = 0;
  return () => {
    last = Math.max(performance.now(), last + 1);
    return last;
  };
}

/** MediaPipe бет детекторы. Жүктелмесе (ескі құрылғы) — null, прокторинг тек фотомен жалғасады. */
export function loadDetector(): Promise<Detector | null> {
  detectorPromise ??= (async () => {
    try {
      const { FaceDetector, FilesetResolver } = await import("@mediapipe/tasks-vision");
      const vision = await FilesetResolver.forVisionTasks("/mediapipe");
      const detector = await FaceDetector.createFromOptions(vision, {
        baseOptions: { modelAssetPath: "/models/blaze_face_short_range.tflite", delegate: "CPU" },
        runningMode: "VIDEO",
        minDetectionConfidence: 0.6,
      });
      const clock = monotonicClock();
      return {
        sample: (frame) => {
          const { detections } = detector.detectForVideo(frame, clock());
          // Басты бұру тек бір бет болғанда бағаланады
          return { count: detections.length, yaw: detections.length === 1 ? headYaw(detections[0].keypoints) : null };
        },
        close: () => detector.close(),
      };
    } catch (error) {
      console.error("face detector unavailable", error);
      detectorPromise = null;
      return null;
    }
  })();
  return detectorPromise;
}

/** Телефон детекторы (EfficientDet-Lite0, COCO «cell phone»). Жүктелмесе — null, қалған прокторинг жұмыс істей береді. */
export function loadPhoneDetector(): Promise<PhoneDetector | null> {
  phoneDetectorPromise ??= (async () => {
    try {
      const { ObjectDetector, FilesetResolver } = await import("@mediapipe/tasks-vision");
      const vision = await FilesetResolver.forVisionTasks("/mediapipe");
      const detector = await ObjectDetector.createFromOptions(vision, {
        baseOptions: { modelAssetPath: "/models/efficientdet_lite0_f16.tflite", delegate: "CPU" },
        runningMode: "VIDEO",
        categoryAllowlist: ["cell phone"],
        scoreThreshold: 0.3,
        maxResults: 1,
      });
      const clock = monotonicClock();
      return {
        score: (frame) => detector.detectForVideo(frame, clock()).detections[0]?.categories[0]?.score ?? 0,
        close: () => detector.close(),
      };
    } catch (error) {
      console.error("phone detector unavailable", error);
      phoneDetectorPromise = null;
      return null;
    }
  })();
  return phoneDetectorPromise;
}

type CameraError = "denied" | "unsupported";

async function openCamera(): Promise<MediaStream> {
  if (!navigator.mediaDevices?.getUserMedia) throw Object.assign(new Error("unsupported"), { code: "unsupported" });
  return navigator.mediaDevices.getUserMedia({
    audio: false,
    video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
  });
}

/** Видео кадрын шағын JPEG етіп алу (≤ 300 КБ) */
async function captureJpeg(video: HTMLVideoElement): Promise<Blob | null> {
  if (!video.videoWidth) return null;
  const canvas = document.createElement("canvas");
  canvas.width = SNAPSHOT_WIDTH;
  canvas.height = Math.round((video.videoHeight / video.videoWidth) * SNAPSHOT_WIDTH);
  canvas.getContext("2d")?.drawImage(video, 0, 0, canvas.width, canvas.height);
  for (const quality of [0.7, 0.5, 0.35]) {
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
    if (blob && blob.size <= SNAPSHOT_MAX_BYTES) return blob;
  }
  return null;
}

/**
 * Face Landmarker: бастың нақты бұрышы (түрлендіру матрицасынан) және көз қарашығының бағыты (blendshapes).
 * Нақты кадрларда: тура — 10° / 0,21; сәл бұрылып жанына қарау — 30° / 0,68; қатты бұрылу — 51°.
 */
export function loadLandmarker(): Promise<Landmarker | null> {
  landmarkerPromise ??= (async () => {
    try {
      const { FaceLandmarker, FilesetResolver } = await import("@mediapipe/tasks-vision");
      const vision = await FilesetResolver.forVisionTasks("/mediapipe");
      const landmarker = await FaceLandmarker.createFromOptions(vision, {
        baseOptions: { modelAssetPath: "/models/face_landmarker.task", delegate: "CPU" },
        runningMode: "VIDEO",
        numFaces: 1,
        outputFaceBlendshapes: true,
        outputFacialTransformationMatrixes: true,
      });
      const clock = monotonicClock();
      const ready: Landmarker = {
        pose: (frame) => {
          const result = landmarker.detectForVideo(frame, clock());
          const yaw = yawFromMatrix(result.facialTransformationMatrixes?.[0]?.data);
          return yaw === null ? null : { yaw, gaze: sideGaze(result.faceBlendshapes?.[0]?.categories) };
        },
        close: () => landmarker.close(),
      };
      landmarkerReady = ready;
      return ready;
    } catch (error) {
      console.error("face landmarker unavailable", error);
      landmarkerPromise = null;
      return null;
    }
  })();
  return landmarkerPromise;
}

type FaceState = "loading" | "ok" | "none" | "many" | "unavailable";
/** Басты бұру: unknown — әлі «тура» қалып анықталмады немесе бет жоқ */
type LookState = "unknown" | "ok" | "away";

/** Камера + бет саны мен басты бұруды тұрақты бақылау (1 секунд сайын) */
function useCameraWatch(active: boolean) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [status, setStatus] = useState<"idle" | "starting" | "on" | "off">("idle");
  const [error, setError] = useState<CameraError | null>(null);
  const [face, setFace] = useState<FaceState>("loading");
  const [look, setLook] = useState<LookState>("unknown");
  const [detectorReady, setDetectorReady] = useState<boolean | null>(null);
  // Оқушының өз «тура» қалпы: алғашқы өлшемдердің медианасы (камера әр түрлі бұрышта тұруы мүмкін).
  // Face Landmarker (градус) мен қосалқы әдістің (бет нүктелері) өлшемдері бөлек жиналады.
  const calibration = useRef<{ deg: number[]; rough: number[] }>({ deg: [], rough: [] });
  const baseline = useRef<{ deg: number | null; rough: number | null }>({ deg: null, rough: null });

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  const start = useCallback(async () => {
    setError(null);
    setStatus("starting");
    try {
      stop();
      const stream = await openCamera();
      streamRef.current = stream;
      stream.getVideoTracks()[0]?.addEventListener("ended", () => setStatus("off"));
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
      setStatus("on");
    } catch (e) {
      const name = (e as { name?: string; code?: string }).code ?? (e as { name?: string }).name;
      setError(name === "unsupported" || name === "NotFoundError" ? "unsupported" : "denied");
      setStatus("off");
    }
  }, [stop]);

  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    void loadDetector().then((d) => !cancelled && setDetectorReady(Boolean(d)));
    void loadLandmarker();
    return () => {
      cancelled = true;
    };
  }, [active]);

  useEffect(() => {
    if (status !== "on" || detectorReady === null) return;
    if (!detectorReady) {
      setFace("unavailable");
      return;
    }
    const id = setInterval(async () => {
      const video = videoRef.current;
      const detector = await loadDetector();
      if (!video || !detector || video.readyState < 2) return;
      try {
        const { count, yaw } = detector.sample(video);
        setFace(count === 0 ? "none" : count > 1 ? "many" : "ok");
        if (count !== 1) {
          setLook("unknown");
          return;
        }
        // Негізгі әдіс — Face Landmarker; ол жүктелмесе — бет нүктелерімен шамалап
        const pose = landmarkerReady?.pose(video) ?? null;
        const mode = pose ? "deg" : "rough";
        const value = pose ? pose.yaw : yaw;
        if (value === null) {
          setLook("unknown");
        } else if (baseline.current[mode] === null) {
          calibration.current[mode].push(value);
          if (calibration.current[mode].length >= POSE_CALIBRATION_SAMPLES) baseline.current[mode] = median(calibration.current[mode]);
        } else if (pose) {
          setLook(isLookingAway(pose, baseline.current.deg, { yawDeg: LOOK_AWAY_YAW_DEG, gaze: LOOK_AWAY_GAZE }) ? "away" : "ok");
        } else {
          setLook(isTurnedAway(value, baseline.current.rough, LOOK_AWAY_YAW_FALLBACK) ? "away" : "ok");
        }
      } catch {
        setFace("unavailable");
      }
    }, 1000);
    return () => clearInterval(id);
  }, [status, detectorReady]);

  // Видео элементі кейін пайда болса да ағынды байлау
  useEffect(() => {
    const video = videoRef.current;
    if (status === "on" && video && streamRef.current && video.srcObject !== streamRef.current) {
      video.srcObject = streamRef.current;
      void video.play().catch(() => {});
    }
  });

  useEffect(() => stop, [stop]);

  return { videoRef, status, error, face, look, start, stop };
}

function CameraPreview({ videoRef, className }: { videoRef: React.RefObject<HTMLVideoElement | null>; className?: string }) {
  // Айна сияқты (оқушыға табиғи); фото айналдырылмай түсіріледі
  return <video ref={videoRef} muted playsInline autoPlay className={cn("-scale-x-100 bg-black object-cover", className)} />;
}

function FaceStatus({ face }: { face: FaceState }) {
  const t = useTranslations("mockExam.proctor");
  const map = {
    loading: { icon: Loader2, text: t("loadingDetector"), tone: "text-muted-foreground", spin: true },
    ok: { icon: ShieldCheck, text: t("faceOk"), tone: "text-success", spin: false },
    none: { icon: ScanFace, text: t("noFace"), tone: "text-danger", spin: false },
    many: { icon: TriangleAlert, text: t("multipleFaces"), tone: "text-danger", spin: false },
    unavailable: { icon: Camera, text: t("detectorUnavailable"), tone: "text-muted-foreground", spin: false },
  } as const;
  const { icon: Icon, text, tone, spin } = map[face];
  return (
    <p className={cn("flex items-center gap-2 text-sm font-semibold", tone)} aria-live="polite">
      <Icon className={cn("size-4 shrink-0", spin && "animate-spin")} aria-hidden />
      {text}
    </p>
  );
}

// ---------------------------------------------------------------------
// Сынақ алдында: келісім + камера тексеру
// ---------------------------------------------------------------------

export function CameraCheck({ onReady, onCancel, pending }: { onReady: () => void; onCancel: () => void; pending: boolean }) {
  const t = useTranslations("mockExam.proctor");
  const [consent, setConsent] = useState(false);
  const { videoRef, status, error, face, start, stop } = useCameraWatch(true);
  // Детектор жоқ құрылғыда тек камера қосылуы жеткілікті
  const canStart = consent && status === "on" && (face === "ok" || face === "unavailable");

  return (
    <div className="space-y-4">
      <p className="text-[15px] leading-relaxed">{t("checkText")}</p>
      <p className="rounded-xl bg-muted px-4 py-3 text-sm leading-relaxed text-muted-foreground">
        {t("privacy", { days: PROCTORING_RETENTION_DAYS })}
      </p>

      <div className="relative overflow-hidden rounded-2xl border bg-black">
        <CameraPreview videoRef={videoRef} className="aspect-[4/3] w-full" />
        {status !== "on" && (
          <div className="absolute inset-0 grid place-items-center text-white/70">
            {status === "starting" ? <Loader2 className="size-10 animate-spin" aria-hidden /> : <CameraOff className="size-10" aria-hidden />}
          </div>
        )}
      </div>

      {status === "on" && <FaceStatus face={face} />}
      {error && <p className="text-sm font-semibold text-danger">{t(error)}</p>}

      <label className="flex items-start gap-3 text-sm font-medium">
        <input type="checkbox" className="mt-0.5 size-5 shrink-0 accent-primary" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
        {t("consent")}
      </label>

      <div className="flex flex-col gap-2 sm:flex-row">
        {status !== "on" ? (
          <Button variant="brand" size="xl" className="flex-1" onClick={start} disabled={status === "starting"}>
            {status === "starting" ? <Loader2 className="animate-spin" aria-hidden /> : <Camera aria-hidden />}
            {status === "starting" ? t("starting") : error ? t("retry") : t("enableCamera")}
          </Button>
        ) : (
          <Button
            variant="brand"
            size="xl"
            className="flex-1"
            disabled={!canStart || pending}
            onClick={() => {
              stop();
              onReady();
            }}
          >
            {pending && <Loader2 className="animate-spin" aria-hidden />}
            {t("start")}
          </Button>
        )}
        <Button
          variant="ghost"
          size="xl"
          onClick={() => {
            stop();
            onCancel();
          }}
        >
          {t("cancel")}
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------
// Сынақ кезінде
// ---------------------------------------------------------------------

export function ExamProctor({ attemptId, questionNo }: { attemptId: string; questionNo: number }) {
  const t = useTranslations("mockExam.proctor");
  const { videoRef, status, error, face, look, start } = useCameraWatch(true);
  const [phone, setPhone] = useState(false);
  const lookSince = useRef<{ state: LookState; since: number }>({ state: "unknown", since: Date.now() });
  const questionRef = useRef(questionNo);
  questionRef.current = questionNo;
  const offSince = useRef<number | null>(null);
  const lastLogged = useRef<Partial<Record<ProctoringEventType, number>>>({});
  const detectorLogged = useRef(false);
  const faceSince = useRef<{ state: FaceState; since: number }>({ state: "loading", since: Date.now() });

  /** Бір түрлі оқиға минутына бір реттен жиі жазылмайды */
  const cooledDown = useCallback((type: ProctoringEventType, cooldown = VIOLATION_COOLDOWN_MS) => {
    const now = Date.now();
    if (now - (lastLogged.current[type] ?? 0) < cooldown) return false;
    lastLogged.current[type] = now;
    return true;
  }, []);

  const log = useCallback(
    (type: ProctoringEventType, detail: Record<string, string | number | boolean> = {}) =>
      logProctoringEvent(attemptId, type, detail, questionRef.current),
    [attemptId],
  );

  const snapshot = useCallback(
    async (reason: "consent" | "snapshot" | "no_face" | "multiple_faces" | "phone_detected" | "looking_away") => {
      const question = questionRef.current;
      const video = videoRef.current;
      const blob = video ? await captureJpeg(video) : null;
      if (!blob) {
        if (reason !== "snapshot" && reason !== "consent") await log(reason);
        return;
      }
      const form = new FormData();
      form.append("attemptId", attemptId);
      form.append("reason", reason);
      form.append("question", String(question));
      form.append("file", blob, "snapshot.jpg");
      const result = await uploadProctoringSnapshot(form);
      // Фото сақталмаса да, бұзушылық журналда қалсын
      if (!result.ok && reason !== "snapshot" && reason !== "consent") await log(reason);
    },
    [attemptId, log, videoRef],
  );

  // Камераны бірден қосу (рұқсат сынақ алдында берілген)
  useEffect(() => {
    void start();
  }, [start]);

  // Камера қосылғанда — келісім фотосы (бір сынаққа бір рет, бет жаңартылса да)
  useEffect(() => {
    if (status !== "on") return;
    const key = `gu_proctor_consent_${attemptId}`;
    let done = false;
    try {
      done = sessionStorage.getItem(key) === "1";
      sessionStorage.setItem(key, "1");
    } catch {}
    if (!done) setTimeout(() => void snapshot("consent"), 1500);
  }, [status, attemptId, snapshot]);

  // Камера өшсе / қайта қосылса (қай сұрақта және қанша уақыт өшік тұрғаны)
  useEffect(() => {
    if (status === "off") {
      offSince.current ??= Date.now();
      if (cooledDown("camera_off")) void log("camera_off", { reason: error ?? "ended" });
    }
    if (status === "on" && offSince.current !== null) {
      const seconds = Math.round((Date.now() - offSince.current) / 1000);
      offSince.current = null;
      void log("camera_on", { offSeconds: seconds });
    }
  }, [status, error, cooledDown, log]);

  // Бет анықтау қолжетімсіз
  useEffect(() => {
    if (face === "unavailable" && !detectorLogged.current) {
      detectorLogged.current = true;
      void log("detector_unavailable");
    }
  }, [face, log]);

  // Бет жоқ / бірнеше бет — белгілі уақыт сақталса тіркеледі
  useEffect(() => {
    if (faceSince.current.state !== face) faceSince.current = { state: face, since: Date.now() };
    const check = setInterval(() => {
      const { state, since } = faceSince.current;
      const elapsed = Date.now() - since;
      if (state === "none" && elapsed >= NO_FACE_AFTER_MS && cooledDown("no_face")) void snapshot("no_face");
      if (state === "many" && elapsed >= MULTIPLE_FACES_AFTER_MS && cooledDown("multiple_faces")) void snapshot("multiple_faces");
    }, 1000);
    return () => clearInterval(check);
  }, [face, cooledDown, snapshot]);

  // Басты жанына ұзақ бұру (төмен қарау есептелмейді — жоба қағазына жазу қалыпты)
  useEffect(() => {
    if (lookSince.current.state !== look) lookSince.current = { state: look, since: Date.now() };
    if (look !== "away") return;
    const check = setInterval(() => {
      if (lookSince.current.state === "away" && Date.now() - lookSince.current.since >= LOOK_AWAY_AFTER_MS && cooledDown("looking_away")) {
        void snapshot("looking_away");
      }
    }, 1000);
    return () => clearInterval(check);
  }, [look, cooledDown, snapshot]);

  // Телефон: модель кешіккен соң жүктеледі; қатарынан бірнеше рет көрінсе ғана тіркеледі (жалған дабылды азайту)
  useEffect(() => {
    if (status !== "on") return;
    let cancelled = false;
    let hits = 0;
    let busy = false;
    const id = setInterval(async () => {
      const video = videoRef.current;
      if (busy || document.hidden || !video || video.readyState < 2) return;
      busy = true;
      try {
        const detector = await loadPhoneDetector();
        if (cancelled || !detector) return;
        const found = detector.score(video) >= PHONE_MIN_SCORE;
        hits = found ? hits + 1 : 0;
        setPhone(hits >= PHONE_CONFIRM_HITS);
        if (hits >= PHONE_CONFIRM_HITS && cooledDown("phone_detected")) void snapshot("phone_detected");
      } catch {
        // Детектор қатесі сынаққа әсер етпеуі керек
      } finally {
        busy = false;
      }
    }, PHONE_CHECK_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [status, videoRef, cooledDown, snapshot]);

  // Кезекті фото
  useEffect(() => {
    if (status !== "on") return;
    const id = setInterval(() => void snapshot("snapshot"), SNAPSHOT_INTERVAL_MS);
    return () => clearInterval(id);
  }, [status, snapshot]);

  // Басқа бетке/қолданбаға ауысу
  useEffect(() => {
    const onVisibility = () => {
      if (document.hidden && cooledDown("tab_hidden", 10_000)) void log("tab_hidden");
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [cooledDown, log]);

  const warn = status !== "on" || face === "none" || face === "many" || phone || look === "away";
  const alert =
    face === "none" ? t("noFace") : face === "many" ? t("multipleFaces") : phone ? t("phoneDetected") : look === "away" ? t("lookAtScreen") : null;

  return (
    <div className="fixed bottom-24 left-3 z-40 flex max-w-[calc(100vw-1.5rem)] items-end gap-2 lg:bottom-4" aria-label={t("label")}>
      <div className={cn("relative overflow-hidden rounded-xl border-2 shadow-lg", warn ? "border-danger" : "border-success")}>
        <CameraPreview videoRef={videoRef} className="h-20 w-[6.5rem]" />
        {status !== "on" && (
          <div className="absolute inset-0 grid place-items-center bg-black/80 text-white">
            <CameraOff className="size-6" aria-hidden />
          </div>
        )}
      </div>
      {status === "off" ? (
        <div className="rounded-xl bg-card p-2 text-xs shadow-lg">
          <p className="mb-1.5 font-semibold text-danger">{t("cameraOff")}</p>
          <Button size="sm" variant="outline" onClick={start}>
            <Camera aria-hidden /> {t("cameraOn")}
          </Button>
        </div>
      ) : (
        alert && (
          <p className="rounded-xl bg-card px-2.5 py-1.5 text-xs font-semibold text-danger shadow-lg" role="status">
            {alert}
          </p>
        )
      )}
    </div>
  );
}
