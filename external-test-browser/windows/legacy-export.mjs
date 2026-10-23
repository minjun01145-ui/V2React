import { app, safeStorage } from "electron";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

// One-time migration only. The native parent captures stdout in a private pipe
// and immediately encrypts the results with Windows DPAPI. Never run in a terminal.
const [profile, siteUrl] = process.argv.slice(2);
app.setPath("userData", profile);
app.setPath("sessionData", profile);
app.whenReady().then(() => {
  try {
    if (!safeStorage.isEncryptionAvailable()) throw new Error();
    const url = new URL(siteUrl);
    const scope = JSON.stringify([url.origin, (url.searchParams.get("tenant") || "minjun").trim().toLowerCase()]);
    const logins = [];
    for (let index = 0; index < 4; index++) {
      const key = createHash("sha256").update(`${index}:${scope}`).digest("hex");
      const path = join(profile, "remembered-logins", `${key}.bin`);
      if (existsSync(path)) logins.push({ index, login: JSON.parse(safeStorage.decryptString(readFileSync(path))) });
    }
    process.stdout.write(JSON.stringify({ logins }), () => app.exit(0));
  } catch {
    app.exit(1);
  }
});
