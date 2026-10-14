import { app, BrowserWindow } from "electron";
import assert from "node:assert/strict";
import { resolve } from "node:path";
import { mkdir, writeFile } from "node:fs/promises";
import { createServer } from "../../node_modules/vite/dist/node/index.js";

app.on("window-all-closed", () => {});
const root = resolve(import.meta.dirname, "../..");
// The real panel is rendered; only the network boundaries (AI call, picture search) are stubbed.
const AI_STUB = String.raw`
export async function requestSlideAssist(instruction, deck) {
  window.assistantDeck = deck;
  window.assistantInstruction = instruction;
  if (/그림|이미지/.test(instruction)) {
    return { message: "'city bus' 그림을 넣었습니다.", operations: [{ op: "addImage", query: "city bus", width: 320 }], dropped: 0 };
  }
  return { message: "3번과 5번에서 '되요'를 찾았습니다. '돼요'로 고쳤습니다.", operations: [{ op: "replaceText", from: "되요", to: "돼요", slides: "all" }], dropped: 1 };
}
`;
const IMAGE_STUB = String.raw`
export async function findSlideImage(query) {
  window.assistantImageQuery = query;
  return {
    dataUrl: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==",
    width: 1, height: 1,
    credit: { source: "Wikimedia Commons", creator: "사진가", license: "CC BY-SA 4.0", licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0", pageUrl: "https://commons.wikimedia.org/wiki/File:Bus.jpg" },
  };
}
export function imageCreditText(credit) { return [credit.creator, credit.license, credit.source].filter(Boolean).join(" · "); }
export function isCommerciallyUsableLicense() { return true; }
export function parseCommonsResults() { return []; }
`;

const fixture = String.raw`<!doctype html><html><meta charset="utf-8"><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;700;800&display=swap"><body style="margin:0"><div id="app"></div>
<script type="module">
import React from 'react';
import { createRoot } from 'react-dom/client';
import { Canvas } from 'fabric';
import SlideShowEditor from '/src/features/teacher/slide-show/SlideShowEditor.tsx';
import { PopupProvider } from '/src/shared/popup/index.ts';
import { SlideEditorController } from '/src/slide-canvas/SlideEditorController.ts';
import '/src/styles/tokens.css';
const load = SlideEditorController.prototype.load;
SlideEditorController.prototype.load = async function(...args) { window.editor = this; return load.apply(this, args); };
window.saved = null;
const text = (value, top) => ({ type: 'Textbox', originX: 'left', originY: 'top', text: value, left: 80, top, width: 700, fontSize: 40, fontFamily: "'Noto Sans KR', sans-serif", fill: '#101a3a', splitByGrapheme: true });
const slide = (value, top, id) => ({ id, engine: null, canvas: JSON.stringify({ background: '#ffffff', objects: [text(value, top)] }) });
createRoot(document.querySelector('#app')).render(React.createElement(PopupProvider, null, React.createElement(SlideShowEditor, {
  initial: { name: 'AI 테스트', slides: [slide('안녕하세요 되요', 60, 'slide-1'), slide('오늘도 되요', 60, 'slide-2'), slide('정리합니다', 60, 'slide-3')] },
  sets: [], busy: false, onSave: async draft => { window.saved = draft; }, onDirtyChange() {},
})));
window.ready = true;
</script></body></html>`;

let server;
let window;
async function evaluate(code) {
  try { return await window.webContents.executeJavaScript(code, true); }
  catch (error) { throw new Error(`Browser evaluation failed: ${code}`, { cause: error }); }
}
async function until(code, label) {
  const deadline = Date.now() + 60000;
  while (!await evaluate(`Boolean(${code})`)) {
    if (Date.now() > deadline) throw new Error(`Timed out: ${label}`);
    await new Promise(resolve => setTimeout(resolve, 50));
  }
}
async function ask(text) {
  await evaluate(`(() => {
    const area = document.querySelector('[aria-label="AI 도우미"] textarea');
    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set;
    setter.call(area, ${JSON.stringify(text)});
    area.dispatchEvent(new Event('input', { bubbles: true }));
  })()`);
  await until('!document.querySelector(\'[aria-label="AI 도우미"] button\').disabled', 'the ask button enables');
  await evaluate(`document.querySelector('[aria-label="AI 도우미"] button').click()`);
}
function replyText() {
  return evaluate(`document.querySelector('[aria-label="AI 도우미"] [role=status]')?.textContent ?? ''`);
}
async function screenshot(name) {
  await new Promise(resolve => setTimeout(resolve, 200));
  const bounds = await evaluate(`(() => { const r = document.querySelector('[aria-label="AI 도우미"]').getBoundingClientRect(); return { x: Math.floor(r.left) - 8, y: Math.floor(r.top) - 8, width: Math.ceil(r.width) + 16, height: Math.ceil(r.height) + 16 }; })()`);
  const image = await window.webContents.capturePage(bounds);
  const dir = process.env.SLIDE_SCREENSHOT_DIR || resolve(root, "node_modules/.cache/slide-assistant-screenshots");
  await mkdir(dir, { recursive: true });
  const path = resolve(dir, `${name}.png`);
  await writeFile(path, image.toPNG());
  console.log(`SCREENSHOT ${path}`);
}

