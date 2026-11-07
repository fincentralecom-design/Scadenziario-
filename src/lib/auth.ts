// Accesso con utente e password e sessione firmata in un cookie.
// Funziona sia nel middleware (edge) sia nelle API (Node): usa solo Web Crypto.

export const SESSION_COOKIE = "sg_session";
export const SESSION_DAYS = 30;

const DEFAULT_USER = "greco";
/** SHA-256 della password predefinita: si cambia con la variabile APP_PASSWORD su Netlify. */
const DEFAULT_PASSWORD_SHA256 = "2c5e0ea84f49409925ff780cdfc06ccdcf47ed10b2ab4f85853f8db6f7cd607f";

const enc = new TextEncoder();

export function authDisabled(): boolean {
  return process.env.AUTH_DISABLED === "1";
}

export function configuredUser(): string {
  return (process.env.APP_USERNAME || DEFAULT_USER).trim().toLowerCase();
}

async function sha256Hex(s: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", enc.encode(s));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function checkCredentials(user: string, password: string): Promise<boolean> {
  const userOk = safeEqual(user.trim().toLowerCase(), configuredUser());
  const envPass = process.env.APP_PASSWORD;
  const passOk = envPass ? safeEqual(password, envPass) : safeEqual(await sha256Hex(password), DEFAULT_PASSWORD_SHA256);
  return userOk && passOk;
}

/** Chiave di firma: segreto dedicato se presente, altrimenti derivata da altri segreti del sito. */
function signingKey(): string {
  return (
    process.env.SESSION_SECRET ||
    process.env.CRON_SECRET ||
    process.env.MAGIC_LINK_SECRET ||
    process.env.BUILD_SECRET ||
    `fallback:${configuredUser()}:${process.env.APP_PASSWORD || DEFAULT_PASSWORD_SHA256}`
  );
}

async function hmac(data: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", enc.encode(signingKey()), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode(data)));
  let bin = "";
  sig.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export async function createSession(): Promise<{ value: string; maxAge: number }> {
  const maxAge = SESSION_DAYS * 86_400;
  const payload = `${configuredUser()}.${Math.floor(Date.now() / 1000) + maxAge}`;
  return { value: `${payload}.${await hmac(payload)}`, maxAge };
}

export async function verifySession(value: string | undefined): Promise<boolean> {
  if (!value) return false;
  const i = value.lastIndexOf(".");
  if (i < 0) return false;
  const payload = value.slice(0, i);
  const [user, exp] = payload.split(".");
  if (user !== configuredUser() || !(Number(exp) > Date.now() / 1000)) return false;
  return safeEqual(value.slice(i + 1), await hmac(payload));
}
