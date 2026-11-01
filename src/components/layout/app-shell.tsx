import { getLocale } from "next-intl/server";
import { Celebrations } from "@/components/gamification/celebrations";
import { getCelebrations } from "@/lib/gamification/data";
import { isSupabaseConfigured } from "@/lib/env";
import { BottomNav } from "./bottom-nav";
import { Sidebar } from "./sidebar";
import { TopBar } from "./top-bar";

/** Телефонда: жоғарғы жолақ + төменгі навигация. Компьютерде (lg+): сол жақ бүйір мәзір. */
export async function AppShell({ children }: { children: React.ReactNode }) {
  const celebrations = isSupabaseConfigured ? await getCelebrations(await getLocale()) : null;

  return (
    <div className="min-h-dvh">
      <Sidebar className="fixed inset-y-0 left-0 z-40 hidden w-64 lg:flex" />
      <div className="lg:pl-64">
        <TopBar />
        <main className="mx-auto max-w-5xl px-4 pt-4 pb-[calc(6rem+env(safe-area-inset-bottom))] lg:px-8 lg:pb-12">
          {children}
        </main>
      </div>
      <BottomNav className="lg:hidden" />
      {celebrations && <Celebrations data={celebrations} />}
    </div>
  );
}
