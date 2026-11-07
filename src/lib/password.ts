// Password modificabile dall'app (salvata cifrata con scrypt) e recupero tramite email.
import "server-only";
import { createHash, randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { checkCredentials, configuredUser } from "./auth";
import { getStore } from "./store";

const HASH_KEY = "auth_password";
const RESET_KEY = "auth_reset";

export const MIN_PASSWORD = 8;

function scrypt(pwd: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => scryptCb(pwd, salt, 32, (err, key) => (err ? reject(err) : resolve(key))));
}

async function hashPassword(pwd: string): Promise<string> {
  const salt = randomBytes(16);
  return `scrypt$${salt.toString("base64")}$${(await scrypt(pwd, salt)).toString("base64")}`;
}

async function verifyHash(pwd: string, stored: string): Promise<boolean> {
  const [, s, h] = stored.split("$");
  if (!s || !h) return false;
  const hash = await scrypt(pwd, Buffer.from(s, "base64"));
  const expected = Buffer.from(h, "base64");
  return expected.length === hash.length && timingSafeEqual(expected, hash);
}

/** Verifica le credenziali: prima la password cambiata dall'app, altrimenti quella iniziale. */
export async function checkLogin(user: string, password: string): Promise<boolean> {
  const stored = await getStore().getKV<string>(HASH_KEY);
  if (!stored) return checkCredentials(user, password);
  const passOk = await verifyHash(password, stored);
  return passOk && user.trim().toLowerCase() === configuredUser();
}

export async function setPassword(next: string): Promise<void> {
  if (next.length < MIN_PASSWORD) throw new Error(`La password deve avere almeno ${MIN_PASSWORD} caratteri`);
  await getStore().setKV(HASH_KEY, await hashPassword(next));
  await getStore().setKV(RESET_KEY, null);
}

const sha = (s: string) => createHash("sha256").update(s).digest("hex");

interface ResetRecord {
  hash: string;
  exp: number;
  created: number;
}

/** Crea un codice di recupero valido 1 ora (salvato solo come impronta). Massimo una richiesta al minuto. */
export async function createResetToken(): Promise<string | null> {
  const prev = await getStore().getKV<ResetRecord | null>(RESET_KEY);
  if (prev && Date.now() - prev.created < 60_000) return null;
  const token = randomBytes(24).toString("base64url");
  await getStore().setKV<ResetRecord>(RESET_KEY, { hash: sha(token), exp: Date.now() + 60 * 60_000, created: Date.now() });
  return token;
}

export async function isValidResetToken(token: string): Promise<boolean> {
  const rec = await getStore().getKV<ResetRecord | null>(RESET_KEY);
  if (!rec || rec.exp < Date.now() || !token) return false;
  const a = Buffer.from(rec.hash);
  const b = Buffer.from(sha(token));
  return a.length === b.length && timingSafeEqual(a, b);
}
