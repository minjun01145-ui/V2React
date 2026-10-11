import { app, BrowserWindow } from "electron";
import assert from "node:assert/strict";
import { resolve } from "node:path";
import { createServer } from "../../node_modules/vite/dist/node/index.js";

// Preserve the explicit result while asynchronous fixture shutdown closes the final window.
app.on("window-all-closed", () => {});
const root = resolve(import.meta.dirname, "../..");
const fixture = String.raw`<!doctype html><html><meta charset="utf-8"><body>
<canvas id="editor"></canvas><div id="properties"></div><div id="engine"></div><div id="timer"></div>
<script type="module">
import React from 'react';
import ReactDOM from 'react-dom/client';
const { useState } = React;
const { createRoot } = ReactDOM;
import { SlideEditorController } from '/src/slide-canvas/SlideEditorController.ts';
import { SlideTextbox } from '/src/slide-canvas/SlideTextbox.ts';
import { StaticCanvas } from 'fabric';
import ObjectStylePanel from '/src/features/teacher/slide-show/ObjectStylePanel.tsx';
import SlideEnginePanel from '/src/features/teacher/slide-show/SlideEnginePanel.tsx';
import StudentTimerOverlay from '/src/features/slide-show-runtime/timer/StudentTimerOverlay.tsx';
window.editor = new SlideEditorController(document.querySelector('#editor'), { onChange() {}, onSelectionChange() {}, onEngineDelete() {} });
editor.resize(960);
await editor.load('{"objects":[],"background":"#ffffff"}', null, '');
window.SlideTextbox = SlideTextbox;
window.StaticCanvas = StaticCanvas;
function Properties() {
  const [style, setStyle] = useState({kind:'text', fill:'#101a3a', opacity:1, stroke:'#101a3a', strokeWidth:8, fontSize:80, fontFamily:"'Noto Sans KR', sans-serif", bold:false, textAlign:'left', background:null});
  window.objectStyle = style;
  window.setObjectStyle = setStyle;
  return React.createElement(ObjectStylePanel, {style, onChange: patch => setStyle(value => ({...value, ...patch})), onArrange() {}, onDuplicate() {}, onDelete() {}});
}
function Engine() {
  const [round, setRound] = useState({gameId:'free-response', source:{kind:'free-response', prompt:'질문'}, durationSeconds:80, gameConfig:{}});
  window.round = round;
  return React.createElement(SlideEnginePanel, {round, sets:[], disabled:false, issue:null, onChange:setRound, onRemove() {}});
}
function Timer() {
  const [show, setShow] = useState({timer:null, timerSkin:'normal', engine:null});
  window.setTimerShow = setShow;
  return React.createElement(StudentTimerOverlay, {show});
}
createRoot(document.querySelector('#properties')).render(React.createElement(Properties));
createRoot(document.querySelector('#engine')).render(React.createElement(Engine));
createRoot(document.querySelector('#timer')).render(React.createElement(Timer));
window.ready = true;
</script></body></html>`;

let server;
let exitCode = 0;
let window;
async function evaluate(code) { return window.webContents.executeJavaScript(code, true); }
async function until(code, label) {
  const deadline = Date.now() + 30000;
  while (!(await evaluate(code))) {
    if (Date.now() > deadline) throw new Error(`Timed out: ${label}`);
    await new Promise(resolve => setTimeout(resolve, 40));
  }
}
async function key(keyCode) {
  window.webContents.sendInputEvent({type:'keyDown', keyCode});
  window.webContents.sendInputEvent({type:'keyUp', keyCode});
  await new Promise(resolve => setTimeout(resolve, 30));
}
async function characters(text) {
  for (const keyCode of text) window.webContents.sendInputEvent({type:'char', keyCode});
  await new Promise(resolve => setTimeout(resolve, 30));
}
async function focusNumber(selector, clear = false) {
  await evaluate(`document.querySelector(${JSON.stringify(selector)}).focus(); ${clear ? `document.querySelector(${JSON.stringify(selector)}).select();` : ''}`);
  window.webContents.focus();
}

