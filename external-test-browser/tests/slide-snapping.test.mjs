import { app, BrowserWindow } from "electron";
import assert from "node:assert/strict";
import { resolve } from "node:path";
import { mkdir, writeFile } from "node:fs/promises";
import { createServer } from "../../node_modules/vite/dist/node/index.js";

// Magnet snapping in the real editor canvas: real mouse drags, real guide pixels, real saved JSON.
app.on("window-all-closed", () => {});
const root = resolve(import.meta.dirname, "../..");
const fixture = String.raw`<!doctype html><html><meta charset="utf-8"><body style="margin:0">
<div id="host" style="width:960px"><canvas id="editor"></canvas></div>
<script type="module">
import { SlideEditorController } from '/src/slide-canvas/SlideEditorController.ts';
window.editor = new SlideEditorController(document.querySelector('#editor'), { onChange() {}, onSelectionChange() {}, onEngineDelete() {} });
editor.resize(960);
const box = (left, top, width, height, fill) => ({ type: 'Rect', originX: 'left', originY: 'top', left, top, width, height, fill, strokeWidth: 0 });
window.base = JSON.stringify({ version: '7.0.0', background: '#ffffff', objects: [box(200, 200, 200, 100, '#ffc933'), box(760, 500, 160, 120, '#7ea0ff')] });
await editor.load(window.base, null, '');
// Test-only: put a slide object back where a case needs it.
window.place = (index, left, top) => { const object = editor.canvas.getObjects()[index]; object.set({ left, top }); object.setCoords(); editor.canvas.requestRenderAll(); };
window.flush = () => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
window.ready = true;
</script></body></html>`;

let server;
let window;
let exitCode = 0;
async function evaluate(code) { return window.webContents.executeJavaScript(code, true); }
async function until(code, label) {
  const deadline = Date.now() + 30000;
  while (!(await evaluate(code))) {
    if (Date.now() > deadline) throw new Error(`Timed out: ${label}`);
    await new Promise(resolve => setTimeout(resolve, 40));
  }
}
/** Slide units to window pixels: the editor scales a 1280-wide board into its element. */
async function point(slideX, slideY) {
  return evaluate(`(() => { const r = editor.canvas.lowerCanvasEl.getBoundingClientRect(); return { x: Math.round(r.left + ${slideX} * editor.canvas.getZoom()), y: Math.round(r.top + ${slideY} * editor.canvas.getZoom()) }; })()`);
}
async function mouseUp(at, modifiers = []) {
  const to = await point(at[0], at[1]);
  window.webContents.sendInputEvent({ type: "mouseUp", button: "left", clickCount: 1, modifiers, ...to });
  await new Promise(resolve => setTimeout(resolve, 60));
}
/**
 * Drags an object with the real pointer, keeping the button down so the guides stay on screen.
 * Chromium coalesces pointer moves, so the object is read back and the target position re-sent
 * until the canvas really rests on it.
 */
async function drag(index, from, to, modifiers = []) {
  const start = await point(from[0], from[1]);
  const end = await point(to[0], to[1]);
  const grab = await evaluate(`(() => { const o = editor.canvas.getObjects()[${index}]; return [o.left, o.top]; })()`);
  window.webContents.sendInputEvent({ type: "mouseDown", button: "left", clickCount: 1, modifiers, ...start });
  for (let step = 1; step <= 6; step += 1) {
    window.webContents.sendInputEvent({ type: "mouseMove", button: "left", modifiers, x: Math.round(start.x + (end.x - start.x) * step / 6), y: Math.round(start.y + (end.y - start.y) * step / 6) });
    await new Promise(resolve => setTimeout(resolve, 40));
  }
  const at = () => evaluate(`(() => { const o = editor.canvas.getObjects()[${index}]; return [o.left, o.top].join(); })()`);
  const wanted = [grab[0] + (to[0] - from[0]), grab[1] + (to[1] - from[1])];
  let previous = '';
  for (let attempt = 0; attempt < 20; attempt += 1) {
    window.webContents.sendInputEvent({ type: "mouseMove", button: "left", modifiers, x: end.x + (attempt % 2), y: end.y });
    await new Promise(resolve => setTimeout(resolve, 90));
    const current = await at();
    const [left, top] = current.split(',').map(Number);
    // Resting within a snap threshold of where the pointer asks for means the drag has arrived.
    if (current === previous && Math.abs(left - wanted[0]) <= 8.5 && Math.abs(top - wanted[1]) <= 8.5) break;
    previous = current;
  }
}

/** Counts the magenta guide pixels currently painted on the slide itself. */
function guidePixels() {
  return evaluate(`(() => {
    const ctx = editor.canvas.getContext();
    const { data } = ctx.getImageData(0, 0, ctx.canvas.width, ctx.canvas.height);
    let count = 0;
    // A 1px line is antialiased, so count the pixels the guide colour still dominates.
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i], g = data[i + 1], b = data[i + 2];
      if (r > 240 && r - g > 40 && b > 90) count += 1;
    }
    return count;
  })()`);
}
function boundsOf(index) {
  return evaluate(`(() => { const b = editor.canvas.getObjects()[${index}].getBoundingRect(); return { left: b.left, top: b.top, right: b.left + b.width, bottom: b.top + b.height, x: b.left + b.width / 2, y: b.top + b.height / 2 }; })()`);
}

