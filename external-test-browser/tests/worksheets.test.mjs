import { app, BrowserWindow } from "electron";
import assert from "node:assert/strict";
import { resolve } from "node:path";
import { createRequire } from "node:module";
import { mkdir, writeFile } from "node:fs/promises";
import { createServer } from "../../node_modules/vite/dist/node/index.js";

app.on("window-all-closed", () => {});
const root = resolve(import.meta.dirname, "../..");
const require = createRequire(resolve(root, "functions/package.json"));
const { initializeApp, deleteApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const sampleRows = [
  ["I can run / faster / than my brother.", "나는 달릴 수 있다 / 더 빨리 / 내 남동생보다."],
  ["This house / is bigger / than the old one.", "이 집은 / 더 크다 / 이전 집보다."],
  ["Tom / is the tallest / in my family.", "Tom은 / 가장 키가 크다 / 우리 가족 중에서."],
  ["Yuna / is the best singer / in my school.", "Yuna는 / 노래를 가장 잘하는 사람이다 / 우리 학교에서."],
  ["The lion / is faster / than the elephant.", "사자는 / 더 빠르다 / 코끼리보다."],
  ["The elephant / is heavier / than the rabbit.", "코끼리는 / 더 무겁다 / 토끼보다."],
  ["The lion / is the oldest / of the three animals.", "사자는 / 가장 나이가 많다 / 세 동물 중에서."],
  ["The rabbit / is the fastest / of the three animals.", "토끼는 / 가장 빠르다 / 세 동물 중에서."],
  ["He / was a little taller / than me.", "그는 / 키가 조금 더 컸다 / 나보다."],
  ["He / was faster / than me.", "그는 / 더 빨랐다 / 나보다."],
  ["He / just wanted / the smallest one.", "그는 / 단지 원했다 / 가장 작은 것을."],
];
const fixture = (host, port) => `<!doctype html><html lang="ko"><meta charset="utf-8"><body><div id="root"></div><script type="module">
import React from 'react'; import {createRoot} from 'react-dom/client';
import Page from '/src/features/teacher/worksheets/TeacherWorksheetsPage.tsx';
import Nav from '/src/apps/teacher/TeacherNav.tsx'; import {tenantConfig} from '/src/tenant/config.ts';
import {connectFirestoreEmulator} from 'firebase/firestore'; import {db} from '/src/firebase/firebaseClient.ts';
import shell from '/src/apps/teacher/TeacherWorkspace.module.css';
import '/src/styles/tokens.css'; import '/src/styles/reset.css'; import '/src/styles/global.css';
connectFirestoreEmulator(db,${JSON.stringify(host)},${port},{mockUserToken:{sub:'worksheet-teacher',user_id:'worksheet-teacher',email:'teacher@example.test',firebase:{sign_in_provider:'password'}}});
createRoot(document.querySelector('#root')).render(React.createElement('div',{className:shell.workspace},React.createElement(Nav,{currentView:'worksheets',tenant:tenantConfig('minjun'),onLogout:async()=>{}}),React.createElement('div',{className:shell.main},React.createElement(Page,{roomId:'worksheet-room'}))));
</script></body></html>`;
// The real Firestore SDK/repository/codec reads a seeded emulator under the real Rules.
// Only the external AI callable is replaced; its output still crosses the real parser.
const functionsBoundary = String.raw`
export const getFunctions = () => ({});
export const httpsCallable = (_functions, name) => async input => {
  if(name!=='generateWorksheet') throw new Error('Unexpected callable '+name);
  window.worksheetAiCalls=(window.worksheetAiCalls||0)+1;
  window.lastWorksheetRequest=input;
  await new Promise(resolve=>setTimeout(resolve,100));
  if(window.failWorksheet) throw new Error('생성 실패 테스트');
  if(input.mode==='meanings') return {data:{mode:'meanings',meanings:input.items.filter(item=>!item.meaning).map(item=>({id:item.id,meaning:'누락된 문장 뜻'})),latencyMs:100}};
  const item=input.items[0]; const source=item.sourceText.replaceAll('/',' ').replace(/\s+/g,' ').trim();
  const sections=[
    {kind:'fill-blank',items:[{prompt:source.replace('faster','{{blank}}'),answer:'faster'}]},
    {kind:'vocabulary',items:[{prompt:'더 빨리 → {{blank}}',answer:'faster'}]},
    {kind:'sentence-writing',items:[{prompt:item.meaning,answer:source}]},
    {kind:'translation',items:[{prompt:source,answer:item.meaning}]},
    {kind:'correction',items:[{prompt:'I can run more faster than my brother.',answer:'more faster → faster'}]},
  ];
  return {data:window.invalidWorksheet?{mode:'practice',sections:[],latencyMs:100}:{mode:'practice',sections,latencyMs:100}};
};`;
let server, window, adminApp;
const evaluate = code => window.webContents.executeJavaScript(code, true);
async function until(code, label) {
  const deadline = Date.now() + 60000;
  while (!await evaluate(`Boolean(${code})`)) {
    if (Date.now() > deadline) throw new Error(`Timed out: ${label}; ${await evaluate("document.body.innerText")}`);
    await new Promise(resolve => setTimeout(resolve, 50));
  }
}
const click = label => evaluate(`Array.from(document.querySelectorAll('button')).find(button=>button.textContent.trim()===${JSON.stringify(label)}).click()`);
const selectSet = id => evaluate(`(()=>{const select=document.querySelector('select');select.value=${JSON.stringify(id)};select.dispatchEvent(new Event('change',{bubbles:true}));})()`);
async function screenshot(path) {
  const height = await evaluate("Math.ceil(document.documentElement.scrollHeight)");
  window.setContentSize(1200, Math.min(height + 50, 14000));
  await evaluate("window.scrollTo(0,0)");
  await new Promise(resolve => setTimeout(resolve, 250));
  await writeFile(path, (await window.webContents.capturePage()).toPNG());
}
async function run() {
  let exitCode = 0;
  try {
    assert.ok(process.env.FIRESTORE_EMULATOR_HOST, "Use the Firestore emulator; never write production fixtures");
    const [host, port] = process.env.FIRESTORE_EMULATOR_HOST.split(":");
    adminApp = initializeApp({ projectId: "demo-worksheet" }, "worksheet-browser");
    const db = getFirestore(adminApp);
    const items = sampleRows.map(([sourceText, meaning], index) => ({ id: `item-${index + 1}`, sourceText, meaning }));
    const metadata = { name: "1학년 5과 비교급·최상급", type: "reading-chunks", itemCount: items.length, createdAtMs: 1, updatedAtMs: 2 };
    await Promise.all([
      db.doc("admins/worksheet-teacher").set({ active: true, tenantId: "minjun" }),
      db.doc("learningSets/reading").set(metadata), db.doc("learningSets/reading/content/main").set({ items }),
      db.doc("learningSets/missing").set({ ...metadata, name: "뜻 보완 본문", itemCount: 1, updatedAtMs: 1 }),
      db.doc("learningSets/missing/content/main").set({ items: [{ ...items[0], meaning: "" }] }),
    ]);
    await app.whenReady();
    server = await createServer({ root, define: { "import.meta.env.VITE_FIREBASE_PROJECT_ID": JSON.stringify("demo-worksheet") }, server: { host: "127.0.0.1", port: 0 }, optimizeDeps: { exclude: ["firebase/functions"] }, plugins: [{
      name: "worksheet-ai-boundary", enforce: "pre",
      resolveId(source) { if (source === "firebase/functions") return "\0worksheet-functions"; },
      load(id) { if (id === "\0worksheet-functions") return functionsBoundary; },
      configureServer(vite) {
        vite.middlewares.use(async (request, response, next) => {
          if (!request.url.startsWith("/teacher/__worksheets")) return next();
          try { response.setHeader("Content-Type", "text/html"); response.end(await vite.transformIndexHtml(request.url, fixture(host, Number(port)))); } catch (error) { next(error); }
        });
      },
    }] });
    await server.listen();
    window = new BrowserWindow({ show: false, width: 1200, height: 1200, webPreferences: { contextIsolation: true, nodeIntegration: false, backgroundThrottling: false } });
    window.webContents.on("console-message", event => { if (event.level === "error") console.error("BROWSER:", event.message); });
    await window.loadURL(`${server.resolvedUrls.local[0]}teacher/__worksheets`);
    await until("document.querySelector('select option[value=reading]')", "reading set loads through real Firestore");
    await selectSet("reading"); await click("본문 학습지 만들기");
    await until("document.querySelector('[data-worksheet] tbody tr') && !document.querySelector('[role=status]')", "deterministic reading worksheet");
    assert.equal(await evaluate("window.worksheetAiCalls||0"), 0, "complete meanings never call AI");
    assert.equal(await evaluate("document.querySelectorAll('[data-worksheet] table').length"), 2);
    assert.equal(await evaluate("document.querySelectorAll('[data-worksheet] tbody tr').length"), 22);
    assert.ok((await evaluate("getComputedStyle(document.querySelector('[data-worksheet]')).fontFamily")).includes("Noto Sans KR"));
    assert.equal(await evaluate("document.querySelector('a[aria-current=page]').textContent"), "학습자료 만들기");
    const outputDir = process.env.WORKSHEET_ARTIFACT_DIR || resolve(root, "node_modules/.cache/worksheets");
    await mkdir(outputDir, { recursive: true });
    await screenshot(resolve(outputDir, "worksheet-reading.png"));
    await writeFile(resolve(outputDir, "worksheet-reading.pdf"), await window.webContents.printToPDF({ printBackground: true, preferCSSPageSize: true, displayHeaderFooter: false }));
    await evaluate("window.print=()=>{window.printCalled=true};void 0"); await click("인쇄"); assert.equal(await evaluate("window.printCalled"), true);
    await click("연습문제 학습지 만들기");
    await until("document.querySelector('[data-worksheet] h1')?.textContent==='연습문제 학습지'", "AI-boundary practice worksheet");
    assert.equal(await evaluate("document.querySelectorAll('[data-worksheet] section').length"), 6);
    assert.equal(await evaluate("window.lastWorksheetRequest.mode"), "practice");
    await screenshot(resolve(outputDir, "worksheet-practice.png"));
    await writeFile(resolve(outputDir, "worksheet-practice.pdf"), await window.webContents.printToPDF({ printBackground: true, preferCSSPageSize: true, displayHeaderFooter: false }));
    await evaluate("window.invalidWorksheet=true"); await click("연습문제 학습지 만들기");
    await until("document.querySelector('[role=alert]')?.textContent.includes('응답 형식')", "invalid AI JSON rejected before rendering");
    await evaluate("window.invalidWorksheet=false;window.failWorksheet=true"); await click("연습문제 학습지 만들기");
    await until("document.querySelector('[role=alert]')?.textContent.includes('생성 실패 테스트')", "generation failure shown");
    await evaluate("window.failWorksheet=false"); await selectSet("missing"); await click("본문 학습지 만들기");
    await until("document.querySelector('[data-worksheet]')?.textContent.includes('누락된 문장 뜻')", "missing meaning completed through AI2 boundary");
    assert.equal(await evaluate("window.lastWorksheetRequest.mode"), "meanings");
    console.log(`Worksheet browser tests passed: real Firestore and Rules, deterministic reading, AI-boundary practice, print, invalid response, error and missing meaning. ARTIFACTS ${outputDir}`);
  } catch (error) { exitCode = 1; console.error(error); }
  finally { window?.destroy(); await server?.close(); if (adminApp) await deleteApp(adminApp); app.exit(exitCode); }
}
void run();
