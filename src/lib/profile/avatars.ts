// Дайын аватарлар жинағы (profiles.avatar — эмодзи). Фото жүктеу жоқ — құпиялылық үшін.
export const AVATARS = ["🦊", "🐼", "🦉", "🐯", "🐺", "🦄", "🐬", "🦁", "🐧", "🐨", "🦅", "🐢", "🚀", "⭐", "📚", "🎯"] as const;

export function isAvatar(value: unknown): value is (typeof AVATARS)[number] {
  return typeof value === "string" && (AVATARS as readonly string[]).includes(value);
}
