import { app, BrowserWindow } from "electron";
import assert from "node:assert/strict";
import { resolve } from "node:path";
import { mkdir, writeFile } from "node:fs/promises";
import { createServer } from "../../node_modules/vite/dist/node/index.js";

app.on("window-all-closed", () => {});
const root = resolve(import.meta.dirname, "../..");
// The real page and panel render; only the Firestore subscription is stubbed with fixed opinions.
const OPINIONS_STUB = String.raw`
const now = Date.parse("2026-10-14T03:00:00Z");
export function subscribeOpinions(roomId, onValue) {
  window.subscribedRoom = roomId;
  onValue([
    { id: "op-2", text: "급식이 맛있어요", createdAtMs: now },
    { id: "op-1", text: "숙제가 많아요. 수학은 조금 어려워요", createdAtMs: now - 3_600_000 },
  ]);
  return () => {};
}
export async function deleteOpinion() {}
export async function submitOpinion() {}
`;

const fixture = String.raw`<!doctype html><html lang="ko"><meta charset="utf-8"><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;700&display=swap"><body style="margin:0"><div id="app"></div>
<script type="module">
import React from 'react';
import { createRoot } from 'react-dom/client';
import TeacherOpinionsPage from '/src/features/teacher/opinions/TeacherOpinionsPage.tsx';
import { PopupProvider } from '/src/shared/popup/index.ts';
import '/src/styles/tokens.css';
createRoot(document.querySelector('#app')).render(React.createElement(PopupProvider, null, React.createElement(TeacherOpinionsPage, { roomId: 'main-class' })));
window.ready = true;
</script></body></html>`;

let server, window;
async function evaluate(code) {
  try { return await window.webContents.executeJavaScript(code, true); }
  catch (error) { throw new Error(`Browser expression failed: ${code}`, { cause: error }); }
}
async function until(code, label) {
  const deadline = Date.now() + 60000;
  while (!await evaluate(`Boolean(${code})`)) {
    if (Date.now() > deadline) throw new Error(`Timed out: ${label}`);
    await new Promise(resolve => setTimeout(resolve, 50));
  }
}
async function screenshot(name) {
  await new Promise(resolve => setTimeout(resolve, 200));
  const bounds = await evaluate(`(() => { const r = document.querySelector('#app').getBoundingClientRect(); return { x: 0, y: 0, width: Math.ceil(r.width), height: Math.ceil(r.height) }; })()`);
  const image = await window.webContents.capturePage(bounds);
  const dir = process.env.OPINIONS_SCREENSHOT_DIR || resolve(root, "node_modules/.cache/opinions-screenshots");
  await mkdir(dir, { recursive: true });
  const path = resolve(dir, `${name}.png`);
  await writeFile(path, image.toPNG());
  console.log(`SCREENSHOT ${path}`);
}

let exitCode = 0;
async function run() {
  try {
    await app.whenReady();
    server = await createServer({ root, server: { host: "127.0.0.1", port: 0 }, plugins: [{
      name: "opinions-test-fixture",
      load(id) {
        if (id.split("?")[0].endsWith("/student-opinions/repository.ts")) return OPINIONS_STUB;
      },
      configureServer(vite) {
        vite.middlewares.use(async (request, response, next) => {
          if (request.url !== "/__opinions-test") return next();
          try { response.setHeader("Content-Type", "text/html"); response.end(await vite.transformIndexHtml("/__opinions-test", fixture)); }
          catch (error) { next(error); }
        });
      },
    }] });
    await server.listen();
    window = new BrowserWindow({ show: false, width: 1100, height: 900, webPreferences: { contextIsolation: true, nodeIntegration: false, backgroundThrottling: false } });
    window.webContents.on("console-message", (event) => { if (event.level === "error") console.error("BROWSER:", event.message); });
    await window.loadURL(`${server.resolvedUrls.local[0]}__opinions-test`);

    // The moved feature renders on the menu page, not on the lobby, and the teacher's screen
    // shows only text and time.
    await until(`document.querySelector('h1')?.textContent === '학생 의견'`, "the opinions page mounts");
    assert.equal(await evaluate("window.subscribedRoom"), "main-class", "the page reads the room's opinions");
    const texts = await evaluate("Array.from(document.querySelectorAll('ol li p')).map(item => item.textContent)");
    assert.deepEqual(texts, ["급식이 맛있어요", "숙제가 많아요. 수학은 조금 어려워요"], "both opinions are shown");
    assert.equal(await evaluate("document.querySelectorAll('ol li time').length"), 2, "each opinion shows when it was left");
    assert.equal(await evaluate("Array.from(document.querySelectorAll('button')).filter(button => button.textContent.trim() === '삭제').length"), 2, "each opinion can be deleted");
    await screenshot("teacher-opinions-page");
    console.log("teacher opinions page browser tests passed");
  } catch (error) {
    exitCode = 1;
    console.error(error);
  } finally {
    window?.destroy();
    await server?.close();
    app.exit(exitCode);
  }
}

void run();