async function run() {
try {
  await app.whenReady();
  server = await createServer({ root, server: { host: '127.0.0.1', port: 0 }, plugins: [{
    name: 'slide-snapping-test-fixture',
    configureServer(vite) {
      vite.middlewares.use(async (request, response, next) => {
        if (request.url !== '/__slide-snapping-test') return next();
        try { response.setHeader('Content-Type', 'text/html'); response.end(await vite.transformIndexHtml('/__slide-snapping-test', fixture)); }
        catch (error) { next(error); }
      });
    },
  }] });
  await server.listen();
  window = new BrowserWindow({ show: false, width: 1200, height: 900, webPreferences: { contextIsolation: true, nodeIntegration: false, backgroundThrottling: false } });
  window.webContents.on("console-message", (event) => { if (event.level === "error") console.error("BROWSER:", event.message); });
  await window.loadURL(`${server.resolvedUrls.local[0]}__slide-snapping-test`);
  await until('window.ready === true && editor.canvas.getObjects().length === 2', 'editor loads the slide');

  const before = await evaluate('editor.serialize()');

  // The pointer drags the box from its middle, so the box centre follows the pointer.
  // The slide centre is at x = 640; the drag stops 4 units short and the box still lands on it.
  await drag(0, [300, 250], [636, 250]);
  const snapped = await boundsOf(0);
  assert.ok(Math.abs(snapped.x - 640) < 0.6, `the box centre sticks to the slide centre: ${JSON.stringify(snapped)}`);
  assert.ok(await guidePixels() > 0, 'a magenta guide is drawn while the box is stuck to a line');

  // The screenshot is taken while the pointer is still down, so it shows the live guides.
  const bounds = await evaluate(`(() => { const r = document.querySelector('#host').getBoundingClientRect(); return { x: Math.floor(r.left), y: Math.floor(r.top), width: Math.ceil(r.width), height: Math.ceil(r.height) }; })()`);
  const image = await window.webContents.capturePage(bounds);
  const dir = process.env.SLIDE_SCREENSHOT_DIR || resolve(root, "node_modules/.cache/slide-snapping-screenshots");
  await mkdir(dir, { recursive: true });
  const shot = resolve(dir, "snap-guides.png");
  await writeFile(shot, image.toPNG());
  console.log(`SCREENSHOT ${shot}`);

  // Carrying on breaks the snap immediately: the correction comes from the pointer, not from the snapped state.
  window.webContents.sendInputEvent({ type: "mouseMove", button: "left", x: (await point(700, 250)).x, y: (await point(700, 250)).y });
  await new Promise(resolve => setTimeout(resolve, 60));
  const free = await boundsOf(0);
  assert.ok(free.x > snapped.x + 40, `carrying on breaks the snap without drift: ${JSON.stringify({ snapped, free })}`);
  assert.equal(await guidePixels(), 0, 'the guide goes away as soon as the box leaves the line');
  await mouseUp([700, 250]);

  // Outside the threshold nothing sticks and the box stays exactly where the pointer left it.
  await drag(0, [700, 250], [500, 250]);
  await mouseUp([500, 250]);
  const outside = await boundsOf(0);
  assert.ok(Math.abs(outside.x - 500) < 2, `no snap outside the threshold: ${JSON.stringify(outside)}`);
  assert.equal(await guidePixels(), 0, 'no guide outside the threshold');

  // Alt and Ctrl release the snap for that drag, exactly where the plain drag stuck to the centre.
  // (Alt also changes Fabric's own transform origin, so only the snap itself is asserted.)
  for (const modifier of ["alt", "ctrl"]) {
    await evaluate('place(0, 400, 250)');
    await drag(0, [500, 250], [636, 250], [modifier]);
    const unsnapped = await boundsOf(0);
    assert.ok(Math.abs(unsnapped.x - 640) > 1, `${modifier} drags do not snap: ${JSON.stringify(unsnapped)}`);
    assert.equal(await guidePixels(), 0, `no guide while ${modifier} suspends snapping`);
    await mouseUp([636, 250], [modifier]);
  }

  // Another object attracts too: the second box sticks to the first box's right edge at 600.
  await evaluate('place(0, 200, 200)');
  await drag(1, [840, 560], [483, 560]);
  const aligned = await boundsOf(1);
  assert.ok(Math.abs(aligned.left - 400) < 0.6, `the box sticks to the neighbour's right edge: ${JSON.stringify(aligned)}`);
  assert.ok(await guidePixels() > 0, 'the guide of the neighbour alignment is drawn');
  await mouseUp([483, 560]);

  // Resizing snaps only the dragged edge: the right-middle handle lands on the slide centre
  // while the opposite edge stays exactly where it was.
  const beforeResize = await boundsOf(1);
  await drag(1, [560, 560], [643, 560]);
  const resized = await boundsOf(1);
  assert.ok(Math.abs(resized.right - 640) < 0.6, `the dragged edge snaps to the slide centre: ${JSON.stringify(resized)}`);
  assert.ok(Math.abs(resized.left - beforeResize.left) < 0.6, `the opposite edge stays put: ${JSON.stringify({ beforeResize, resized })}`);
  assert.ok(await guidePixels() > 0, 'the resize guide is drawn');
  await mouseUp([643, 560]);
  assert.equal(await guidePixels(), 0, 'the resize guide goes away when the drag ends');

  // Guides are an overlay: the saved slide still holds only the two objects.
  const after = JSON.parse(await evaluate('editor.serialize()'));
  assert.equal(after.objects.length, 2, 'snapping never adds objects to the slide');
  assert.equal(JSON.parse(before).objects.length, 2, 'the slide started with two objects');
  assert.ok(!JSON.stringify(after).toLowerCase().includes('guide'), 'guides are not part of the saved data');
  assert.ok(!JSON.stringify(after).toUpperCase().includes('#FF3EA5'), 'the guide colour never reaches the saved data');
} catch (error) {
  exitCode = 1;
  console.error(error);
} finally {
  server?.close();
  app.quit();
  process.exitCode = exitCode;
}
}

void run();
