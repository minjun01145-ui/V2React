import { app } from "electron";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { once } from "node:events";
import { createBrowser } from "../browser.mjs";
import { parseSettings } from "../settings.mjs";

const root = resolve(import.meta.dirname, "..");
const profile = join(root, ".test-profile", randomUUID());
mkdirSync(profile, { recursive: true });
app.setPath("userData", profile);
app.setPath("sessionData", profile);
app.on("window-all-closed", () => {}); // Keep the test process alive to verify reopen.

// This fixture never contacts Firebase, signs anyone in, or writes game data.
const fixture = `<!doctype html><html lang="ko"><meta charset="utf-8">
<style>body{font:18px system-ui;padding:32px;background:#f4f6fa;color:#172033}h1{font-size:28px}input{padding:12px;font:inherit}p{margin-top:28px}</style>
<h1>독립 브라우저 검증</h1><input aria-label="입력 확인" placeholder="입력 확인"><p id="clock"></p>
<script>
window.ticks=0;setInterval(()=>document.querySelector('#clock').textContent='실행 '+(++window.ticks),50);
window.held=false;addEventListener('keydown',e=>{if(e.key==='ArrowRight')window.held=true});addEventListener('blur',()=>window.held=false);
addEventListener('mousedown',e=>window.lastMouse={x:e.clientX,y:e.clientY,target:e.target.tagName});
window.save=async value=>{localStorage.setItem('account',value);document.cookie='account='+value+';path=/';
const db=await new Promise((resolve,reject)=>{const request=indexedDB.open('fixture',1);request.onupgradeneeded=()=>request.result.createObjectStore('accounts');request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error)});
await new Promise((resolve,reject)=>{const tx=db.transaction('accounts','readwrite');tx.objectStore('accounts').put(value,'current');tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error)});db.close();return value};
window.load=async()=>{const db=await new Promise((resolve,reject)=>{const request=indexedDB.open('fixture',1);request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error)});
const value=await new Promise((resolve,reject)=>{const request=db.transaction('accounts').objectStore('accounts').get('current');request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error)});db.close();return value};
</script></html>`;
const server = createServer((request, response) => {
  if (request.url.startsWith("/offline")) { response.destroy(); return; }
  response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
  response.end(fixture);
});

