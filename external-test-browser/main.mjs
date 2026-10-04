import { app, dialog } from "electron";
import { readFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { createBrowser } from "./browser.mjs";
import { parseSettings } from "./settings.mjs";

// Sessions and encrypted logins stay local and are excluded from Git.
// CONSOLE_VARIANT (e.g. "hana") selects config.<variant>.json and a separate profile so consoles can run side by side.
const variant = process.env.CONSOLE_VARIANT?.trim();
const profilePath = join(import.meta.dirname, variant ? `.profile-${variant}` : ".profile");
mkdirSync(profilePath, { recursive: true });
app.setPath("userData", profilePath);
app.setPath("sessionData", profilePath);
app.commandLine.appendSwitch("lang", "ko-KR");

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  let browser;
  app.on("second-instance", () => {
    if (!browser) return;
    if (browser.window.isMinimized()) browser.window.restore();
    browser.window.show();
    browser.window.focus();
  });
  app.whenReady().then(() => {
    try {
      const config = JSON.parse(readFileSync(join(import.meta.dirname, variant ? `config.${variant}.json` : "config.json"), "utf8").replace(/^\uFEFF/, ""));
      browser = createBrowser(parseSettings(config));
    } catch (error) {
      dialog.showErrorBox("테스트 브라우저를 열지 못했습니다", error.message);
      app.quit();
    }
  });
}
app.on("window-all-closed", () => app.quit());
