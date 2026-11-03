"use client";

import { useState } from "react";
import { CameraCheck } from "@/components/mock/proctor";
import { Button } from "@/components/ui/button";

/** Прокторинг: сынақ алдындағы камера тексеру (тек dev) */
export function ProctorDemo() {
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState(false);
  if (!open) {
    return (
      <div className="space-y-2">
        <Button variant="outline" onClick={() => setOpen(true)}>
          Камера тексеруін ашу
        </Button>
        {done && <p className="text-sm text-success">«Сынақты бастау» басылды</p>}
      </div>
    );
  }
  return (
    <div className="max-w-lg">
      <CameraCheck
        pending={false}
        onReady={() => {
          setDone(true);
          setOpen(false);
        }}
        onCancel={() => setOpen(false)}
      />
    </div>
  );
}
