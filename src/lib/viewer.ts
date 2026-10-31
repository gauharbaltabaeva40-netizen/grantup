import "server-only";
import { cache } from "react";
import { getCurrentProfile } from "@/lib/auth/session";
import { demoStudent } from "@/lib/demo";
import { isSupabaseConfigured } from "@/lib/env";

export type Viewer = {
  name: string;
  email: string;
  role: "student" | "admin";
  xp: number;
  level: number;
  streak: number;
  targetScore: number | null;
  demo: boolean;
};

/** Интерфейске қажетті пайдаланушы деректері. Демо режимде (кілттер жоқ) — макет деректер. */
export const getViewer = cache(async (): Promise<Viewer | null> => {
  if (!isSupabaseConfigured) {
    return {
      name: demoStudent.name,
      email: "demo@grantup.kz",
      role: "student",
      xp: demoStudent.xp,
      level: demoStudent.level,
      streak: demoStudent.streak,
      targetScore: demoStudent.targetScore,
      demo: true,
    };
  }

  const profile = await getCurrentProfile();
  if (!profile) return null;

  return {
    name: profile.nickname || profile.full_name.split(" ")[0] || profile.email.split("@")[0],
    email: profile.email,
    role: profile.role,
    xp: profile.xp,
    level: profile.level,
    streak: profile.streak,
    targetScore: profile.target_score,
    demo: false,
  };
});
