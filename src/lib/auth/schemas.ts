import { z } from "zod";

export const emailSchema = z.string().trim().toLowerCase().max(254).pipe(z.email());
export const passwordSchema = z.string().min(8).max(72);

export const signUpSchema = z.object({
  fullName: z.string().trim().min(2).max(100),
  email: emailSchema,
  password: passwordSchema,
  grade: z.enum(["10", "11", "graduate"]),
  locale: z.enum(["kk", "ru"]),
  // Әзірге жалғыз бейіндік жұп
  profilePair: z.literal("math_informatics"),
});

export const signInSchema = z.object({
  email: emailSchema,
  password: z.string().min(1).max(72),
  next: z.string().optional(),
});

export const resetRequestSchema = z.object({ email: emailSchema });

export const newPasswordSchema = z
  .object({ password: passwordSchema, confirm: z.string() })
  .refine((v) => v.password === v.confirm, { path: ["confirm"], message: "password_mismatch" });

export const changePasswordSchema = z
  .object({ current: z.string().min(1).max(72), password: passwordSchema, confirm: z.string() })
  .refine((v) => v.password === v.confirm, { path: ["confirm"], message: "password_mismatch" });

/** Форма күйі (useActionState). `error` — messages/*.json → auth.errors.<key> */
export type FormState = {
  error?: AuthErrorKey;
  ok?: boolean;
  /** Қате болғанда формадағы мәндерді қайтару үшін (құпиясөзден басқасы) */
  values?: Record<string, string>;
};

export type AuthErrorKey =
  | "invalid_input"
  | "invalid_credentials"
  | "email_not_confirmed"
  | "rate_limited"
  | "not_configured"
  | "password_mismatch"
  | "weak_password"
  | "same_password"
  | "session_expired"
  | "email_taken"
  | "wrong_current"
  | "unknown";
