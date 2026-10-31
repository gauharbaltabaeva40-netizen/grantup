"use client";

import { AnimatePresence, motion } from "framer-motion";

type XpBurstProps = {
  /** Әр жаңа мән (мысалы, Date.now()) анимацияны қайта іске қосады; null — жасырын */
  burstKey: number | null;
  amount: number;
};

/** Дұрыс жауаптан кейін «+10 XP» жоғары ұшып шығады. Ата-элементке `relative` керек. */
export function XpBurst({ burstKey, amount }: XpBurstProps) {
  return (
    <AnimatePresence>
      {burstKey !== null && (
        <motion.span
          key={burstKey}
          aria-live="polite"
          className="pointer-events-none absolute left-1/2 top-0 z-10 -translate-x-1/2 rounded-full bg-success px-3 py-1 text-sm font-extrabold whitespace-nowrap text-white shadow-lg"
          initial={{ opacity: 0, y: 0, scale: 0.8 }}
          animate={{ opacity: [0, 1, 1, 0], y: -48, scale: 1 }}
          transition={{ duration: 1.1, ease: "easeOut", times: [0, 0.15, 0.7, 1] }}
        >
          +{amount} XP
        </motion.span>
      )}
    </AnimatePresence>
  );
}