let exitCode = 0;
async function run() {
try {
  await app.whenReady();
  server = await createServer({ root, server: { host: '127.0.0.1', port: 0 }, plugins: [{
    name: 'slide-assistant-test-fixture',
    // Stub only the two network boundaries, whatever relative path an importer used.
    load(id) {
      const path = id.split('?')[0];
      if (path.endsWith('/slide-assistant/repository.ts')) return AI_STUB;
      if (path.endsWith('/slide-assistant/imageSearch.ts')) return IMAGE_STUB;
    },
    configureServer(vite) {
      vite.middlewares.use(async (request, response, next) => {
        if (request.url !== '/__slide-assistant-test') return next();
        try { response.setHeader('Content-Type', 'text/html'); response.end(await vite.transformIndexHtml('/__slide-assistant-test', fixture)); }
        catch (error) { next(error); }
      });
    },
  }] });
  await server.listen();
  window = new BrowserWindow({ show: false, width: 1400, height: 1000, webPreferences: { contextIsolation: true, nodeIntegration: false, backgroundThrottling: false } });
  window.webContents.on('console-message', (event) => { if (event.level === 'error') console.error('BROWSER:', event.message); });
  await window.loadURL(`${server.resolvedUrls.local[0]}__slide-assistant-test`);
  await until('window.editor && document.querySelector(\'[aria-label="AI 도우미"] textarea\')', 'the assistant panel mounts');

  // The panel only sends the described slide plus the other slides' text, never whole Fabric JSON.
  await ask('PPT에 오류나 이상한 표현 있는지 봐줘');
  await until(`document.querySelector('[aria-label="AI 도우미"] [role=status]')`, 'the review answer arrives');
  const deck = await evaluate('window.assistantDeck');
  assert.equal(deck.slideCount, 3);
  assert.equal(deck.current, 1);
  assert.equal(deck.currentSlide.objects[0].id, 'o1');
  assert.equal(deck.currentSlide.objects[0].kind, 'text');
  assert.equal(typeof deck.currentSlide.objects[0].left, 'number');
  assert.deepEqual(deck.currentSlide.objects[0].text, '안녕하세요 되요');
  assert.deepEqual(deck.otherSlides, [{ n: 2, texts: ['오늘도 되요'] }, { n: 3, texts: ['정리합니다'] }]);
  assert.ok(!JSON.stringify(deck).includes('objects":[{"type"'), 'the deck carries described objects, not Fabric JSON');
  assert.ok(deck.fonts.length >= 6, 'the AI is told which fonts the editor can render');

  const answer = await replyText();
  assert.ok(answer.includes("'되요'"), `the answer text is shown to the teacher: ${answer}`);
  assert.ok(answer.includes('건너뛰었습니다'), 'an operation the browser refused is reported');
  assert.equal(await evaluate('editor.canvas.getObjects()[0].text'), '안녕하세요 돼요', 'the edited slide is rewritten');
  await screenshot('slide-assistant-review');

  // The whole request is a single undo step on the slide being edited.
  await evaluate('editor.undo()');
  assert.equal(await evaluate('editor.canvas.getObjects()[0].text'), '안녕하세요 되요', 'one undo reverts every change of the request');

  await ask('되요를 돼요로 고쳐줘');
  await until(`document.querySelector('[aria-label="AI 도우미"] [role=status]')?.textContent.includes('되요')`, 'the fix answer arrives');
  assert.ok((await evaluate('document.querySelector(\'[aria-label="AI 도우미"] textarea\').value')) === '', 'the input clears after applying');
  await evaluate(`Array.from(document.querySelectorAll('header button')).find(button => button.textContent.trim() === '저장').click()`);
  await until('window.saved', 'the deck saves');
  const canvases = await evaluate('saved.slides.map(slide => JSON.parse(slide.canvas).objects.map(object => object.text))');
  assert.deepEqual(canvases, [['안녕하세요 돼요'], ['오늘도 돼요'], ['정리합니다']], 'the other slides keep their new text after saving');

  await ask('버스 이미지 검색해서 아무거나 하나 가져와줘');
  await until(`document.querySelector('[aria-label="AI 도우미"] [role=status]')?.textContent.includes('그림 출처')`, 'the picture credit is reported');
  assert.equal(await evaluate('window.assistantImageQuery'), 'city bus', 'the searched words reach the picture source');
  const credit = await evaluate(`(() => { const image = editor.canvas.getObjects().find(object => object.type === 'image'); return image?.get('data')?.assistantImage ?? null; })()`);
  assert.deepEqual(credit, {
    source: 'Wikimedia Commons', creator: '사진가', license: 'CC BY-SA 4.0',
    licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0', pageUrl: 'https://commons.wikimedia.org/wiki/File:Bus.jpg',
  }, 'the inserted picture keeps its source and licence');
  assert.ok((await replyText()).includes('사진가 · CC BY-SA 4.0 · Wikimedia Commons'));
  await screenshot('slide-assistant-image-credit');

  await evaluate('editor.undo()');
  assert.equal(await evaluate('editor.canvas.getObjects().some(object => object.type === "Image")'), false, 'the picture insert is one undo step too');
  console.log('slide assistant browser tests passed');
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
