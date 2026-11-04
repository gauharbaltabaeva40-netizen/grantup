// grantup.kz → Қазақстандағы nginx прокси → Vercel (deploy/kz-proxy).
// Прокси әр сұранысқа құпия кілт пен оқушының нақты IP-ін қосады. Кілт сәйкес келмесе, тақырыптарға сенбейміз
// (әйтпесе кез келген адам IP-ін өзгертіп, rate limit-ті айналып өте алар еді).

export const PROXY_SECRET_HEADER = "x-gu-proxy-secret";
export const PROXY_CLIENT_IP_HEADER = "x-gu-client-ip";

/** Тұрақты уақытта салыстыру (құпияны уақыт бойынша табу мүмкін болмасын) */
function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Сұраныс біздің прокси арқылы келді ме (PROXY_SHARED_SECRET қойылмаса — әрқашан жоқ) */
export function isTrustedProxy(headers: Headers) {
  const secret = process.env.PROXY_SHARED_SECRET;
  const given = headers.get(PROXY_SECRET_HEADER);
  return Boolean(secret && secret.length >= 32 && given && safeEqual(given, secret));
}
