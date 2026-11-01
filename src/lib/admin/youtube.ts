// YouTube сілтемесінен 11 таңбалы видео ID-ін алу (клиентте де, серверде де қолданылады).

const ID_RE = /^[A-Za-z0-9_-]{11}$/;

/** «https://youtu.be/ID», «watch?v=ID», «/embed/ID», «/shorts/ID», «/live/ID» немесе тек ID. Танылмаса — null. */
export function parseYoutubeId(input: string): string | null {
  const value = input.trim();
  if (ID_RE.test(value)) return value;
  let url: URL;
  try {
    url = new URL(value.startsWith("http") ? value : `https://${value}`);
  } catch {
    return null;
  }
  const host = url.hostname.replace(/^(www\.|m\.|music\.)/, "");
  let id: string | null = null;
  if (host === "youtu.be") id = url.pathname.slice(1).split("/")[0];
  else if (host === "youtube.com" || host === "youtube-nocookie.com") {
    id = url.searchParams.get("v") ?? url.pathname.match(/^\/(?:embed|shorts|live|v)\/([^/?#]+)/)?.[1] ?? null;
  }
  return id && ID_RE.test(id) ? id : null;
}
