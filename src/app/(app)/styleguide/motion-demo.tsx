"use client";

import { useState } from "react";
import { toast } from "sonner";
import { XpBurst } from "@/components/motion/xp-burst";
import { Button } from "@/components/ui/button";

export function MotionDemo() {
  const [burst, setBurst] = useState<number | null>(null);

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="relative pt-12">
        <XpBurst burstKey={burst} amount={10} />
        <Button
          size="xl"
          className="bg-success text-white hover:bg-success/90"
          onClick={() => setBurst(Date.now())}
        >
          Дұрыс жауап (+10 XP)
        </Button>
      </div>
      <div className="pt-12">
        <Button size="xl" variant="outline" onClick={() => toast.success("Сабақ аяқталды! +25 XP")}>
          Toast хабарлама
        </Button>
      </div>
    </div>
  );
}
