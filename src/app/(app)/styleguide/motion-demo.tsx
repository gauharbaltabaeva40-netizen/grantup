"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Celebrations } from "@/components/gamification/celebrations";
import { XpBurst } from "@/components/motion/xp-burst";
import { Button } from "@/components/ui/button";

export function MotionDemo() {
  const [burst, setBurst] = useState<number | null>(null);
  const [celebrate, setCelebrate] = useState(0);

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
        <Button size="xl" variant="outline" onClick={() => setCelebrate(Date.now())}>
          Мерекелеу (деңгей, streak, жетістік)
        </Button>
        {celebrate > 0 && (
          <Celebrations
            key={celebrate}
            data={{
              levelUp: { level: 3, name: "Талапкер" },
              streak: 7,
              achievements: [{ code: "streak_7", title: "7 күндік streak", description: "7 күн қатарынан оқыдыңыз", icon: "flame", xp: 50 }],
            }}
          />
        )}
      </div>
      <div className="pt-12">
        <Button size="xl" variant="outline" onClick={() => toast.success("Сабақ аяқталды! +25 XP")}>
          Toast хабарлама
        </Button>
      </div>
    </div>
  );
}
