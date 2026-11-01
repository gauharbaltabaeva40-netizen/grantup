"use client";

/**
 * Қорғалған YouTube ойнатқыш.
 * - Видео ID серверден доступ тексерілгеннен кейін ғана келеді (HTML-де жоқ).
 * - youtube-nocookie + IFrame API, YouTube-тың өз басқару панелі өшірулі (controls=0, disablekb=1, rel=0).
 * - Үстінде мөлдір қабат: YouTube атауына, логотипіне, «YouTube-та көру» / «Сілтемені көшіру» батырмаларына басу мүмкін емес.
 * - iframe жоғары/төмен 60px-ке кесіледі — атау мен логотип жолағы көрінбейді.
 * - Көрілген орын сақталады және келесі жолы сол жерден жалғасады.
 * ЕСКЕРТУ: браузерде видеоны 100% жасыру мүмкін емес — мақсат таратуды қиындату (су таңбасы — 11-кезең).
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Loader2, Maximize, Minimize, Pause, Play, RotateCcw, RotateCw, VideoOff } from "lucide-react";
import { Watermark } from "@/components/protection/protection";
import { getLessonVideo, saveVideoProgress } from "@/lib/lessons/actions";
import { cn } from "@/lib/utils";

type YTPlayer = {
  playVideo(): void;
  pauseVideo(): void;
  seekTo(seconds: number, allowSeekAhead: boolean): void;
  getCurrentTime(): number;
  getDuration(): number;
  setPlaybackRate(rate: number): void;
  destroy(): void;
};

type YTNamespace = {
  Player: new (
    el: HTMLElement,
    options: {
      host: string;
      videoId: string;
      width: string;
      height: string;
      playerVars: Record<string, string | number>;
      events: { onReady?: () => void; onStateChange?: (e: { data: number }) => void; onError?: () => void };
    },
  ) => YTPlayer;
  PlayerState: { PLAYING: number; PAUSED: number; ENDED: number };
};

declare global {
  interface Window {
    YT?: YTNamespace;
    onYouTubeIframeAPIReady?: () => void;
  }
}

let apiPromise: Promise<YTNamespace> | null = null;
function loadYouTubeApi(): Promise<YTNamespace> {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  apiPromise ??= new Promise((resolve, reject) => {
    const previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previous?.();
      resolve(window.YT!);
    };
    const script = document.createElement("script");
    script.src = "https://www.youtube.com/iframe_api";
    script.async = true;
    script.onerror = () => {
      apiPromise = null;
      reject(new Error("YouTube API failed to load"));
    };
    document.head.appendChild(script);
  });
  return apiPromise;
}

const SPEEDS = [0.75, 1, 1.25, 1.5, 2];
const SAVE_EVERY_MS = 15_000;

function formatTime(seconds: number) {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${sec}` : `${m}:${sec}`;
}

export function VideoPlayer({ lessonId, startSeconds }: { lessonId: string; startSeconds: number }) {
  const t = useTranslations("player");
  const containerRef = useRef<HTMLDivElement>(null);
  const mountRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<YTPlayer | null>(null);
  const lastSaveRef = useRef(0);

  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(startSeconds);
  const [duration, setDuration] = useState(0);
  const [speedIndex, setSpeedIndex] = useState(1);
  const [fullscreen, setFullscreen] = useState(false);

  const save = useCallback(() => {
    const player = playerRef.current;
    if (!player) return;
    const position = player.getCurrentTime();
    const total = player.getDuration();
    if (position > 0) {
      lastSaveRef.current = Date.now();
      void saveVideoProgress(lessonId, position, total);
    }
  }, [lessonId]);

  // Ойнатқышты жүктеу
  useEffect(() => {
    let cancelled = false;
    const mount = mountRef.current;

    (async () => {
      const result = await getLessonVideo(lessonId);
      if (cancelled) return;
      if (!result.ok) return setStatus("error");

      try {
        const YT = await loadYouTubeApi();
        if (cancelled || !mount) return;
        // YT.Player өз элементін iframe-ге ауыстырады — React басқаратын түйінге тимеу үшін бөлек div жасаймыз
        const host = document.createElement("div");
        mount.appendChild(host);
        playerRef.current = new YT.Player(host, {
          host: "https://www.youtube-nocookie.com",
          videoId: result.videoId,
          width: "100%",
          height: "100%",
          playerVars: {
            controls: 0,
            disablekb: 1,
            rel: 0,
            modestbranding: 1,
            iv_load_policy: 3,
            fs: 0,
            playsinline: 1,
            cc_load_policy: 0,
            start: Math.floor(startSeconds),
            origin: window.location.origin,
          },
          events: {
            onReady: () => {
              if (cancelled) return;
              setDuration(playerRef.current?.getDuration() ?? 0);
              setStatus("ready");
            },
            onStateChange: (e) => {
              const state = window.YT!.PlayerState;
              setPlaying(e.data === state.PLAYING);
              if (e.data === state.PAUSED || e.data === state.ENDED) save();
            },
            onError: () => setStatus("error"),
          },
        });
      } catch {
        if (!cancelled) setStatus("error");
      }
    })();

    return () => {
      cancelled = true;
      save();
      playerRef.current?.destroy();
      playerRef.current = null;
      mount?.replaceChildren();
    };
  }, [lessonId, startSeconds, save]);

  // Уақыт жолағы және мезгіл-мезгіл сақтау
  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => {
      const player = playerRef.current;
      if (!player) return;
      setCurrent(player.getCurrentTime());
      if (!duration) setDuration(player.getDuration());
      if (Date.now() - lastSaveRef.current > SAVE_EVERY_MS) save();
    }, 500);
    return () => clearInterval(id);
  }, [playing, duration, save]);

  // Беттен кеткенде сақтау
  useEffect(() => {
    const onHide = () => save();
    window.addEventListener("pagehide", onHide);
    return () => window.removeEventListener("pagehide", onHide);
  }, [save]);

  useEffect(() => {
    const onChange = () => setFullscreen(document.fullscreenElement === containerRef.current);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  const toggle = () => {
    const player = playerRef.current;
    if (!player || status !== "ready") return;
    if (playing) player.pauseVideo();
    else player.playVideo();
  };

  const seekBy = (delta: number) => {
    const player = playerRef.current;
    if (!player) return;
    const next = Math.min(Math.max(player.getCurrentTime() + delta, 0), duration || Infinity);
    player.seekTo(next, true);
    setCurrent(next);
  };

  const seekTo = (value: number) => {
    playerRef.current?.seekTo(value, true);
    setCurrent(value);
  };

  const cycleSpeed = () => {
    const next = (speedIndex + 1) % SPEEDS.length;
    setSpeedIndex(next);
    playerRef.current?.setPlaybackRate(SPEEDS[next]);
  };

  const toggleFullscreen = async () => {
    const el = containerRef.current;
    if (!el) return;
    if (document.fullscreenElement) await document.exitFullscreen();
    else if (el.requestFullscreen) await el.requestFullscreen().catch(() => setFullscreen((f) => !f));
    else setFullscreen((f) => !f); // iOS Safari: элементті толық экранға шығару қолдау таппайды — CSS арқылы
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === " " || e.key === "k") {
      e.preventDefault();
      toggle();
    } else if (e.key === "ArrowLeft") seekBy(-10);
    else if (e.key === "ArrowRight") seekBy(10);
  };

  if (status === "error") {
    return (
      <div className="grid aspect-video place-items-center rounded-2xl bg-muted p-6 text-center text-muted-foreground">
        <div>
          <VideoOff className="mx-auto mb-2 size-8" aria-hidden />
          <p className="text-sm font-medium">{t("error")}</p>
        </div>
      </div>
    );
  }

  const controlButton = "grid size-11 place-items-center rounded-full text-white transition-colors hover:bg-white/15 focus-visible:outline-2 focus-visible:outline-white";

  return (
    <div
      ref={containerRef}
      tabIndex={0}
      onKeyDown={onKeyDown}
      onContextMenu={(e) => e.preventDefault()}
      className={cn(
        "group relative overflow-hidden bg-black outline-none select-none focus-visible:ring-3 focus-visible:ring-ring/50",
        fullscreen ? "fixed inset-0 z-[60] flex items-center" : "rounded-2xl",
      )}
    >
      <div className="relative aspect-video w-full overflow-hidden">
        {/* iframe-ді кесіп, YouTube атауы мен логотипін жасырамыз */}
        <div className="pointer-events-none absolute inset-x-0 -top-[60px] -bottom-[60px]">
          <div ref={mountRef} className="size-full [&>*]:size-full" />
        </div>

        {/* Су таңбасы — толық экранда да көрінеді */}
        <Watermark />

        {/* Мөлдір қабат: iframe-ге тікелей басуға болмайды */}
        <button
          type="button"
          aria-label={playing ? t("pause") : t("play")}
          onClick={toggle}
          className="absolute inset-0 z-10 cursor-pointer"
        >
          {status === "loading" && (
            <span className="grid size-full place-items-center bg-black text-sm text-white/80">
              <span className="flex flex-col items-center gap-2">
                <Loader2 className="size-8 animate-spin" aria-hidden />
                {t("loading")}
              </span>
            </span>
          )}
          {status === "ready" && !playing && (
            <span className="grid size-full place-items-center bg-black/35">
              <span className="grid size-16 place-items-center rounded-full bg-brand-gradient text-white shadow-brand">
                <Play className="size-7 translate-x-0.5 fill-current" aria-hidden />
              </span>
            </span>
          )}
        </button>

        {/* Басқару панелі */}
        <div
          className={cn(
            "absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-black/85 to-transparent px-2 pt-8 pb-1.5 transition-opacity sm:px-3",
            playing ? "opacity-0 group-hover:opacity-100 group-focus-within:opacity-100" : "opacity-100",
          )}
        >
          <input
            type="range"
            min={0}
            max={duration || 0}
            step={1}
            value={Math.min(current, duration || 0)}
            onChange={(e) => seekTo(Number(e.target.value))}
            aria-label={t("seek")}
            disabled={status !== "ready"}
            className="mb-1 h-1.5 w-full cursor-pointer accent-[#0A84FF]"
          />
          <div className="flex items-center gap-0.5 text-white">
            <button type="button" className={controlButton} onClick={toggle} aria-label={playing ? t("pause") : t("play")}>
              {playing ? <Pause className="size-5 fill-current" aria-hidden /> : <Play className="size-5 fill-current" aria-hidden />}
            </button>
            <button type="button" className={controlButton} onClick={() => seekBy(-10)} aria-label={t("back10")}>
              <RotateCcw className="size-5" aria-hidden />
            </button>
            <button type="button" className={controlButton} onClick={() => seekBy(10)} aria-label={t("forward10")}>
              <RotateCw className="size-5" aria-hidden />
            </button>
            <span className="ml-1 text-xs font-medium tabular-nums sm:text-sm">
              {formatTime(current)} / {formatTime(duration)}
            </span>
            <button
              type="button"
              onClick={cycleSpeed}
              aria-label={t("speed")}
              className="ml-auto h-9 min-w-12 rounded-full px-2 text-sm font-bold hover:bg-white/15"
            >
              {SPEEDS[speedIndex]}×
            </button>
            <button
              type="button"
              className={controlButton}
              onClick={toggleFullscreen}
              aria-label={fullscreen ? t("exitFullscreen") : t("fullscreen")}
            >
              {fullscreen ? <Minimize className="size-5" aria-hidden /> : <Maximize className="size-5" aria-hidden />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
