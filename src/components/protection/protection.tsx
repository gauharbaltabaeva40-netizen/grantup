"use client";

/**
 * Контентті қорғау (сабақ, тест, сынақ беттері).
 *
 * МАҢЫЗДЫ: веб-браузерде скриншот пен экран жазуды 100% бұғаттау техникалық тұрғыда мүмкін емес
 * (телефонның скриншоты, екінші құрылғымен түсіру, ОЖ деңгейіндегі жазу т.б.).
 * Сондықтан мақсат — таратуды барынша ҚИЫНДАТУ және авторлықты көрсету:
 *  - су таңбасы: GrantUp.kz логотипі, әлсіз, орны ауысып тұрады (скриншотта авторлықты көрсетеді);
 *  - мәтінді таңдау, көшіру, оң жақ мәзір, сүйреп апару өшірулі;
 *  - скриншот / басып шығару / сақтау / DevTools пернелері — экран бұлыңғырланады + ескерту + журнал;
 *  - басқа терезеге/қолданбаға ауысқанда — бұлыңғырланады;
 *  - DevTools ашылғаны анықталса (эвристика) — мазмұн жасырылады;
 *  - басып шығарғанда — бос бет (globals.css, @media print).
 */

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { EyeOff, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { reportSecurityEvent } from "@/lib/security/actions";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------
// Су таңбасы мәтіні (AppShell береді)
// ---------------------------------------------------------------------
const WatermarkContext = createContext<string>("");

export function WatermarkProvider({ mark, children }: { mark: string; children: React.ReactNode }) {
  return <WatermarkContext.Provider value={mark}>{children}</WatermarkContext.Provider>;
}

export function useWatermark() {
  return useContext(WatermarkContext);
}

/** Логотип + «GrantUp.kz» белгісі (су таңбасының бір бөлігі) */
function BrandMark({ text, size }: { text: string; size: number }) {
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap font-bold text-foreground">
      {/* eslint-disable-next-line @next/next/no-img-element -- кішкентай статикалық логотип, оңтайландыру керек емес */}
      <img src="/logo.png" alt="" width={size} height={size} className="rounded-full" draggable={false} />
      {text}
    </span>
  );
}

/**
 * Су таңбасы: GrantUp.kz логотипі. Әлсіз тор + орны 15 секунд сайын ауысатын белгі.
 * pointer-events жоқ — оқуға және басуға кедергі келтірмейді. Ата-элементке `relative` керек.
 */