async function until(predicate, label) {
  const deadline = Date.now() + 45000;
  while (!(await predicate())) {
    if (Date.now() > deadline) throw new Error(`Timed out: ${label}`);
    await new Promise((resolve) => setTimeout(resolve, 40));
  }
}
async function click(contents, x, y) {
  contents.sendInputEvent({ type: "mouseMove", x: Math.round(x), y: Math.round(y) });
  contents.sendInputEvent({ type: "mouseDown", x: Math.round(x), y: Math.round(y), button: "left", clickCount: 1 });
  contents.sendInputEvent({ type: "mouseUp", x: Math.round(x), y: Math.round(y), button: "left", clickCount: 1 });
}
let browser;
async function enableStudents(browser) {
  await until(() => browser.window.webContents.executeJavaScript("document.querySelectorAll('.enable').length === 4"), "pane controls ready");
  await browser.window.webContents.executeJavaScript("document.querySelectorAll('.enable').forEach((button, index) => { if(index) button.click(); })");
  await until(() => browser.state().panes.every((pane) => pane.status === "ready"), "enabled student pages ready");
}
async function run() {
try {
  await app.whenReady();
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const settings = parseSettings({ siteUrl: `http://127.0.0.1:${server.address().port}/?room=fixture&tenant=hana` });
  browser = createBrowser(settings, { maximize: false });
  browser.window.webContents.on("console-message", (_event, details) => console.log("SHELL:", details.message));
  browser.window.webContents.on("did-fail-load", (_event, code, description) => console.log("SHELL LOAD:", code, description));
  browser.window.webContents.on("dom-ready", () => console.log("SHELL DOM READY"));
  browser.window.webContents.on("did-finish-load", () => console.log("SHELL LOAD FINISHED"));
  browser.window.webContents.on("render-process-gone", (_event, details) => console.log("SHELL PROCESS:", details));
  await until(() => browser.state().panes[0].status === "ready" && browser.window.isVisible(), "teacher opens automatically");
  await until(() => browser.window.webContents.executeJavaScript("document.querySelectorAll('.pane').length === 4"), "shell loaded");
  assert.equal(browser.state().mode, "grid");
  assert.ok(browser.state().panes.slice(1).every((pane) => pane.status === "off"));
  assert.ok(browser.panes.slice(1).every((pane) => pane.view.webContents.getURL() === "" && !pane.view.getVisible()));
  await browser.window.webContents.executeJavaScript("document.querySelector('[data-mode=\"2\"]').click()");
  await until(() => browser.state().mode === 2, "view disabled student alone");
  assert.equal(browser.state().panes[2].status, "off");
  assert.equal(browser.panes[0].view.getVisible(), false);
  await browser.window.webContents.executeJavaScript("document.querySelectorAll('.enable')[2].click()");
  await until(() => browser.state().panes[2].status === "ready", "enable chosen student");
  assert.ok(browser.state().panes.filter((pane) => pane.status === "off").length === 2);
  await browser.window.webContents.executeJavaScript("document.querySelector('[data-mode=grid]').click()");
  await until(() => browser.state().mode === "grid", "return to grid");
  await enableStudents(browser);
  console.log("PASS: only teacher starts automatically; disabled views stay offline until enabled, including in single-screen mode");
  const panes = browser.panes;
  assert.equal(new Set(panes.map((pane) => pane.view.webContents.session)).size, 4);
  assert.equal(new URL(panes[0].view.webContents.getURL()).pathname, "/teacher/");
  for (const pane of panes.slice(1)) assert.equal(new URL(pane.view.webContents.getURL()).pathname, "/");

  for (const [index, account] of ["teacher", "9991", "9992", "9993"].entries()) {
    const contents = panes[index].view.webContents;
    await contents.executeJavaScript(`window.save(${JSON.stringify(account)})`);
    assert.equal(await contents.executeJavaScript("typeof require"), "undefined");
    assert.equal(await contents.executeJavaScript("typeof window.testBrowser"), "undefined");
  }
  for (const [index, account] of ["teacher", "9991", "9992", "9993"].entries()) {
    const contents = panes[index].view.webContents;
    assert.equal(await contents.executeJavaScript("localStorage.getItem('account')"), account);
    assert.equal(await contents.executeJavaScript("window.load()"), account);
    const cookies = await contents.session.cookies.get({ url: settings.studentUrl, name: "account" });
    assert.equal(cookies[0].value, account);
  }
  console.log("PASS: four separate cookie, localStorage, and IndexedDB sessions; no native bridge in game pages");

  browser.window.focus();
  await until(() => browser.window.isFocused(), "browser window focused");
  for (const pane of panes) {
    const contents = pane.view.webContents;
    await until(async () => await contents.executeJavaScript("innerWidth") === pane.bounds.content.width, "page resized to grid");
    const point = await contents.executeJavaScript("(()=>{const r=document.querySelector('input').getBoundingClientRect();return{x:r.x+12,y:r.y+12}})()");
    await click(contents, point.x, point.y);
    await until(() => browser.state().active === pane.index && contents.isFocused(), `focus pane ${pane.index}`);
    await until(() => contents.executeJavaScript("document.activeElement.tagName==='INPUT'"), `input focused in pane ${pane.index}`);
    await until(() => browser.window.webContents.executeJavaScript(`document.querySelectorAll('.pane.active').length===1 && document.querySelectorAll('.select')[${pane.index}].getAttribute('aria-pressed')==='true'`), "matching active border");
    contents.sendInputEvent({ type: "char", keyCode: String(pane.index) });
    await until(() => contents.executeJavaScript(`document.querySelector('input').value===${JSON.stringify(String(pane.index))}`), "keyboard reaches the clicked pane on the first click");
  }
  // Holding movement then switching clients must release the old client's input.
  panes[3].view.webContents.sendInputEvent({ type: "keyDown", keyCode: "Right" });
  await until(() => panes[3].view.webContents.executeJavaScript("window.held"), "movement held");
  await click(panes[0].view.webContents, 45, 45);
  await until(() => browser.state().active === 0 && panes[3].view.webContents.executeJavaScript("!window.held"), "blur releases movement");
  for (const pane of panes) {
    assert.equal(await pane.view.webContents.executeJavaScript("document.visibilityState"), "visible");
    assert.equal(await pane.view.webContents.executeJavaScript("document.querySelector('input').value"), String(pane.index));
  }
  const before = await Promise.all(panes.map((pane) => pane.view.webContents.executeJavaScript("window.ticks")));
  await until(async () => (await Promise.all(panes.map((pane) => pane.view.webContents.executeJavaScript("window.ticks")))).every((tick, index) => tick > before[index] + 2), "all pages keep running");
  console.log("PASS: click selects and highlights each pane, keyboard stays in that pane, blur releases movement, all pages keep running");

  await click(panes[3].view.webContents, 45, 45);
  await until(() => browser.state().active === 3 && panes[3].view.webContents.isFocused(), "third student focused before switching view");
  panes[3].view.webContents.sendInputEvent({ type: "keyDown", keyCode: "Right" });
  await until(() => panes[3].view.webContents.executeJavaScript("window.held"), "movement held before switching view");
  for (const mode of [0, 1, 2, 3]) {
    await browser.window.webContents.executeJavaScript(`document.querySelector('[data-mode="${mode}"]').click()`);
    await until(() => browser.state().mode === mode && browser.state().active === mode, "single-screen view selected");
    assert.equal(panes.filter((pane) => pane.view.getVisible()).length, 1);
    assert.equal(panes[mode].view.getVisible(), true);
    await until(() => browser.window.webContents.executeJavaScript("document.querySelectorAll('.pane:not([hidden])').length===1"), "one visible frame");
    assert.equal(await panes[mode].view.webContents.executeJavaScript("document.querySelector('input').value"), String(mode));
    assert.equal(await panes[3].view.webContents.executeJavaScript("window.held"), false);
  }
  const hiddenTicks = await panes[0].view.webContents.executeJavaScript("window.ticks");
  await until(async () => await panes[0].view.webContents.executeJavaScript("window.ticks") > hiddenTicks + 2, "hidden teacher continues running");
  mkdirSync(join(root, ".artifacts"), { recursive: true });
  writeFileSync(join(root, ".artifacts", "browser-single-test.png"), (await browser.window.capturePage()).toPNG());
  await browser.window.webContents.executeJavaScript("document.querySelector('[data-mode=grid]').click()");
  await until(() => browser.state().mode === "grid", "grid restored");
  assert.ok(panes.every((pane) => pane.view.getVisible()));
  for (const pane of panes) assert.equal(await pane.view.webContents.executeJavaScript("document.querySelector('input').value"), String(pane.index));
  console.log("PASS: all five view modes preserve inputs and sessions; hidden screens keep running; switching releases held movement");

  browser.window.setContentSize(1237, 811);
  await until(() => {
    const last = browser.state().panes[3].bounds.outer;
    return last.x + last.width === 1229 && last.y + last.height === 803;
  }, "resize layout");
  const paneBeforeReload = panes[1].view.webContents;
  await browser.window.webContents.executeJavaScript("document.querySelectorAll('.reload')[1].click()");
  await until(() => paneBeforeReload.executeJavaScript("document.querySelector('input').value===''"), "pane reload");
  assert.equal(await paneBeforeReload.executeJavaScript("localStorage.getItem('account')"), "9991");
  assert.equal(await panes[2].view.webContents.executeJavaScript("document.querySelector('input').value"), "2");
  console.log("PASS: resize keeps all four panes inside the window; reload affects only its own pane");

  const screenshotPath = join(root, ".artifacts", "browser-test.png");
  mkdirSync(join(root, ".artifacts"), { recursive: true });
  writeFileSync(screenshotPath, (await browser.window.capturePage()).toPNG());

  const children = panes.map((pane) => pane.view.webContents);
  const closed = once(browser.window, "closed");
  browser.window.close();
  await closed;
  await until(() => children.every((contents) => contents.isDestroyed()), "previous page processes close");
  browser = createBrowser(settings, { maximize: false });
  await until(() => browser.state().panes[0].status === "ready", "reopened teacher");
  assert.ok(browser.state().panes.slice(1).every((pane) => pane.status === "off"));
  await enableStudents(browser);
  for (const [index, account] of ["teacher", "9991", "9992", "9993"].entries()) {
    assert.equal(await browser.panes[index].view.webContents.executeJavaScript("localStorage.getItem('account')"), account);
    assert.equal(await browser.panes[index].view.webContents.executeJavaScript("window.load()"), account);
  }
  console.log("PASS: browser reopen retains each client's stored data and closes previous page processes");

  const unavailable = browser.panes[2];
  await unavailable.view.webContents.loadURL(`http://127.0.0.1:${server.address().port}/offline`).catch(() => {});
  await until(() => browser.state().panes[2].status === "error", "connection error");
  await browser.window.webContents.executeJavaScript("document.querySelectorAll('.reload')[2].click()");
  await until(() => browser.state().panes[2].status === "ready", "retry original student URL");
  assert.equal(await unavailable.view.webContents.executeJavaScript("localStorage.getItem('account')"), "9992");
  console.log("PASS: connection failure is visible and retry restores the original URL and account storage");
  console.log(`Screenshot: ${screenshotPath}`);
  browser.window.close();
  server.close();
  app.exit(0);
} catch (error) {
  console.error(error);
  if (browser && !browser.window.isDestroyed()) {
    mkdirSync(join(root, ".artifacts"), { recursive: true });
    writeFileSync(join(root, ".artifacts", "browser-failure.png"), (await browser.window.capturePage()).toPNG());
  }
  if (browser && !browser.window.isDestroyed()) console.error(JSON.stringify({ state: browser.state(), visible: browser.window.isVisible(), shellUrl: browser.window.webContents.getURL(), shellLoading: browser.window.webContents.isLoading() }, null, 2));
  if (browser && !browser.window.isDestroyed()) for (const pane of browser.panes) console.error(pane.index, await pane.view.webContents.executeJavaScript("({input:document.querySelector('input')?.value,focused:document.activeElement?.tagName,hasFocus:document.hasFocus(),lastMouse:window.lastMouse,rect:document.querySelector('input')?.getBoundingClientRect().toJSON()})"));
  if (browser && !browser.window.isDestroyed()) browser.window.destroy();
  server.close();
  app.exit(1);
}
}
void run();
