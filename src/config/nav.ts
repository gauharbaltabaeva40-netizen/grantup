import { BookOpen, ClipboardCheck, House, Trophy, UserRound, type LucideIcon } from "lucide-react";

export type NavItem = {
  href: string;
  /** messages/*.json → nav.<labelKey> */
  labelKey: "home" | "lessons" | "mockExam" | "league" | "profile";
  icon: LucideIcon;
};

// Телефондағы төменгі панель мен компьютердегі бүйір мәзір осы тізімді қолданады.
export const mainNav: NavItem[] = [
  { href: "/", labelKey: "home", icon: House },
  { href: "/lessons", labelKey: "lessons", icon: BookOpen },
  { href: "/mock-exam", labelKey: "mockExam", icon: ClipboardCheck },
  { href: "/league", labelKey: "league", icon: Trophy },
  { href: "/profile", labelKey: "profile", icon: UserRound },
];

export function isNavActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}
