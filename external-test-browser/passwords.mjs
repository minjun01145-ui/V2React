import { app, safeStorage } from "electron";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export function loginScope(url) {
  const parsed = new URL(url);
  return JSON.stringify([parsed.origin, (parsed.searchParams.get("tenant") || "minjun").trim().toLowerCase()]);
}

function filePath(index, url) {
  const key = createHash("sha256").update(`${index}:${loginScope(url)}`).digest("hex");
  return join(app.getPath("userData"), "remembered-logins", `${key}.bin`);
}

function validateLogin(index, raw) {
  if (!raw || typeof raw !== "object") throw new Error("Invalid login");
  if (index === 0) {
    if (typeof raw.password !== "string" || !raw.password || raw.password.length > 4096
      || typeof raw.email !== "string" || raw.email.length > 320) throw new Error("Invalid teacher login");
    return { email: raw.email.trim(), password: raw.password };
  }
  if (typeof raw.studentNumber !== "string" || typeof raw.name !== "string" || typeof raw.pin !== "string") throw new Error("Invalid student login");
  const studentNumber = raw.studentNumber.normalize("NFKC").trim();
  const name = raw.name.normalize("NFKC").trim().replace(/\s+/g, " ");
  const pin = raw.pin.normalize("NFKC").trim();
  if (!/^\d{1,12}$/.test(studentNumber) || !name || name.length > 30 || !/^\d{4}$/.test(pin)) throw new Error("Invalid student login");
  return { studentNumber, name, pin };
}

export function readLogin(index, url) {
  const path = filePath(index, url);
  if (!existsSync(path)) return null;
  if (!safeStorage.isEncryptionAvailable()) throw new Error("Encryption unavailable");
  return validateLogin(index, JSON.parse(safeStorage.decryptString(readFileSync(path))));
}

export function saveLogin(index, url, raw) {
  const login = validateLogin(index, raw);
  if (!safeStorage.isEncryptionAvailable()) throw new Error("Encryption unavailable");
  // Passwords never go in config.json, page storage, logs, or the game's server.
  const encrypted = safeStorage.encryptString(JSON.stringify(login));
  const path = filePath(index, url);
  mkdirSync(join(app.getPath("userData"), "remembered-logins"), { recursive: true });
  writeFileSync(`${path}.tmp`, encrypted);
  renameSync(`${path}.tmp`, path);
  return login;
}
