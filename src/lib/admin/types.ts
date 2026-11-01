// Админ әрекеттерінің ортақ типтері (клиент компоненттері де импорттайды).

export type AdminErrorKey =
  | "forbidden"
  | "invalid_input"
  | "not_found"
  | "choose_device"
  | "in_use"
  | "duplicate"
  | "not_enough"
  | "unknown";

export type AdminResult<T = undefined> = { ok: true; data?: T } | { ok: false; error: AdminErrorKey; detail?: string };
