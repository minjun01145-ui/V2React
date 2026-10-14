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
import { SLIDE_TEMPLATES } from '/src/slide-canvas/slideTemplates/index.ts';
import { FONT_CATALOG } from '/src/fonts/catalog.ts';
import '/src/styles/tokens.css';
const load = SlideEditorController.prototype.load;
SlideEditorController.prototype.load = async function(...args) { window.editor = this; return load.apply(this, args); };
const fromJSON = StaticCanvas.prototype.loadFromJSON;
StaticCanvas.prototype.loadFromJSON = async function(...args) { if (!(this instanceof Canvas) && this.lowerCanvasEl.closest('#student')) window.studentCanvas = this; return fromJSON.apply(this, args); };
window.templates = SLIDE_TEMPLATES;
window.fonts = FONT_CATALOG;
window.loadedStylesheets = () => Array.from(document.querySelectorAll('link[rel=stylesheet]')).map(link => link.href);
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
/** 양식 카드는 이름으로 고른다. 카드 그리드 순서에 테스트가 묶이지 않게 한다. */
async function selectTemplate(name) {
  await evaluate(`Array.from(document.querySelectorAll('[aria-label=양식] button')).find(button=>button.getAttribute('aria-pressed')!==null && button.querySelector('span').textContent.trim()===${JSON.stringify(name)}).click()`);
}
async function screenshot(name, expectedBackground) {
  await until(`document.querySelector("[aria-label=\\"슬라이드 배경\\"] input[type=color]").value.toLowerCase() === editor.background.toLowerCase()`,'palette matches the loaded canvas');
  const paletteMatch = expectedBackground.toLowerCase() === "#ffffff" ? 1 : 0;
  assert.equal(await evaluate('document.querySelectorAll("[aria-label=\\"슬라이드 배경\\"] button[aria-pressed=true]").length'), paletteMatch, `only palette colors light up a background swatch (${expectedBackground})`);
  assert.equal(await evaluate('editor.background'), expectedBackground, 'the expected template is on the canvas');
  // Fabric and the surrounding React panels draw on separate frames; wait for both before capturing.
  await evaluate('(async () => { editor.canvas.renderAll(); await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))); })()');
  await new Promise(resolve=>setTimeout(resolve,250));
  const bounds = await evaluate(`(() => { const r=document.querySelector('#app').getBoundingClientRect(); return {x:0,y:0,width:Math.ceil(r.width),height:Math.min(1200,Math.ceil(r.height))}; })()`);
  const image = await window.webContents.capturePage(bounds);
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
  window = new BrowserWindow({show:false,width:1600,height:1200,webPreferences:{contextIsolation:true,nodeIntegration:false,backgroundThrottling:false}});
  await window.loadURL(`${server.resolvedUrls.local[0]}__slide-template-test`);
  await until('window.editor && document.querySelector("[aria-label=삽입] button") && !document.querySelector("[aria-label=삽입] button").disabled','editor mount');

  // 시작할 때는 어떤 글꼴도 미리 받지 않는다. 미리보기 스타일시트(text= 서브셋)는 패널을 열 때만 붙는다.
  assert.equal(await evaluate('loadedStylesheets().filter(href=>href.includes("text=")).length'),0,'no preview font stylesheets before the pickers are used');
  await clickText('양식');
  assert.equal(await evaluate('document.querySelectorAll("[aria-label=양식] svg").length'),7,'seven declarative preview cards');
  assert.equal(await evaluate('document.querySelectorAll("[aria-label=양식] button[aria-pressed]").length'),7,'each template card is a selection button');
  assert.equal(await evaluate('document.querySelectorAll("[aria-label=양식] button[aria-pressed=true]").length'),1,'exactly one template card is selected');
  await until('loadedStylesheets().filter(href=>href.includes("text=")).length > 0','template preview faces load when the panel opens');

  const templateIds = await evaluate('templates.map(template=>template.id)');
  assert.deepEqual(templateIds, ['classic-blue','warm-note','blue-textbook','clean-title','quiet-note','yellow-grid','calm-green'],'seven design languages in panel order');

  // 템플릿 적용은 한 번의 undo 단위다: 빈 슬라이드에서 되돌리면 원래대로 돌아온다.
  await selectTemplate('클래식 블루');
  await clickText('이 슬라이드에 적용');
  await until('!document.querySelector("#app [aria-busy=true]") && editor.background === "#3B5BDB"','classic cover applied');
  const classicObjects = await evaluate('editor.canvas.getObjects().length');
  assert.equal(classicObjects, 5,'classic cover places three decorations and two placeholders');
  await evaluate('editor.undo()');
  assert.equal(await evaluate('editor.canvas.getObjects().length'),0,'one undo removes the entire template application');
  await evaluate('editor.redo()');
  assert.equal(await evaluate('editor.canvas.getObjects().length'),classicObjects,'redo restores the template including marks');

  // 양식마다 표지(1번 슬라이드)와 본문(2번 슬라이드)을 실제로 적용해 캡처한다.
  for (const id of templateIds) {
    const name = await evaluate(`templates.find(template=>template.id===${JSON.stringify(id)}).name`);
    await selectTemplate(name);
    await clickText('모든 슬라이드에 적용');
    await until('document.querySelector("[role=dialog]")','all-slide confirmation');
    await clickText('적용');
    const coverBackground = await evaluate(`templates.find(template=>template.id===${JSON.stringify(id)}).cover.background`);
    const contentBackground = await evaluate(`templates.find(template=>template.id===${JSON.stringify(id)}).content.background`);
    await until(`!document.querySelector("[role=dialog]") && !document.querySelector("#app [aria-busy=true]") && editor.background === ${JSON.stringify(coverBackground)}`,`${id} cover applied`);
    await screenshot(`tpl-${id}-cover`, coverBackground);
    await evaluate('document.querySelectorAll("aside ol button")[1].click()');
    await until(`editor.background === ${JSON.stringify(contentBackground)}`,`${id} content applied`);
    await screenshot(`tpl-${id}-content`, contentBackground);
    await evaluate('document.querySelectorAll("aside ol button")[0].click()');
    await until(`editor.background === ${JSON.stringify(coverBackground)}`,`${id} back to cover`);
  }
  // 양식을 다시 적용해도 장식이 쌓이지 않고 마지막 적용만 남는다.
  const lastDecorations = await evaluate('templates.find(template=>template.id==="calm-green").cover.decorations.length');
  assert.equal(await evaluate('editor.canvas.getObjects().filter(o=>o.get("data")?.templateDecoration).length'),lastDecorations,'the last template keeps only its own decoration');
  assert.equal(await evaluate('editor.canvas.getObjects().filter(o=>o.type === "textbox").length'),2,'each slide keeps a single title and body placeholder');

  // '따뜻한 노트'의 형광펜은 제목 상자의 아래쪽 절반을 실제 렌더 좌표에서 덮는다.
  await evaluate('document.querySelectorAll("aside ol button")[1].click()');
  await until('editor.background === "#FEFFF8"','calm-green content');
  await evaluate('editor.canvas.remove(...editor.canvas.getObjects().filter(o=>o.type === "textbox")); editor.canvas.requestRenderAll()');
  await selectTemplate('따뜻한 노트');
  await clickText('이 슬라이드에 적용');
  await until('!document.querySelector("#app [aria-busy=true]") && editor.background === "#F4A259"','warm content reapply');
  const overlap = await evaluate(`(() => {
    const objects=editor.canvas.getObjects();
    const title=objects.find(o=>o.text==='제목을 입력하세요');
    const marker=objects.find(o=>o.get('data')?.templateDecoration && o.fill==='#FFD43B');
    const card=objects.find(o=>o.get('data')?.templateDecoration && o.fill==='#FFF8EC');
    return {behind:objects.indexOf(marker)<objects.indexOf(title),lowerHalf:marker.top<title.top+title.height && marker.top+marker.height>title.top+title.height/2,cardWidth:card.width,cardHeight:card.height,slide:{w:editor.canvas.getWidth()/editor.canvas.getZoom(),h:editor.canvas.getHeight()/editor.canvas.getZoom()}};
  })()`);
  assert.ok(overlap.behind && overlap.lowerHalf,'warm highlight overlaps the lower half of the actual rendered title box, behind the text');
  assert.ok(overlap.cardWidth/overlap.slide.w >= 0.9 && overlap.cardHeight/overlap.slide.h >= 0.85,'warm content card fills most of the slide');
  assert.ok(overlap.slide.w > 0 && overlap.slide.h > 0,'slide size is measurable for the fill check');

  // '노랑 격자'의 형광펜도 제목 아래쪽 절반에 깔리고, 초록 장식은 본문 상자 밖 모서리로 내려간다.
  await evaluate('editor.canvas.remove(...editor.canvas.getObjects().filter(o=>o.type === "textbox")); editor.canvas.requestRenderAll()');
  await selectTemplate('노랑 격자');
  await clickText('이 슬라이드에 적용');
  await until('!document.querySelector("#app [aria-busy=true]") && editor.background === "#FEFAE2"','yellow-grid content');
  const grid = await evaluate(`(() => {
    const objects=editor.canvas.getObjects();
    const title=objects.find(o=>o.text==='제목을 입력하세요');
    const body=objects.find(o=>o.text==='내용을 입력하세요');
    const marker=objects.find(o=>o.get('data')?.templateDecoration && o.fill==='#FFD43B');
    const accent=objects.find(o=>o.get('data')?.templateDecoration && o.fill==='#E6F1D5');
    const rectBounds=o=>({x:o.left,y:o.top,w:o.width*o.scaleX,h:o.height*o.scaleY});
    const b=rectBounds(body), a=rectBounds(accent);
    return {behind:objects.indexOf(marker)<objects.indexOf(title),lowerHalf:marker.top>title.top && marker.top+marker.height>title.top+title.height/2,accentInsideBody:a.x<b.x+b.w && a.x+a.w>b.x && a.y<b.y+b.h && a.y+a.h>b.y};
  })()`);
  assert.ok(grid.behind && grid.lowerHalf,'yellow-grid highlight sits on the lower half of the rendered title, behind the text');
  assert.ok(!grid.accentInsideBody,'yellow-grid corner accent stays outside the body box');

  // 글꼴 선택기는 분류별 그룹이고, 고른 글꼴로 항목을 미리 보여 준다.
  await evaluate(`editor.addText(); window.text=editor.canvas.getActiveObject(); text.exitEditing(); text.set({text:'apple 한글',fontSize:60,width:640}); editor.canvas.requestRenderAll()`);
  await until('document.querySelector("select[aria-label=글꼴]")','font picker');
  await evaluate('document.querySelector("select[aria-label=글꼴]").dispatchEvent(new FocusEvent("focus"))');
  const groups = await evaluate('Array.from(document.querySelector("select[aria-label=글꼴]").querySelectorAll("optgroup")).map(group=>group.label)');
  assert.deepEqual(groups,['고딕','명조','손글씨','디스플레이','고정폭'],'font picker groups by category');
  const options = await evaluate('Array.from(document.querySelector("select[aria-label=글꼴]").querySelectorAll("optgroup option")).map(option=>option.textContent)');
  const catalogLabels = await evaluate('fonts.map(font=>font.label)');
  for (const label of catalogLabels) assert.ok(options.includes(label),`catalog font is offered: ${label}`);
  assert.ok(catalogLabels.length >= 30,`catalog offers enough fonts (${catalogLabels.length})`);
  for (const kept of ['기본 고딕','프리텐다드','본명조','검은고딕','주아','나눔손글씨 펜','궁서']) assert.ok(options.includes(kept),`original font kept: ${kept}`);

  // 새 글꼴도 로드 후 Fabric 측정 캐시가 갱신되어 캐럿과 학생 렌더가 같은 폭을 쓴다.
  const samples = ['나눔고딕','고운바탕','여기어때 잘난체','에스코어 드림','G마켓 산스','교보손글씨 2019','리디바탕','나눔고딕코딩','함렛','동글'];
  for (const label of samples) {
    const metrics = await evaluate(`(async () => {
      const font=fonts.find(item=>item.label===${JSON.stringify(label)});
      const select=document.querySelector('select[aria-label=글꼴]');
      select.value=font.family; select.dispatchEvent(new Event('change',{bubbles:true}));
      // 새 글꼴은 선택 시점에 등록·로드된다. 스타일시트/@font-face가 붙을 때까지 기다린다.
      let faces=[];
      const deadline=Date.now()+15000;
      while (!faces.length && Date.now()<deadline) {
        faces=await document.fonts.load('400 60px '+font.family,'apple 한글');
        if (!faces.length) await new Promise(resolve=>setTimeout(resolve,100));
      }
      await document.fonts.ready;
      await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
      text.enterEditing(); text.selectionStart=text.selectionEnd=3; text._updateTextarea();
      const context=document.createElement('canvas').getContext('2d'); context.font='400 60px '+font.family;
      const result={family:text.fontFamily,label:font.label,loaded:faces.length,actual:context.measureText('app').width,caret:text._getCursorBoundaries().leftOffset,native:text.hiddenTextarea.selectionStart};
      text.exitEditing(); window.renderStudent(editor.serialize()); return result;
    })()`, 30000);
    assert.ok(metrics.loaded>0,`font ${label} actually loaded from web`);
    assert.ok(Math.abs(metrics.actual-metrics.caret)<0.2,`font ${label} caret tracks loaded glyph widths`);
    assert.equal(metrics.native,3);
    await until(`window.studentCanvas?.getObjects().some(o=>o.text==='apple 한글' && o.fontFamily===${JSON.stringify(metrics.family)})`,`student uses ${label}`);
    const studentWidth = await evaluate(`studentCanvas.getObjects().find(o=>o.text==='apple 한글').getLineWidth(0)`);
    const editorWidth = await evaluate('text.getLineWidth(0)');
    assert.ok(Math.abs(studentWidth-editorWidth)<0.1,`read-only/student measurement matches editor for ${label}`);
  }

  // 저장 검증을 통과하는지: 양식이 넣은 글꼴도 허용 목록 안의 값이다.
  await clickText('저장');
  await until('window.saved','saved deck');
  const families = await evaluate('saved.slides.flatMap(slide=>{const canvas=JSON.parse(slide.canvas);return canvas.objects.filter(o=>o.type==="Textbox").map(o=>o.fontFamily)})');
  const allowed = await evaluate('fonts.map(font=>font.family)');
  assert.ok(families.every(family=>allowed.includes(family)),'saved slides only use catalog font stacks');
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
