"use client";

import { useState } from "react";
import { Delete } from "lucide-react";
import { cn } from "@/lib/utils";

type Op = "+" | "−" | "×" | "÷";

function apply(a: number, b: number, op: Op) {
  switch (op) {
    case "+":
      return a + b;
    case "−":
      return a - b;
    case "×":
      return a * b;
    case "÷":
      return b === 0 ? NaN : a / b;
  }
}

/** Ұзын бөлшектерді қысқарту: 0.1 + 0.2 = 0.3 */
function format(n: number) {
  if (!Number.isFinite(n)) return "Қате";
  return String(Number.parseFloat(n.toPrecision(12)));
}

/** Сынақ кезіндегі қарапайым калькулятор (ҰБТ-дағыдай: 4 амал, түбір, пайыз). */
export function Calculator() {
  const [display, setDisplay] = useState("0");
  const [stored, setStored] = useState<{ value: number; op: Op } | null>(null);
  const [fresh, setFresh] = useState(true);

  const current = () => Number(display.replace(",", "."));

  const digit = (d: string) => {
    if (display === "Қате" || fresh) {
      setDisplay(d === "." ? "0." : d);
      setFresh(false);
      return;
    }
    if (d === "." && display.includes(".")) return;
    if (display.replace(/[-.]/g, "").length >= 14) return;
    setDisplay(display === "0" && d !== "." ? d : display + d);
  };

  const operator = (op: Op) => {
    const value = stored && !fresh ? apply(stored.value, current(), stored.op) : current();
    setDisplay(format(value));
    setStored({ value, op });
    setFresh(true);
  };

  const equals = () => {
    if (!stored) return;
    setDisplay(format(apply(stored.value, current(), stored.op)));
    setStored(null);
    setFresh(true);
  };

  const unary = (fn: (n: number) => number) => {
    setDisplay(format(fn(current())));
    setFresh(true);
  };

  const clear = () => {
    setDisplay("0");
    setStored(null);
    setFresh(true);
  };

  const back = () => {
    if (fresh || display === "Қате") return;
    setDisplay(display.length > 1 ? display.slice(0, -1) : "0");
  };

  const key = "h-12 rounded-xl text-lg font-bold transition-colors active:scale-95";
  const keys: { label: React.ReactNode; on: () => void; tone?: "op" | "eq" | "muted"; aria?: string }[] = [
    { label: "C", on: clear, tone: "muted" },
    { label: "√", on: () => unary((n) => (n < 0 ? NaN : Math.sqrt(n))), tone: "muted", aria: "Түбір" },
    { label: "%", on: () => unary((n) => n / 100), tone: "muted" },
    { label: "÷", on: () => operator("÷"), tone: "op" },
    { label: "7", on: () => digit("7") },
    { label: "8", on: () => digit("8") },
    { label: "9", on: () => digit("9") },
    { label: "×", on: () => operator("×"), tone: "op" },
    { label: "4", on: () => digit("4") },
    { label: "5", on: () => digit("5") },
    { label: "6", on: () => digit("6") },
    { label: "−", on: () => operator("−"), tone: "op" },
    { label: "1", on: () => digit("1") },
    { label: "2", on: () => digit("2") },
    { label: "3", on: () => digit("3") },
    { label: "+", on: () => operator("+"), tone: "op" },
    { label: <Delete className="mx-auto size-5" aria-hidden />, on: back, tone: "muted", aria: "Өшіру" },
    { label: "0", on: () => digit("0") },
    { label: ",", on: () => digit("."), aria: "Үтір" },
    { label: "=", on: equals, tone: "eq" },
  ];

  return (
    <div className="space-y-3">
      <output
        className="block truncate rounded-2xl bg-muted px-4 py-3 text-right font-mono text-3xl font-bold tabular-nums"
        aria-live="polite"
      >
        {display.replace(".", ",")}
      </output>
      <div className="grid grid-cols-4 gap-2">
        {keys.map((k, i) => (
          <button
            key={i}
            type="button"
            onClick={k.on}
            aria-label={k.aria}
            className={cn(
              key,
              k.tone === "op" && "bg-secondary text-primary hover:bg-secondary/70",
              k.tone === "eq" && "bg-brand-gradient text-white",
              k.tone === "muted" && "bg-muted text-muted-foreground hover:bg-muted/70",
              !k.tone && "border bg-card hover:bg-muted",
            )}
          >
            {k.label}
          </button>
        ))}
      </div>
    </div>
  );
}
