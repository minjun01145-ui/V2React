import { app } from "electron";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdirSync, mkdtempSync } from "node:fs";
import { join, resolve } from "node:path";
import { once } from "node:events";
import { createBrowser } from "../browser.mjs";
import { parseSettings } from "../settings.mjs";

const testRoot = resolve(import.meta.dirname, "..", ".test-profile");
mkdirSync(testRoot, { recursive: true });
const profile = mkdtempSync(join(testRoot, "cache-browser-"));
app.setPath("userData", profile);
app.setPath("sessionData", profile);
app.on("window-all-closed", () => {});

let resourceRequests = 0;
const server = createServer((request, response) => {
  response.setHeader("Cache-Control", "public, max-age=31536000, immutable");
  if (request.url.startsWith("/cached-resource")) {
    resourceRequests++;
    response.end("cacheable resource");
  } else {
    response.setHeader("Content-Type", "text/html; charset=utf-8");
    response.end("<!doctype html><title>캐시 검증</title><h1>로컬 테스트</h1>");
  }
});

async function until(predicate, label) {
  const deadline = Date.now() + 15000;
  while (!(await predicate())) {
    if (Date.now() > deadline) throw new Error(`Timed out: ${label}`);
    await new Promise((resolve) => setTimeout(resolve, 40));
  }
}

async function ready(browser) {
  await until(() => browser.window.webContents.executeJavaScript("document.querySelectorAll('.enable').length === 4"), "shell ready");
  await browser.window.webContents.executeJavaScript("document.querySelectorAll('.enable').forEach((button, index) => { if (index) button.click(); })");
  await until(() => browser.state().panes.every((pane) => pane.status === "ready"), "four pages ready");
}

let browser;
async function run() {
  try {
    await app.whenReady();
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    const settings = parseSettings({ siteUrl: `http://127.0.0.1:${server.address().port}/` });
    browser = createBrowser(settings, { show: false, maximize: false });
    await ready(browser);
    for (const pane of browser.panes) {
      const contents = pane.view.webContents;
      for (let attempt = 0; attempt < 2; attempt++) {
        assert.equal(await contents.executeJavaScript(`fetch('/cached-resource?pane=${pane.index}').then(response => response.text())`), "cacheable resource");
      }
      assert.equal(await contents.session.getCacheSize(), 0);
      await contents.executeJavaScript(`localStorage.setItem('account', '${pane.index}')`);
      await contents.session.cookies.set({ url: settings.studentUrl, name: "account", value: String(pane.index) });
    }
    assert.equal(resourceRequests, 8);
    console.log("PASS: all four panes fetch cacheable resources from the server every time; HTTP disk caches stay empty");

    const closed = once(browser.window, "closed");
    browser.window.close();
    await closed;
    browser = createBrowser(settings, { show: false, maximize: false });
    await ready(browser);
    for (const pane of browser.panes) {
      const contents = pane.view.webContents;
      assert.equal(await contents.executeJavaScript("localStorage.getItem('account')"), String(pane.index));
      const cookies = await contents.session.cookies.get({ url: settings.studentUrl, name: "account" });
      assert.equal(cookies[0].value, String(pane.index));
      assert.equal(await contents.session.getCacheSize(), 0);
    }
    console.log("PASS: disabling caches preserves independent login storage across browser reopen");
    browser.window.close();
    server.close();
    app.exit(0);
  } catch (error) {
    console.error(error);
    if (browser && !browser.window.isDestroyed()) browser.window.destroy();
    server.close();
    app.exit(1);
  }
}
void run();
