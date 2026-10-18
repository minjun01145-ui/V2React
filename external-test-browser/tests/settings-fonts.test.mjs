import { app, BrowserWindow } from "electron";
import assert from "node:assert/strict";
import { resolve, dirname } from "node:path";
import { mkdir, writeFile } from "node:fs/promises";
import { createServer } from "../../node_modules/vite/dist/node/index.js";

app.on("window-all-closed", () => {});
const root = resolve(import.meta.dirname, "../..");
// Replace only external Auth/Firestore/Functions boundaries. Render the real apps,
// navigation, settings sections and student login; unrelated lesson pages stay unloaded.
const firestore = String.raw`
export const doc = (_db, ...parts) => parts.join('/');
export function onSnapshot(path, onValue) {
  const emit = () => onValue({ data: () => JSON.parse(localStorage.getItem(path) || 'null') });
  const changed = event => { if (event.key === path) emit(); };
  window.addEventListener('storage', changed);
  queueMicrotask(emit);
  return () => window.removeEventListener('storage', changed);
}
export async function setDoc(path, data, options) {
  if (window.failFontSave) throw new Error('저장 실패 테스트');
  localStorage.setItem(path, JSON.stringify(options?.merge ? { ...JSON.parse(localStorage.getItem(path) || '{}'), ...data } : data));
  window.dispatchEvent(new StorageEvent('storage', { key: path }));
}
`;
const ai = String.raw`
const settings = { provider:'ollama-cloud',baseUrl:'https://ollama.com/api',model:'gpt-oss:120b',temperature:0.3,maxOutputTokens:512,thinkingLevel:'off',timeoutSeconds:60,enabled:true,updatedAtMs:0,apiKeyConfigured:true };
export async function getAiProviderSettings() { return settings; }
export async function saveAiProviderSettings(data) { window.savedAi = data; return {...settings,...data,updatedAtMs:Date.now()}; }
export async function testAiProviderConnection() { return { models:['gpt-oss:120b'],latencyMs:10 }; }
export async function sendAiTestMessage() { return { reply:'테스트 응답',model:settings.model,latencyMs:10,promptTokenCount:5,outputTokenCount:3 }; }
`;
const fixture = (role) => `<!doctype html><html lang="ko"><meta charset="utf-8"><body><div id="root"></div><script type="module">
import React from 'react';
import { createRoot } from 'react-dom/client';
import App from '/src/apps/${role}/${role === "teacher" ? "TeacherApp" : "StudentApp"}.tsx';
import '/src/styles/tokens.css'; import '/src/styles/reset.css'; import '/src/styles/global.css';
createRoot(document.querySelector('#root')).render(React.createElement(App));
</script></body></html>`;
const unrelated = ["TeacherLobbyPage.tsx", "TeacherSetsPage.tsx", "TeacherStudentsPage.tsx", "TeacherOpinionsPage.tsx", "TeacherSlideShowPage.tsx", "/student/StudentPage.tsx"];
let server;
const windows = [];
const evaluate = (window, code) => window.webContents.executeJavaScript(code, true);
async function until(window, code, label) {
  const deadline = Date.now() + 60000;
  while (!await evaluate(window, `Boolean(${code})`)) {
    if (Date.now() > deadline) throw new Error(`Timed out: ${label}`);
    await new Promise(resolve => setTimeout(resolve, 50));
  }
}
const click = (window, label) => evaluate(window, `Array.from(document.querySelectorAll('button')).find(button=>button.textContent.trim()===${JSON.stringify(label)}).click()`);
async function chooseFont(window, family) {
  await evaluate(window, `(() => { const select=document.querySelector('[aria-label="시스템 폰트"]'); select.value=${JSON.stringify(family)}; select.dispatchEvent(new Event('change',{bubbles:true})); })()`);
}
const family = "getComputedStyle(document.body).fontFamily";
const key = "tenants/minjun/settings/appearance";
let exitCode = 0;
async function run() {
  try {
    await app.whenReady();
    server = await createServer({ root, server: { host: "127.0.0.1", port: 0 }, optimizeDeps: { exclude: ["firebase/firestore"] }, plugins: [{
      name: "settings-fonts-boundaries", enforce: "pre",
      resolveId(source) { if (source === "firebase/firestore") return "\0settings-firestore"; },
      load(id) {
        const file = id.split("?")[0].replaceAll("\\", "/");
        if (id === "\0settings-firestore") return firestore;
        if (file.endsWith("/firebase/firebaseClient.ts")) return "export const db = {};";
        if (file.endsWith("/auth/hooks.ts")) return "export const useAdminAuth=()=>({loading:false,error:null,value:{}}); export const useStudentAuth=()=>({loading:false,error:null,value:null});";
        if (file.endsWith("/auth/teacherAuth.ts")) return "export async function signInAdmin() {} export async function signOutAdmin() {}";
        if (file.endsWith("/auth/studentAuth.ts")) return "export async function clearStudentLogin() {} export async function prepareStudentLogin() {} export async function completeStudentLogin() {}";
        if (file.endsWith("/ai-admin/repository.ts")) return ai;
        if (file.endsWith("/student-data/cosmetics/shopRepository.ts")) return "export async function loadNextCharacterShop(){return {items:[],next:{week:'2026-10-19',excludedIds:[],forcedIds:[],prices:{}},nextFeaturedIds:[]};} export async function updateNextCharacterShop(){}";
        if (file.endsWith("/student-data/cosmetics/StudentCharacterProvider.tsx")) return "export function StudentCharacterProvider({children}) { return children; }";
        if (unrelated.some(name => file.endsWith(name))) return "export default function UnusedLessonPage(){return null;}";
      },
      configureServer(vite) {
        vite.middlewares.use(async (request, response, next) => {
          const pathname = request.url.split("?")[0];
          const role = pathname === "/__settings-fonts-teacher" ? "teacher" : pathname === "/__settings-fonts-student" ? "student" : null;
          if (!role) return next();
          try { response.setHeader("Content-Type", "text/html"); response.end(await vite.transformIndexHtml(pathname, fixture(role))); }
          catch (error) { next(error); }
        });
      },
    }] });
    await server.listen();
    const origin = server.resolvedUrls.local[0];
    async function open(role, suffix = "") {
      const window = new BrowserWindow({ show: false, width: 1440, height: 1050, webPreferences: { contextIsolation: true, nodeIntegration: false, backgroundThrottling: false } });
      windows.push(window);
      window.webContents.on("console-message", event => { if (event.level === "error") console.error("BROWSER:", event.message); });
      await window.loadURL(`${origin}__settings-fonts-${role}${suffix}`);
      return window;
    }
    const teacher = await open("teacher", "#/ai");
    const student = await open("student");
    const hana = await open("student", "?tenant=hana");
    await until(teacher, `document.querySelector('[aria-label="AI 설정"] input')`, "legacy AI route opens merged settings");
    await until(student, "document.querySelector('#student-number')", "real student login mounts");
    await until(hana, "document.querySelector('#student-number')", "secondary tenant login mounts");
    assert.equal(await evaluate(teacher, "document.querySelector('h1').textContent"), "설정");
    assert.deepEqual(await evaluate(teacher, `Array.from(document.querySelectorAll('nav[aria-label="교사용 메뉴"] a')).map(a=>a.textContent.trim()).filter(label=>label.includes('설정'))`), ["설정"], "one settings navigation link");
    assert.equal(await evaluate(teacher, `document.querySelector('a[aria-current="page"]').textContent`), "설정");
    await click(teacher, "연결 테스트");
    await until(teacher, "document.body.textContent.includes('연결 테스트') && document.body.textContent.includes('조회에 성공')", "existing AI connection behavior");
    await click(teacher, "보내기");
    await until(teacher, "document.body.textContent.includes('테스트 응답')", "existing AI messaging behavior");
    await click(teacher, "저장");
    await until(teacher, "window.savedAi", "existing AI save behavior");
    await click(teacher, "수업 설정");
    await until(teacher, "document.body.textContent.includes('다음 주 신상') && document.body.textContent.includes('기본 게임')", "old settings retained");
    await click(teacher, "테마 · 폰트");
    await until(teacher, `document.querySelector('[aria-label="시스템 폰트"]')`, "font settings opens");
    assert.equal(await evaluate(teacher, `document.querySelector('[aria-label="시스템 폰트"] option').textContent`), "테마 기본 폰트");
    const defaultFamily = await evaluate(student, family);
    await evaluate(teacher, `document.querySelector('[aria-label="시스템 폰트"]').focus()`);
    assert.equal(await evaluate(teacher, `document.querySelectorAll('link[href*="text="]').length`), 0, "opening the system picker does not load the whole catalog");
    await chooseFont(teacher, "'Jua', sans-serif");
    await until(teacher, `${family}.includes('Jua')`, "immediate teacher preview");
    assert.equal(await evaluate(student, family), defaultFamily, "unsaved preview is teacher-only");
    await evaluate(teacher, "window.failFontSave=true");
    await click(teacher, "저장");
    await until(teacher, "document.querySelector('[role=alert]')?.textContent.includes('저장 실패')", "save error shown");
    assert.equal(await evaluate(student, family), defaultFamily, "failed save is not applied to students");
    await evaluate(teacher, "window.failFontSave=false");
    await click(teacher, "저장");
    await until(student, `${family}.includes('Jua')`, "saved font reaches student login");
    assert.equal(await evaluate(hana, family), defaultFamily, "other tenant is unaffected");
    await student.loadURL(student.webContents.getURL());
    await until(student, `document.querySelector('#student-number') && ${family}.includes('Jua')`, "saved font survives reload");
    assert.ok((await evaluate(student, "getComputedStyle(document.querySelector('input')).fontFamily")).includes("Jua"), "student controls inherit app font");
    const loaded = await evaluate(teacher, `Array.from(document.querySelectorAll('link[href*="fonts.googleapis.com/css2"]')).map(link=>link.href)`);
    assert.ok(loaded.every(url => url.includes("Noto+Sans+KR") || url.includes("Jua")), "only default and selected font stylesheets are loaded");
    await chooseFont(teacher, "'Noto Serif KR', serif");
    await click(teacher, "수업 설정");
    await until(teacher, `${family}.includes('Jua')`, "leaving unsaved preview restores persisted choice");
    await click(teacher, "테마 · 폰트");
    await until(teacher, `document.querySelector('[aria-label="시스템 폰트"]')`, "font settings reopens");
    await evaluate(teacher, "document.fonts.ready");
    await evaluate(teacher, "(async () => { document.getAnimations().forEach(animation=>animation.finish()); await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))); })()");
    await new Promise(resolve => setTimeout(resolve, 250));
    const screenshot = process.env.SETTINGS_FONT_SCREENSHOT || resolve(root, "node_modules/.cache/settings-fonts.png");
    await mkdir(dirname(screenshot), { recursive: true });
    await writeFile(screenshot, (await teacher.webContents.capturePage()).toPNG());
    console.log(`SCREENSHOT ${screenshot}`);
    await chooseFont(teacher, "");
    await click(teacher, "저장");
    await until(student, `${family} === ${JSON.stringify(defaultFamily)}`, "default resets all screens");
    await evaluate(teacher, `localStorage.setItem(${JSON.stringify(key)},JSON.stringify({fontId:'<invalid-font>'})); window.dispatchEvent(new StorageEvent('storage',{key:${JSON.stringify(key)}}));`);
    await until(teacher, `document.querySelector('[aria-label="시스템 폰트"]').value === ''`, "untrusted stored font falls back to default");
    assert.equal(await evaluate(student, family), defaultFamily);
    await evaluate(teacher, "location.hash='#/settings/ai'");
    await until(teacher, `document.querySelector('[aria-label="AI 설정"] input')`, "new AI deep link works");
    console.log("settings/font browser tests passed: merged routes, preserved settings and AI, preview/save/failure/reset, student reload and tenant isolation");
  } catch (error) {
    exitCode = 1;
    console.error(error);
  } finally {
    windows.forEach(window => window.destroy());
    await server?.close();
    app.exit(exitCode);
  }
}
void run();
