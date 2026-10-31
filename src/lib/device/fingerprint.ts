// Браузер жағы: тұрақты құрылғы идентификаторы.
// 1) localStorage-тегі кездейсоқ ID (негізгі белгі)
// 2) фингерпринт — браузер/экран/уақыт белдеуі/canvas т.б. хэші (localStorage тазаланса, құрылғыны қайта тану үшін)
// Фингерпринт 100% бірегей емес — ол тек қосымша белгі; шешімді сервер қабылдайды.

const STORAGE_KEY = "gu_device_id";

export type DeviceIdentity = { deviceKey: string; fingerprint: string };

function getOrCreateDeviceKey(): string {
  try {
    const existing = localStorage.getItem(STORAGE_KEY);
    if (existing && /^[a-f0-9-]{36}$/.test(existing)) return existing;
    const created = crypto.randomUUID();
    localStorage.setItem(STORAGE_KEY, created);
    return created;
  } catch {
    // Жеке режим / localStorage бұғатталған — сессия ішінде ғана тұрақты
    return crypto.randomUUID();
  }
}

export function storeDeviceKey(deviceKey: string) {
  try {
    localStorage.setItem(STORAGE_KEY, deviceKey);
  } catch {}
}

function canvasSignature(): string {
  try {
    const canvas = document.createElement("canvas");
    canvas.width = 220;
    canvas.height = 40;
    const ctx = canvas.getContext("2d");
    if (!ctx) return "";
    ctx.textBaseline = "top";
    ctx.font = "16px Arial";
    ctx.fillStyle = "#0047FF";
    ctx.fillRect(10, 5, 80, 20);
    ctx.fillStyle = "#7B3FF2";
    ctx.fillText("GrantUp ҰБТ ✓ 140", 4, 12);
    return canvas.toDataURL();
  } catch {
    return "";
  }
}

async function sha256(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function getDeviceIdentity(): Promise<DeviceIdentity> {
  const nav = navigator as Navigator & { deviceMemory?: number };
  const parts = [
    nav.userAgent,
    nav.platform,
    nav.language,
    nav.languages?.join(","),
    nav.hardwareConcurrency,
    nav.deviceMemory,
    nav.maxTouchPoints,
    `${screen.width}x${screen.height}x${screen.colorDepth}`,
    window.devicePixelRatio,
    Intl.DateTimeFormat().resolvedOptions().timeZone,
    canvasSignature(),
  ];

  return { deviceKey: getOrCreateDeviceKey(), fingerprint: await sha256(parts.join("|")) };
}