export function Watermark({ className, dense = false }: { className?: string; dense?: boolean }) {
  const mark = useWatermark();
  const [pos, setPos] = useState({ x: 12, y: 18 });

  useEffect(() => {
    if (!mark) return;
    const move = () => setPos({ x: 5 + Math.random() * 60, y: 8 + Math.random() * 75 });
    move();
    const id = setInterval(move, 15_000);
    return () => clearInterval(id);
  }, [mark]);

  if (!mark) return null;
  const tiles = dense ? 12 : 6;

  return (
    <div aria-hidden className={cn("pointer-events-none absolute inset-0 z-30 overflow-hidden select-none", className)}>
      <div className="absolute inset-0 grid grid-cols-2 content-around justify-items-center gap-y-16 opacity-[0.04] sm:grid-cols-3">
        {Array.from({ length: tiles }, (_, i) => (
          <span key={i} className="-rotate-[24deg] text-xs">
            <BrandMark text={mark} size={14} />
          </span>
        ))}
      </div>
      <span
        className="absolute text-[11px] opacity-[0.12] transition-all duration-1000 sm:text-xs"
        style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
      >
        <BrandMark text={mark} size={16} />
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------
// Қорғалған аймақ
// ---------------------------------------------------------------------
type Shield = null | "blur" | "devtools" | "key";

function isDesktop() {
  return typeof window !== "undefined" && window.matchMedia("(pointer: fine)").matches && window.innerWidth >= 1024;
}

export function Protected({ children, className }: { children: React.ReactNode; className?: string }) {
  const t = useTranslations("protection");
  const pathname = usePathname();
  const [shield, setShield] = useState<Shield>(null);
  const keyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const report = useCallback(
    (type: Parameters<typeof reportSecurityEvent>[0]["type"], detail?: string) => {
      void reportSecurityEvent({ type, path: pathname, detail });
    },
    [pathname],
  );

  const flash = useCallback(
    (type: "screenshot_key" | "print_attempt" | "save_attempt", detail: string) => {
      setShield("key");
      toast.warning(t("warning"));
      report(type, detail);
      if (keyTimer.current) clearTimeout(keyTimer.current);
      keyTimer.current = setTimeout(() => setShield((s) => (s === "key" ? null : s)), 3000);
    },
    [report, t],
  );

  // Пернелер
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      const key = e.key.toLowerCase();
      if (key === "printscreen") return flash("screenshot_key", "PrintScreen");
      if (mod && key === "p") {
        e.preventDefault();
        return flash("print_attempt", "Ctrl/Cmd+P");
      }
      if (mod && !e.shiftKey && key === "s") {
        e.preventDefault();
        return flash("save_attempt", "Ctrl/Cmd+S");
      }
      if (mod && e.shiftKey && ["s", "3", "4", "5"].includes(key)) {
        e.preventDefault();
        return flash("screenshot_key", `Shift+${key.toUpperCase()}`);
      }
      if (key === "f12" || (mod && e.shiftKey && ["i", "j", "c"].includes(key)) || (mod && key === "u")) {
        e.preventDefault();
        setShield("devtools");
        report("devtools_open", e.key);
      }
    };
    // PrintScreen көбіне тек keyup-та келеді
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === "PrintScreen") {
        flash("screenshot_key", "PrintScreen");
        navigator.clipboard?.writeText("").catch(() => {});
      }
    };
    window.addEventListener("keydown", onKey, true);
    window.addEventListener("keyup", onKeyUp, true);
    return () => {
      window.removeEventListener("keydown", onKey, true);
      window.removeEventListener("keyup", onKeyUp, true);
    };
  }, [flash, report]);

  // Басқа терезеге/қолданбаға ауысу
  useEffect(() => {
    const hide = () => setShield((s) => s ?? "blur");
    const show = () => setShield((s) => (s === "blur" ? null : s));
    const onVisibility = () => (document.hidden ? hide() : show());
    window.addEventListener("blur", hide);
    window.addEventListener("focus", show);
    document.addEventListener("visibilitychange", onVisibility);
    const onPrint = () => report("print_attempt", "beforeprint");
    window.addEventListener("beforeprint", onPrint);
    return () => {
      window.removeEventListener("blur", hide);
      window.removeEventListener("focus", show);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("beforeprint", onPrint);
    };
  }, [report]);

  // DevTools эвристикасы (тек компьютерде): терезе мен көрінетін аймақ айырмасы үлкен болса — бүйірде/астында панель ашық
  useEffect(() => {
    if (!isDesktop()) return;
    let reported = false;
    const check = () => {
      const open = window.outerWidth - window.innerWidth > 200 || window.outerHeight - window.innerHeight > 240;
      setShield((s) => (open ? "devtools" : s === "devtools" ? null : s));
      if (open && !reported) {
        reported = true;
        report("devtools_open", "size-heuristic");
      }
    };
    check();
    const id = setInterval(check, 2000);
    window.addEventListener("resize", check);
    return () => {
      clearInterval(id);
      window.removeEventListener("resize", check);
    };
  }, [report]);

  const block = (e: React.SyntheticEvent) => e.preventDefault();
  const onCopy = (e: React.ClipboardEvent) => {
    // Жауап енгізетін өрістердегі мәтінге кедергі жасамаймыз
    if ((e.target as HTMLElement).closest("input, textarea")) return;
    e.preventDefault();
    report("copy_attempt");
  };

  return (
    <div
      className={cn("protected relative", className)}
      data-shield={shield ?? undefined}
      onCopy={onCopy}
      onCut={onCopy}
      onContextMenu={block}
      onDragStart={block}
    >
      <div className="protected-content transition-[filter] duration-150">{children}</div>
      <Watermark dense />
      {/* Ата-элементтерде transform болса да бүкіл экранды жабу үшін — body-ге портал */}
      {shield &&
        createPortal(
        <div className="fixed inset-0 z-[75] grid place-items-center bg-background/60 p-6 text-center backdrop-blur-xl" role="alert">
          <div className="max-w-sm rounded-3xl bg-card p-6 shadow-2xl">
            {shield === "devtools" ? (
              <ShieldAlert className="mx-auto mb-3 size-10 text-danger" aria-hidden />
            ) : (
              <EyeOff className="mx-auto mb-3 size-10 text-primary" aria-hidden />
            )}
            <p className="font-bold">{t(shield === "devtools" ? "devtoolsTitle" : shield === "key" ? "keyTitle" : "blurTitle")}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {t(shield === "devtools" ? "devtoolsText" : shield === "key" ? "keyText" : "blurText")}
            </p>
          </div>
        </div>,
          document.body,
        )}
    </div>
  );
}
