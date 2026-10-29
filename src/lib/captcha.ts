import { createHash, randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import sharp from "sharp";

const lifetime = 5 * 60_000;
const alphabet = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
export class CaptchaStore {
  private challenges = new Map<string, { hash: Buffer; expires: number; client: string }>();
  private clients = new Map<string, { count: number; expires: number }>();
  issue(answer: string, client: string, previous?: string, now = Date.now()) {
    for (const [key, value] of this.challenges) if (value.expires <= now) this.challenges.delete(key);
    for (const [key, value] of this.clients) if (value.expires <= now) this.clients.delete(key);
    const bucket = this.clients.get(client);
    if ((bucket?.count ?? 0) >= 20 || this.challenges.size >= 5000 || (!bucket && this.clients.size >= 5000)) return null;
    this.clients.set(client, { count: (bucket?.count ?? 0) + 1, expires: bucket?.expires ?? now + 60_000 });
    if (previous) this.challenges.delete(previous);
    const token = randomBytes(32).toString("hex");
    this.challenges.set(token, { hash: createHash("sha256").update(answer).digest(), expires: now + lifetime, client });
    return token;
  }
  consume(token: string, answer: unknown, client: string, now = Date.now()) {
    const challenge = this.challenges.get(token);
    this.challenges.delete(token);
    if (!challenge || challenge.expires <= now || challenge.client !== client || typeof answer !== "string" || !/^[a-z0-9]{6}$/i.test(answer)) return false;
    return timingSafeEqual(challenge.hash, createHash("sha256").update(answer.toUpperCase()).digest());
  }
}
const state = globalThis as typeof globalThis & { careopsCaptcha?: CaptchaStore };
export const captchaStore = state.careopsCaptcha ??= new CaptchaStore();
export const captchaCookie = "careops_captcha";
export const captchaCookieOptions = { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict" as const, path: "/api/auth", maxAge: lifetime / 1000 };
export async function newCaptcha(client: string, previous?: string) {
  const answer = Array.from({ length: 6 }, () => alphabet[randomInt(alphabet.length)]).join("");
  const token = captchaStore.issue(answer, client, previous);
  if (!token) return null;
  const letters = [...answer].map((letter, index) => `<text x="${23 + index * 29}" y="${37 + randomInt(-4, 5)}" transform="rotate(${randomInt(-15, 16)} ${23 + index * 29} 30)" font-family="sans-serif" font-weight="700" font-size="29" fill="#145e66">${letter}</text>`).join("");
  const lines = Array.from({ length: 7 }, () => `<path d="M0 ${randomInt(56)} Q100 ${randomInt(56)} 210 ${randomInt(56)}" stroke="#7ab6b4" opacity=".55" fill="none"/>`).join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="210" height="56"><rect width="210" height="56" rx="10" fill="#edf7f5"/>${letters}${lines}</svg>`;
  const image = await sharp(Buffer.from(svg)).png().toBuffer();
  return { token, image: `data:image/png;base64,${image.toString("base64")}` };
}