async function run() {
try {
  await app.whenReady();
  server = await createServer({root, server:{host:'127.0.0.1', port:0}, plugins:[{
    name:'slide-editor-regression-fixture',
    resolveId(source, importer) {
      if (importer?.endsWith('/timer/useSlideTimerClock.ts') && source.endsWith('/live-world/client.ts')) return '\0timer-test-clock';
    },
    load(id) {
      // Replace only the network clock boundary; exercise the actual hook, timer and DOM.
      if (id === '\0timer-test-clock') return 'export function subscribeLiveServerTimeOffset(receive) { receive(0); return () => {}; }';
    },
    configureServer(vite) {
      vite.middlewares.use(async (request, response, next) => {
        if (request.url !== '/__slide-editor-test') { next(); return; }
        try {
          response.setHeader('Content-Type', 'text/html');
          response.end(await vite.transformIndexHtml('/__slide-editor-test', fixture));
        } catch (error) { next(error); }
      });
    },
  }]});
  await server.listen();
  window = new BrowserWindow({show:false, width:1200, height:1000, webPreferences:{contextIsolation:true, nodeIntegration:false}});
  window.webContents.on("console-message", (event) => {
    if (event.level === "error") console.error("BROWSER:", event.message);
  });
  await window.loadURL(`${server.resolvedUrls.local[0]}__slide-editor-test`);
  await until('window.ready && document.querySelectorAll("#properties input[type=number]").length === 1 && document.querySelector("#engine input[type=number]")', 'editor and panels mount');

  // Real browser font loading used to leave Fabric's fallback widths/caret permanently cached.
  const lateFont = await evaluate(`(async () => {
    editor.addText();
    window.text = editor.canvas.getActiveObject();
    text.exitEditing();
    text.set({text:'apple', fontFamily:'SlideRegressionLateFont, monospace', fontSize:80, width:640});
    text.enterEditing();
    text.selectionStart = text.selectionEnd = 3;
    text._updateTextarea();
    editor.canvas.renderAll();
    const before = text._getCursorBoundaries().leftOffset;
    const face = new FontFace('SlideRegressionLateFont', 'local("Arial"), local("Liberation Sans"), local("DejaVu Sans")');
    document.fonts.add(face);
    await document.fonts.load('80px SlideRegressionLateFont', 'apple');
    await document.fonts.ready;
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const ctx = document.createElement('canvas').getContext('2d');
    ctx.font = '80px SlideRegressionLateFont, monospace';
    return {before, actual:ctx.measureText('app').width, caret:text._getCursorBoundaries().leftOffset, native:text.hiddenTextarea.selectionStart};
  })()`);
  assert.ok(Math.abs(lateFont.before - lateFont.actual) > 2, 'the fixture really changes the glyph metrics after editing starts');
  assert.ok(Math.abs(lateFont.caret - lateFont.actual) < 0.1, 'caret matches the loaded font');
  assert.equal(lateFont.native, 3, 'font refresh preserves native selection');
  await evaluate('text.hiddenTextarea.focus()');
  await key('Backspace');
  assert.equal(await evaluate('text.text'), 'aple', 'backspace removes the character immediately before the displayed caret');

  const wrapping = await evaluate(String.raw`(async () => {
    text.exitEditing();
    const samples = ['I have a dog', '안녕하세요반갑습니다 오늘도 좋은 날', 'supercalifragilisticexpialidocious', 'I have\n한국어와 English apple'];
    const results = [];
    for (const sample of samples) {
      const box = new SlideTextbox(sample, {width:150, fontSize:40, fontFamily:'Arial'});
      editor.canvas.add(box);
      results.push({sample, lines:box.textLines, width:box.width, lineWidths:box.textLines.map((_, i) => box.getLineWidth(i))});
    }
    const json = JSON.stringify({objects:[new SlideTextbox('I have a dog', {width:150, fontSize:40, fontFamily:'Arial'}).toObject()]});
    const view = new StaticCanvas(document.createElement('canvas'));
    await view.loadFromJSON(json);
    const displayed = view.getObjects()[0].textLines;
    const legacy = JSON.parse(json); legacy.objects[0].splitByGrapheme = false;
    await editor.load(JSON.stringify(legacy), null, '');
    const edited = editor.canvas.getObjects()[0].textLines;
    await view.dispose();
    return {results, displayed, edited};
  })()`);
  for (const result of wrapping.results) {
    assert.equal(result.width, 150, 'long words do not expand the box');
    assert.ok(result.lineWidths.every(width => width <= 150.1), 'every line fits the box');
    assert.equal(result.lines.join(''), result.sample.replaceAll('\n', ''), 'wrapping preserves all English/Korean graphemes and spaces');
  }
  assert.ok(wrapping.results[0].lines.some(line => line.includes('have')), 'a normal English word is kept together');
  assert.ok(wrapping.results[1].lines.length > 1, 'Korean without spaces can still wrap');
  assert.ok(wrapping.results[2].lines.length > 1, 'oversized words wrap instead of overflowing');
  assert.deepEqual(wrapping.edited, wrapping.displayed, 'legacy editing and read-only/student canvas use the same wrapping');
  for (const displayWidth of [640, 960]) {
    for (const scenario of [{sample:'apple', index:3, width:640, angle:0}, {sample:'apple', index:4, width:640, angle:25}, {sample:'I have a dog', index:9, width:150, angle:0}]) {
      const point = await evaluate(`(() => {
        const scenario = ${JSON.stringify(scenario)};
        editor.resize(${displayWidth});
        window.text = editor.canvas.getObjects()[0];
        text.exitEditing();
        text.set({text:scenario.sample, fontFamily:'Arial', fontSize:40, width:scenario.width, angle:scenario.angle});
        editor.canvas.setActiveObject(text);
        text.enterEditing();
        editor.canvas.renderAll();
        const boundary = text._getCursorBoundaries(scenario.index, true);
        const x = boundary.left + boundary.leftOffset;
        const y = boundary.top + boundary.topOffset + 20;
        const [a,b,c,d,e,f] = text.calcTransformMatrix();
        const rect = editor.canvas.upperCanvasEl.getBoundingClientRect();
        const zoom = editor.canvas.getZoom();
        return {x:Math.round(rect.left + (a*x+c*y+e)*zoom), y:Math.round(rect.top + (b*x+d*y+f)*zoom)};
      })()`);
      window.webContents.sendInputEvent({type:'mouseDown', button:'left', clickCount:1, ...point});
      window.webContents.sendInputEvent({type:'mouseUp', button:'left', clickCount:1, ...point});
      await until(`text.selectionStart === ${scenario.index} && text.hiddenTextarea.selectionStart === ${scenario.index}`, 'pointer/native caret alignment');
      await key('Backspace');
      assert.equal(await evaluate('text.text'), scenario.sample.slice(0, scenario.index - 1) + scenario.sample.slice(scenario.index), 'scaled/rotated/wrapped caret deletes the matching character');
    }
  }


  // Native typing, deletion, blur and Enter must not immediately clamp/stringify drafts.
  const fontInput = '#properties input[type=number]';
  await focusNumber(fontInput);
  await key('End'); await key('Backspace');
  assert.equal(await evaluate(`document.querySelector('${fontInput}').value`), '8');
  await key('Backspace');
  assert.equal(await evaluate(`document.querySelector('${fontInput}').value`), '');
  assert.equal(await evaluate('objectStyle.fontSize'), 80, 'empty draft does not change the object');
  await evaluate(`document.querySelector('${fontInput}').blur()`);
  assert.equal(await evaluate(`document.querySelector('${fontInput}').value`), '80', 'blank restores the committed font size');
  await focusNumber(fontInput, true); await characters('120'); await key('Return');
  assert.equal(await evaluate('objectStyle.fontSize'), 120, 'Enter commits');
  await focusNumber(fontInput, true); await characters('999');
  assert.equal(await evaluate(`document.querySelector('${fontInput}').value`), '999', 'out-of-range draft remains editable');
  await evaluate(`document.querySelector('${fontInput}').blur()`);
  assert.equal(await evaluate('objectStyle.fontSize'), 240, 'blur clamps maximum');
  await focusNumber(fontInput, true); await characters('1'); await key('Return');
  assert.equal(await evaluate('objectStyle.fontSize'), 8, 'commit clamps minimum');
  await evaluate("setObjectStyle(value => ({...value, kind:'line', strokeWidth:8}))");
  await until("document.querySelector('#properties section[aria-label=\"선 서식\"] input[type=number]')?.value === '8'", 'line thickness input');
  await focusNumber(fontInput, true); await key('Backspace');
  assert.equal(await evaluate(`document.querySelector('${fontInput}').value`), '', 'line thickness also allows an empty draft');
  await characters('0'); await key('Return');
  assert.equal(await evaluate('objectStyle.strokeWidth'), 0, 'zero is a valid committed line thickness');
  const durationInput = '#engine input[type=number]';
  await focusNumber(durationInput, true); await key('Backspace');
  assert.equal(await evaluate(`document.querySelector('${durationInput}').value`), '');
  await evaluate(`document.querySelector('${durationInput}').blur()`);
  assert.equal(await evaluate('round.durationSeconds'), 80, 'empty duration restores its previous value');
  await focusNumber(durationInput, true); await characters('5'); await key('Return');
  assert.equal(await evaluate('round.durationSeconds'), 10, 'duration validates on commit');
  // Real student overlay rendering, including theme changes and engine/manual separation.
  await evaluate("setTimerShow({timer:{durationSeconds:60, remainingSeconds:60, startedAtMs:Date.now()}, timerSkin:'normal', engine:null})");
  await until("document.querySelector('#timer [aria-label=\"수업 타이머\"] [role=timer]')", 'student timer appears');
  const overlay = await evaluate(`(() => {
    const overlay = document.querySelector('#timer [aria-label="수업 타이머"]');
    const face = overlay.firstElementChild.getBoundingClientRect();
    return {x:face.x + face.width / 2, y:face.y + face.height / 2, width:document.documentElement.clientWidth, height:document.documentElement.clientHeight,
      fontSize:parseFloat(getComputedStyle(overlay.querySelector('[role=timer]')).fontSize), pointerEvents:getComputedStyle(overlay).pointerEvents};
  })()`);
  assert.ok(Math.abs(overlay.x - overlay.width / 2) < 1 && Math.abs(overlay.y - overlay.height / 2) < 1, `timer is centered in the student viewport: ${JSON.stringify(overlay)}`);
  assert.ok(overlay.fontSize >= 80, 'student timer digits are large');
  assert.equal(overlay.pointerEvents, 'none', 'the timer does not block student input');
  for (const skin of ['glow', 'apple', 'hourglass', 'normal']) {
    await evaluate(`setTimerShow(show => ({...show, timerSkin:${JSON.stringify(skin)}}))`);
    await until(skin === 'hourglass' ? "document.querySelector('#timer [role=img][aria-label=\"모래시계\"]')"
      : skin === 'normal' ? "document.querySelector('#timer strong[role=timer]')"
      : skin === 'apple' ? "document.querySelector('#timer svg mask')"
      : "document.querySelector('#timer svg linearGradient')", `student theme ${skin}`);
  }
  await evaluate("setTimerShow(show => ({...show, timer:{durationSeconds:60, remainingSeconds:45, startedAtMs:null}}))");
  await until("!document.querySelector('#timer [aria-label=\"수업 타이머\"]')", 'pause hides overlay');
  await evaluate("setTimerShow(show => ({...show, timer:{durationSeconds:1, remainingSeconds:1, startedAtMs:Date.now()}}))");
  await until("document.querySelector('#timer [aria-label=\"수업 타이머\"]')", 'short timer appears');
  await until("!document.querySelector('#timer [aria-label=\"수업 타이머\"]')", 'expiry hides overlay');
  await evaluate("setTimerShow({timer:null, timerSkin:'apple', engine:{phase:'answering', round:{gameId:'free-response', durationSeconds:60}}})");
  await evaluate("new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))");
  assert.equal(await evaluate("document.querySelector('#timer').childElementCount"), 0, 'free-response engine deadline never renders a student timer');
  console.log('PASS: late-font caret/backspace, English/Korean/long-word wrapping, numeric drafts and student timer overlay');
  exitCode = 0;
} catch (error) {
  console.error(error);
  exitCode = 1;
} finally {
  window?.destroy();
  await server?.close();
  app.exit(exitCode);
}
}

void run();
