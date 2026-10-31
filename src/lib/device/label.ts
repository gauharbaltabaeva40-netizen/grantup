/** User-Agent-тен адамға түсінікті атау: «Chrome · Android», «Safari · iPhone». */
export function deviceLabel(userAgent: string | null | undefined): string {
  const ua = userAgent ?? "";

  const os =
    /iPhone/.test(ua) ? "iPhone"
    : /iPad/.test(ua) ? "iPad"
    : /Android/.test(ua) ? "Android"
    : /Windows/.test(ua) ? "Windows"
    : /Mac OS X|Macintosh/.test(ua) ? "macOS"
    : /CrOS/.test(ua) ? "ChromeOS"
    : /Linux/.test(ua) ? "Linux"
    : "?";

  const browser =
    /YaBrowser/.test(ua) ? "Yandex"
    : /Edg\//.test(ua) ? "Edge"
    : /OPR\/|Opera/.test(ua) ? "Opera"
    : /SamsungBrowser/.test(ua) ? "Samsung Internet"
    : /Firefox|FxiOS/.test(ua) ? "Firefox"
    : /Chrome|CriOS/.test(ua) ? "Chrome"
    : /Safari/.test(ua) ? "Safari"
    : "Browser";

  return `${browser} · ${os}`;
}
