import { BottomNav } from "./bottom-nav";
import { Sidebar } from "./sidebar";
import { TopBar } from "./top-bar";

/** Телефонда: жоғарғы жолақ + төменгі навигация. Компьютерде (lg+): сол жақ бүйір мәзір. */
export function AppShell({ children }: { children: React.ReactNode }) {
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
    </div>
  );
}
