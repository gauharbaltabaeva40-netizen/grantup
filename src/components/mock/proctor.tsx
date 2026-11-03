"use client";

/**
 * Сынақ ҰБТ прокторингі (камера).
 * - Бет анықтау браузердің өзінде (MediaPipe, WASM) — видео серверге ағынмен жіберілмейді.
 * - Серверге тек: келісім фотосы, 3 минут сайынғы фото, бұзушылық сәтіндегі фото және оқиғалар журналы.
 * - Бұзушылық (бет жоқ, бірнеше адам, камера өшті, басқа бетке ауысу) тек тіркеледі — сынақ тоқтатылмайды.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Camera, CameraOff, Loader2, ScanFace, ShieldCheck, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { logProctoringEvent, uploadProctoringSnapshot } from "@/lib/proctoring/actions";
import {
  MULTIPLE_FACES_AFTER_MS,
  NO_FACE_AFTER_MS,
  PROCTORING_RETENTION_DAYS,
  SNAPSHOT_INTERVAL_MS,
  SNAPSHOT_MAX_BYTES,
  SNAPSHOT_WIDTH,
  VIOLATION_COOLDOWN_MS,
} from "@/lib/proctoring/constants";
import type { ProctoringEventType } from "@/lib/supabase/types";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------
// Бет анықтау (бір рет жүктеледі, беттер арасында ортақ)
// ---------------------------------------------------------------------

type Detector = { count: (video: HTMLVideoElement) => number; close: () => void };

let detectorPromise: Promise<Detector | null> | null = null;

/** MediaPipe бет детекторы. Жүктелмесе (ескі құрылғы) — null, прокторинг тек фотомен жалғасады. */
function loadDetector(): Promise<Detector | null> {
  detectorPromise ??= (async () => {
    try {
      const { FaceDetector, FilesetResolver } = await import("@mediapipe/tasks-vision");
      const vision = await FilesetResolver.forVisionTasks("/mediapipe");
      const detector = await FaceDetector.createFromOptions(vision, {
        baseOptions: { modelAssetPath: "/models/blaze_face_short_range.tflite", delegate: "CPU" },
        runningMode: "VIDEO",
        minDetectionConfidence: 0.6,
      });
      let last = 0;
      return {
        count: (video) => {
          // detectForVideo уақыт белгісі қатаң өсуі керек
          const now = Math.max(performance.now(), last + 1);
          last = now;
          return detector.detectForVideo(video, now).detections.length;
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

type FaceState = "loading" | "ok" | "none" | "many" | "unavailable";

/** Камера + бет санын тұрақты бақылау (1 секунд сайын) */
function useCameraWatch(active: boolean) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [status, setStatus] = useState<"idle" | "starting" | "on" | "off">("idle");
  const [error, setError] = useState<CameraError | null>(null);
  const [face, setFace] = useState<FaceState>("loading");
  const [detectorReady, setDetectorReady] = useState<boolean | null>(null);

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
        const n = detector.count(video);
        setFace(n === 0 ? "none" : n > 1 ? "many" : "ok");
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

  return { videoRef, status, error, face, start, stop };
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

export function ExamProctor({ attemptId }: { attemptId: string }) {
  const t = useTranslations("mockExam.proctor");
  const { videoRef, status, error, face, start } = useCameraWatch(true);
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

  const snapshot = useCallback(
    async (reason: "consent" | "snapshot" | "no_face" | "multiple_faces") => {
      const video = videoRef.current;
      const blob = video ? await captureJpeg(video) : null;
      if (!blob) {
        if (reason !== "snapshot" && reason !== "consent") await logProctoringEvent(attemptId, reason);
        return;
      }
      const form = new FormData();
      form.append("attemptId", attemptId);
      form.append("reason", reason);
      form.append("file", blob, "snapshot.jpg");
      const result = await uploadProctoringSnapshot(form);
      // Фото сақталмаса да, бұзушылық журналда қалсын
      if (!result.ok && reason !== "snapshot" && reason !== "consent") await logProctoringEvent(attemptId, reason);
    },
    [attemptId, videoRef],
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

  // Камера өшсе
  useEffect(() => {
    if (status === "off" && cooledDown("camera_off")) void logProctoringEvent(attemptId, "camera_off", { reason: error ?? "ended" });
  }, [status, error, attemptId, cooledDown]);

  // Бет анықтау қолжетімсіз
  useEffect(() => {
    if (face === "unavailable" && !detectorLogged.current) {
      detectorLogged.current = true;
      void logProctoringEvent(attemptId, "detector_unavailable");
    }
  }, [face, attemptId]);

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

  // Кезекті фото
  useEffect(() => {
    if (status !== "on") return;
    const id = setInterval(() => void snapshot("snapshot"), SNAPSHOT_INTERVAL_MS);
    return () => clearInterval(id);
  }, [status, snapshot]);

  // Басқа бетке/қолданбаға ауысу
  useEffect(() => {
    const onVisibility = () => {
      if (document.hidden && cooledDown("tab_hidden", 10_000)) void logProctoringEvent(attemptId, "tab_hidden");
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [attemptId, cooledDown]);

  const warn = status !== "on" || face === "none" || face === "many";

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
        (face === "none" || face === "many") && (
          <p className="rounded-xl bg-card px-2.5 py-1.5 text-xs font-semibold text-danger shadow-lg">
            {face === "none" ? t("noFace") : t("multipleFaces")}
          </p>
        )
      )}
    </div>
  );
}
