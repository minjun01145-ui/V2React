import { app, BrowserWindow } from "electron";
import assert from "node:assert/strict";
import { resolve } from "node:path";
import { mkdir, writeFile } from "node:fs/promises";
import { createServer } from "../../node_modules/vite/dist/node/index.js";

app.on("window-all-closed", () => {});
const root = resolve(import.meta.dirname, "../..");
const fixture = String.raw`<!doctype html><html><meta charset="utf-8"><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;700;800&display=swap"><body style="margin:0"><div id="app"></div><div id="student" style="width:960px;height:540px"></div>
<script type="module">
import React from 'react';
import { createRoot } from 'react-dom/client';
import { Canvas, StaticCanvas } from 'fabric';
import { SlideEditorController } from '/src/slide-canvas/SlideEditorController.ts';
import SlideShowEditor from '/src/features/teacher/slide-show/SlideShowEditor.tsx';
import SlideStage from '/src/slide-canvas/SlideStage.tsx';
import { PopupProvider } from '/src/shared/popup/index.ts';
import { SLIDE_FONTS } from '/src/slide-canvas/fonts.ts';
import '/src/styles/tokens.css';
const load = SlideEditorController.prototype.load;
SlideEditorController.prototype.load = async function(...args) { window.editor = this; return load.apply(this, args); };
const fromJSON = StaticCanvas.prototype.loadFromJSON;
StaticCanvas.prototype.loadFromJSON = async function(...args) { if (!(this instanceof Canvas) && this.lowerCanvasEl.closest('#student')) window.studentCanvas = this; return fromJSON.apply(this, args); };
window.fonts = SLIDE_FONTS;
window.saved = null;
const empty = id => ({id,canvas:'{"objects":[],"background":"#ffffff"}',engine:null});
createRoot(document.querySelector('#app')).render(React.createElement(PopupProvider, null, React.createElement(SlideShowEditor, {initial:{name:'양식 테스트',slides:[empty('cover'),empty('content')]},sets:[],busy:false,onSave:async draft=>{window.saved=draft},onDirtyChange() {}})));
const student = createRoot(document.querySelector('#student'));
window.renderStudent = canvas => student.render(React.createElement(SlideStage, {canvas}));
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
async function clickText(text, selector = 'button', index = 0) {
  await evaluate(`Array.from(document.querySelectorAll(${JSON.stringify(selector)})).filter(button=>button.textContent.trim()===${JSON.stringify(text)})[${index}].click()`);
}
async function screenshot(name) {
  await until('document.querySelector("[aria-label=\\"슬라이드 배경\\"] input[type=color]").value.toLowerCase() === editor.background.toLowerCase()','palette matches the loaded canvas');
  assert.equal(await evaluate('document.querySelectorAll("[aria-label=\\"슬라이드 배경\\"] button[aria-pressed=true]").length'),0,'template colors outside the palette select no swatch');
  await evaluate('(async () => { editor.canvas.renderAll(); await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))); })()');
  const bounds = await evaluate(`(() => { const r=document.querySelector('#app').getBoundingClientRect(); return {x:0,y:0,width:Math.ceil(r.width),height:Math.min(1000,Math.ceil(r.height))}; })()`);
  const sample = await evaluate(`(() => { const r=editor.canvas.lowerCanvasEl.getBoundingClientRect(); return {x:Math.floor(r.left+r.width*0.04),y:Math.floor(r.top+r.height*0.5),color:editor.background}; })()`);
  // Hidden Electron windows may composite after Fabric/React have finished their frames.
  const deadline = Date.now() + 5000;
  let image;
  let actual;
  do {
    image = await window.webContents.capturePage(bounds);
    const bitmap = image.toBitmap();
    const offset = (sample.y * image.getSize().width + sample.x) * 4;
    actual = '#' + [bitmap[offset+2], bitmap[offset+1], bitmap[offset]].map(value=>value.toString(16).padStart(2,'0')).join('');
    if (actual.toUpperCase() === sample.color.toUpperCase()) break;
    await new Promise(resolve=>setTimeout(resolve,50));
  } while (Date.now() < deadline);
  assert.equal(actual.toUpperCase(),sample.color.toUpperCase(),'screenshot contains the applied canvas, not an earlier compositor frame');
  // Allow the surrounding React inspector/rail to finish compositing too.
  await new Promise(resolve=>setTimeout(resolve,150));
  image = await window.webContents.capturePage(bounds);
  const dir = process.env.SLIDE_SCREENSHOT_DIR || resolve(root, "node_modules/.cache/slide-template-screenshots");
  await mkdir(dir, { recursive: true });
  const path = resolve(dir, `${name}.png`);
  await writeFile(path, image.toPNG());
  console.log(`SCREENSHOT ${path}`);
}

let exitCode = 0;
async function run() {
try {
  await app.whenReady();
  server = await createServer({ root, server:{host:'127.0.0.1',port:0}, plugins:[{
    name:'slide-template-test-fixture',
    configureServer(vite) {
      vite.middlewares.use(async (request,response,next) => {
        if (request.url !== '/__slide-template-test') return next();
        try { response.setHeader('Content-Type','text/html'); response.end(await vite.transformIndexHtml('/__slide-template-test',fixture)); }
        catch(error) { next(error); }
      });
    },
  }] });
  await server.listen();
  window = new BrowserWindow({show:false,width:1600,height:1000,webPreferences:{contextIsolation:true,nodeIntegration:false,backgroundThrottling:false}});
  await window.loadURL(`${server.resolvedUrls.local[0]}__slide-template-test`);
  await until('window.editor && document.querySelector("[aria-label=삽입] button") && !document.querySelector("[aria-label=삽입] button").disabled','editor mount');
  await clickText('양식');
  assert.equal(await evaluate('document.querySelectorAll("[aria-label=양식] svg").length'),2,'two declarative preview cards');
  await clickText('이 슬라이드에 적용');
  await until('!document.querySelector("#app [aria-busy=true]") && editor.background === "#3B5BDB"','classic cover');
  assert.equal(await evaluate('editor.canvas.getObjects().length'),5);
  await screenshot('template-classic-blue-cover');
  await evaluate('editor.undo()');
  assert.equal(await evaluate('editor.canvas.getObjects().length'),0,'one undo removes entire template application');
  await evaluate('editor.redo()');
  assert.equal(await evaluate('editor.canvas.getObjects().length'),5,'redo restores template including marks');
  await clickText('이 슬라이드에 적용');
  await until('!document.querySelector("#app [aria-busy=true]")','reapply finished');
  assert.equal(await evaluate('editor.canvas.getObjects().filter(o=>o.get("data")?.templateDecoration).length'),3,'Fabric export preserves decoration markers');
  await clickText('모든 슬라이드에 적용');
  await until('document.querySelector("[role=dialog]")','all-slide confirmation');
  assert.ok(await evaluate('document.body.textContent.includes("모든 슬라이드의 배경과 글꼴을 바꿀까요?")'));
  await clickText('취소');
  await clickText('모든 슬라이드에 적용');
  await until('document.querySelector("[role=dialog]")','second confirmation');
  await clickText('적용');
  await until('!document.querySelector("[role=dialog]") && !document.querySelector("#app [aria-busy=true]")','deck application');
  await evaluate('document.querySelectorAll("aside ol button")[1].click()');
  await until('editor.background === "#F7F8FC"','classic content');
  await screenshot('template-classic-blue-content');
  // No text exists on the warm fixtures, so each layout gets its own native placeholder geometry.
  await evaluate('editor.canvas.remove(...editor.canvas.getObjects().filter(o=>o.type === "textbox")); editor.canvas.requestRenderAll()');
  await clickText('이 슬라이드에 적용','[aria-label=양식] button',1);
  await until('!document.querySelector("#app [aria-busy=true]") && editor.background === "#FFF8EC"','warm content');
  const overlap = await evaluate(`(() => {
    const objects=editor.canvas.getObjects();
    const title=objects.find(o=>o.text==='제목을 입력하세요');
    const marker=objects.find(o=>o.get('data')?.templateDecoration && o.fill==='#FFD43B');
    return {behind:objects.indexOf(marker)<objects.indexOf(title),lowerHalf:marker.top<title.top+title.height && marker.top+marker.height>title.top+title.height/2};
  })()`);
  assert.ok(overlap.behind && overlap.lowerHalf,'warm highlight overlaps the lower half of the actual rendered title box, behind the text');
  await screenshot('template-warm-note-content');
  await evaluate('document.querySelectorAll("aside ol button")[0].click()');
  await until('editor.background === "#3B5BDB"','return cover');
  await evaluate('void editor.canvas.remove(...editor.canvas.getObjects().filter(o=>o.type === "textbox"))');
  await clickText('이 슬라이드에 적용','[aria-label=양식] button',1);
  await until('!document.querySelector("#app [aria-busy=true]") && editor.background === "#F4A259"','warm cover');
  await screenshot('template-warm-note-cover');
  await clickText('저장');
  await until('window.saved','saved deck');
  assert.deepEqual(await evaluate('saved.slides.map(s=>JSON.parse(s.canvas).background)'),['#F4A259','#FFF8EC']);

  await evaluate(`editor.addText(); window.text=editor.canvas.getActiveObject(); text.exitEditing(); text.set({text:'apple 한글',fontSize:60,width:640}); editor.canvas.requestRenderAll()`);
  await until('document.querySelector("select[aria-label=글꼴]")','font picker');
  const labels = await evaluate('Array.from(document.querySelector("select[aria-label=글꼴]").options).map(o=>o.textContent)');
  for (const label of ['프리텐다드','본명조','검은고딕','주아','나눔손글씨 펜','궁서']) assert.ok(labels.includes(label));
  for (let i=1;i<7;i++) {
    const metrics = await evaluate(`(async () => {
      const family=fonts[${i}].family;
      const select=document.querySelector('select[aria-label=글꼴]');
      select.value=family; select.dispatchEvent(new Event('change',{bubbles:true}));
      const faces=await document.fonts.load('400 60px '+family,'apple 한글'); await document.fonts.ready;
      await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
      text.enterEditing(); text.selectionStart=text.selectionEnd=3; text._updateTextarea();
      const context=document.createElement('canvas').getContext('2d'); context.font='400 60px '+family;
      const result={family:text.fontFamily,loaded:faces.length,actual:context.measureText('app').width,caret:text._getCursorBoundaries().leftOffset,native:text.hiddenTextarea.selectionStart};
      text.exitEditing(); window.renderStudent(editor.serialize()); return result;
    })()`);
    assert.ok(metrics.loaded>0,`font ${i} actually loaded from web`);
    assert.ok(Math.abs(metrics.actual-metrics.caret)<0.2,`font ${i} caret tracks loaded glyph widths`);
    assert.equal(metrics.native,3);
    await until(`window.studentCanvas?.getObjects().some(o=>o.text==='apple 한글' && o.fontFamily===${JSON.stringify(metrics.family)})`,'student uses same face');
    const studentWidth = await evaluate(`studentCanvas.getObjects().find(o=>o.text==='apple 한글').getLineWidth(0)`);
    const editorWidth = await evaluate('text.getLineWidth(0)');
    assert.ok(Math.abs(studentWidth-editorWidth)<0.1,'read-only/student measurement matches editor');
  }
  console.log('slide template/font browser tests passed');
} catch(error) {
  exitCode=1;
  console.error(error);
} finally {
  window?.destroy();
  await server?.close();
  app.exit(exitCode);
}
}

void run();
