import { BookOpen, CalendarDays, ClipboardCheck, House, ListChecks, RotateCcw, Swords, Trophy, UserRound, type LucideIcon } from "lucide-react";

export type NavItem = {
  href: string;
  /** messages/*.json → nav.<labelKey> */
  labelKey: "home" | "lessons" | "mockExam" | "league" | "profile" | "practice" | "mistakes" | "plan" | "duel";
  icon: LucideIcon;
  /** Бұл пункт белсенді болатын қосымша бөлімдер */
  also?: string[];
};

// Телефондағы төменгі панель мен компьютердегі бүйір мәзір осы тізімді қолданады.
export const mainNav: NavItem[] = [
  { href: "/", labelKey: "home", icon: House },
  { href: "/lessons", labelKey: "lessons", icon: BookOpen, also: ["/practice"] },
  { href: "/mock-exam", labelKey: "mockExam", icon: ClipboardCheck },
  { href: "/league", labelKey: "league", icon: Trophy },
  { href: "/profile", labelKey: "profile", icon: UserRound },
];

// Тек компьютердегі бүйір мәзірде (телефонда — «Сабақтар» бетінен кіреді)
export const secondaryNav: NavItem[] = [
  { href: "/plan", labelKey: "plan", icon: CalendarDays },
  { href: "/duel", labelKey: "duel", icon: Swords },
  { href: "/practice", labelKey: "practice", icon: ListChecks },
  { href: "/practice/mistakes", labelKey: "mistakes", icon: RotateCcw },
];

function matches(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

export function isNavActive(pathname: string, item: Pick<NavItem, "href" | "also">) {
  return matches(pathname, item.href) || (item.also ?? []).some((h) => matches(pathname, h));
}
