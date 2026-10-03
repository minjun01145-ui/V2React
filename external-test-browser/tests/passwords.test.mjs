import { app, safeStorage } from "electron";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdirSync, readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { once } from "node:events";
import { build } from "esbuild";
import { createBrowser } from "../browser.mjs";
import { parseSettings } from "../settings.mjs";
import { readLogin, saveLogin } from "../passwords.mjs";

const root = resolve(import.meta.dirname, "..");
const profile = join(root, ".test-profile", randomUUID());
mkdirSync(profile, { recursive: true });
app.setPath("userData", profile);
app.setPath("sessionData", profile);
app.on("window-all-closed", () => {}); // Keep the test process alive to verify reopen.

// Real React controlled inputs and a two-step student login, but no Firebase.
const fixtureSource = `
import React, {useState} from 'react';import {createRoot} from 'react-dom/client';
function Login(){
 const teacher=location.pathname==='/teacher/';
 const [number,setNumber]=useState(''),[name,setName]=useState(''),[email,setEmail]=useState(''),[password,setPassword]=useState(''),[pin,setPin]=useState(''),[confirmation,setConfirmation]=useState('');
 const [stage,setStage]=useState('identity'),[error,setError]=useState('');
 window.fixture={number,name,email,password,pin,stage,reset:()=>{setNumber('');setName('');setEmail('');setPassword('');setPin('');setConfirmation('');setError('');setStage('identity')}};
 const setup=number==='9994';
 function submit(event){event.preventDefault();setError('');window.loginAttempts=(window.loginAttempts||0)+1;
 if(!teacher&&stage==='identity'){setStage('pin');return;}
 const secret=teacher?password:pin;
 if(secret==='0000'||(setup&&pin!==confirmation)){setError('로그인 실패');setPin('');setPassword('');return;}
 setStage('success');}
 if(stage==='success')return teacher?<nav aria-label='교사용 메뉴'>대기실</nav>:<header><h1>대기실</h1><button>다른 학생으로 로그인</button></header>;
 if(teacher)return <form onSubmit={submit}><input id='admin-email' value={email} onChange={e=>setEmail(e.target.value)}/><input id='admin-password' type='password' value={password} onChange={e=>setPassword(e.target.value)}/>{error&&<p role='alert'>{error}</p>}<button>입장</button></form>;
 return <><form onSubmit={submit}><input id='student-number' value={number} onChange={e=>setNumber(e.target.value)}/><input id='student-name' value={name} onChange={e=>setName(e.target.value)}/><button>로그인</button></form>{stage==='pin'&&<div role='dialog'><form onSubmit={submit}><input type='password' name='pin' autoComplete={setup?'new-password':'current-password'} value={pin} onChange={e=>setPin(e.target.value)}/>{setup&&<input type='password' name='pinConfirmation' autoComplete='new-password' value={confirmation} onChange={e=>setConfirmation(e.target.value)}/>}<button type='button' onClick={()=>setStage('identity')}>취소</button>{error&&<p role='alert'>{error}</p>}<button>교실 입장</button></form></div>}</>;
}
document.addEventListener('pointerdown',e=>window.fixtureTrustedInput=e.isTrusted);
createRoot(document.querySelector('#root')).render(<Login/>);`;
let fixtureBundle;
const server = createServer((request, response) => {
  if (request.url.startsWith("/fixture.js")) {
    response.writeHead(200, { "Content-Type": "text/javascript" });
    response.end(fixtureBundle);
  } else {
    response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    response.end('<!doctype html><html><meta charset="utf-8"><div id="root"></div><script src="/fixture.js"></script></html>');
  }
});

async function until(predicate, label) {
  const deadline = Date.now() + 10000;
  while (!(await predicate())) {
    if (Date.now() > deadline) throw new Error(`Timed out: ${label}`);
    await new Promise((resolve) => setTimeout(resolve, 40));
  }
}
async function input(contents, selector, value) {
  await contents.executeJavaScript(`(()=>{
    const input=document.querySelector(${JSON.stringify(selector)});
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,${JSON.stringify(value)});
    input.dispatchEvent(new Event('input',{bubbles:true}));
  })()`);
}
async function submit(contents, selector) {
  await contents.executeJavaScript(`document.querySelector(${JSON.stringify(selector)}).requestSubmit()`);
}
async function reload(contents) {
  const loaded = once(contents, "did-finish-load");
  contents.reload();
  await loaded;
  await until(() => contents.executeJavaScript("Boolean(window.fixture)"), "React fixture reload");
}
async function close(browser) {
  const children = browser.panes.map((pane) => pane.view.webContents);
  const closed = once(browser.window, "closed");
  browser.window.close();
  await closed;
  await until(() => children.every((contents) => contents.isDestroyed()), "child pages close");
}
async function enableStudents(browser) {
  await until(() => browser.window.webContents.executeJavaScript("document.querySelectorAll('.enable').length === 4"), "pane controls ready");
  await browser.window.webContents.executeJavaScript("document.querySelectorAll('.enable').forEach((button, index) => { if(index) button.click(); })");
  await until(() => browser.state().panes.every((pane) => pane.status === "ready"), "student pages ready");
}
async function manualLogin(page) {
  // Real user input stops automation before switching to a different account.
  page.focus();
  await until(() => browser.window.isFocused() && page.isFocused(), "manual login page focused");
  await page.executeJavaScript("window.fixtureTrustedInput=false");
  page.sendInputEvent({ type: "mouseMove", x: 45, y: 45 });
  page.sendInputEvent({ type: "mouseDown", x: 45, y: 45, button: "left", clickCount: 1 });
  page.sendInputEvent({ type: "mouseUp", x: 45, y: 45, button: "left", clickCount: 1 });
  await until(() => page.executeJavaScript("window.fixtureTrustedInput===true"), "trusted user input delivered");
  await page.executeJavaScript("window.fixture.reset()");
  await until(() => page.executeJavaScript("Boolean(document.querySelector('#admin-password, #student-number'))"), "manual login form");
}
let browser;
async function run() {
  try {
    await app.whenReady();
    assert.ok(safeStorage.isEncryptionAvailable());
    const result = await build({ stdin: { contents: fixtureSource, loader: "jsx", resolveDir: root }, bundle: true, write: false, platform: "browser" });
    fixtureBundle = result.outputFiles[0].text;
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    const siteUrl = `http://127.0.0.1:${server.address().port}/?tenant=hana&room=fixture`;
    const settings = parseSettings({ siteUrl });
    browser = createBrowser(settings, { maximize: false });
    await enableStudents(browser);
    const contents = browser.panes.map((pane) => pane.view.webContents);
    for (const page of contents) await until(() => page.executeJavaScript("Boolean(window.fixture)"), "React login ready");
    assert.equal(readLogin(0, siteUrl), null);
    assert.equal(readLogin(1, siteUrl), null);

    const teacherPassword = `teacher-${randomUUID()}`;
    await input(contents[0], "#admin-email", "teacher@example.test");
    await input(contents[0], "#admin-password", teacherPassword);
    await submit(contents[0], "form");
    await until(() => readLogin(0, siteUrl)?.password === teacherPassword, "successful teacher login remembered");
    for (const index of [1, 2, 3]) {
      await input(contents[index], "#student-number", String(9990 + index));
      await input(contents[index], "#student-name", `샘플${index}`);
      await submit(contents[index], "form");
      await until(() => contents[index].executeJavaScript("Boolean(document.querySelector('[name=pin]'))"), "PIN dialog");
      await input(contents[index], "[name=pin]", String(1110 + index));
      await submit(contents[index], '[role="dialog"] form');
      await until(() => readLogin(index, siteUrl)?.pin === String(1110 + index), "successful student login remembered");
      assert.equal(await contents[index].executeJavaScript("typeof window.testBrowser"), "undefined");
      assert.equal(await contents[index].executeJavaScript("typeof require"), "undefined");
    }
    const files = readdirSync(join(profile, "remembered-logins"));
    assert.equal(files.length, 4);
    for (const name of files) {
      const bytes = readFileSync(join(profile, "remembered-logins", name));
      assert.ok(!bytes.includes(Buffer.from(teacherPassword)));
      assert.throws(() => JSON.parse(bytes.toString()));
    }
    assert.equal(readLogin(1, siteUrl.replace("tenant=hana", "tenant=minjun")), null);
    assert.equal(readLogin(1, siteUrl.replace("127.0.0.1", "localhost")), null);
    assert.equal(readLogin(1, siteUrl.replace("room=fixture", "room=another"))?.studentNumber, "9991");
    assert.throws(() => saveLogin(1, siteUrl, { studentNumber: "9991", name: "샘플", pin: "bad" }));
    console.log("PASS: successful teacher and student logins remembered separately; encrypted files; tenant/origin isolation; no page bridge");

    await close(browser);
    browser = createBrowser(settings, { maximize: false });
    await enableStudents(browser);
    const pages = browser.panes.map((pane) => pane.view.webContents);
    await until(() => pages[0].executeJavaScript("window.fixture?.stage==='success'"), "teacher automatically signed in");
    assert.equal(await pages[0].executeJavaScript("window.loginAttempts"), 1);
    for (const index of [1, 2, 3]) {
      await until(() => pages[index].executeJavaScript("window.fixture?.stage==='success'"), "student automatically signed in through identity and PIN");
      assert.equal(await pages[index].executeJavaScript("window.loginAttempts"), 2);
    }
    console.log("PASS: reopen automatically signs in teacher and all three students through real React forms, without manual submit");

    browser.window.show();
    browser.window.focus();
    for (const page of pages) await manualLogin(page);
    await until(() => pages[0].executeJavaScript(`window.fixture?.password===${JSON.stringify(teacherPassword)} && window.fixture.email==='teacher@example.test'`), "manual teacher autofill");
    for (const index of [1, 2, 3]) {
      await until(() => pages[index].executeJavaScript(`window.fixture?.number==='${9990 + index}' && window.fixture.name==='샘플${index}'`), "manual student autofill");
      await submit(pages[index], "form");
      await until(() => pages[index].executeJavaScript(`window.fixture.pin==='${1110 + index}'`), "student PIN autofill updates React state");
    }
    console.log("PASS: user interaction stops automatic submission and leaves manual login available");

    await input(pages[1], "[name=pin]", "0000");
    await submit(pages[1], '[role="dialog"] form');
    await until(() => pages[1].executeJavaScript("document.querySelector('[role=alert]')?.textContent==='로그인 실패'"), "failed student login");
    assert.equal(readLogin(1, siteUrl).pin, "1111");
    await pages[2].executeJavaScript("document.querySelector('[role=dialog] button[type=button]').click()");
    await until(() => pages[2].executeJavaScript("window.fixture.stage==='identity'"), "cancel PIN");
    assert.equal(readLogin(2, siteUrl).pin, "1112");
    await input(pages[0], "#admin-password", "0000");
    await submit(pages[0], "form");
    await until(() => pages[0].executeJavaScript("Boolean(document.querySelector('[role=alert]'))"), "failed teacher login");
    assert.equal(readLogin(0, siteUrl).password, teacherPassword);
    console.log("PASS: rejected logins and cancelled PIN dialogs do not overwrite saved passwords");

    await reload(pages[2]);
    await until(() => pages[2].executeJavaScript("window.fixture?.stage==='success'"), "student automatically signs back in");
    await manualLogin(pages[2]);
    await until(() => pages[2].executeJavaScript("window.fixture?.number==='9992'"), "saved identity");
    await input(pages[2], "#student-number", "9994");
    await input(pages[2], "#student-name", "새 계정");
    await submit(pages[2], "form");
    await until(() => pages[2].executeJavaScript("Boolean(document.querySelector('[name=pinConfirmation]'))"), "new PIN setup");
    assert.equal(await pages[2].executeJavaScript("document.querySelector('[name=pin]').value"), "");
    await input(pages[2], "[name=pin]", "4444");
    await input(pages[2], "[name=pinConfirmation]", "4444");
    await submit(pages[2], '[role="dialog"] form');
    await until(() => readLogin(2, siteUrl)?.pin === "4444", "newly created PIN remembered");
    assert.equal(readLogin(2, siteUrl).studentNumber, "9994");
    await reload(pages[3]);
    await until(() => pages[3].executeJavaScript("window.fixture?.stage==='success'"), "third student automatically signs back in");
    await manualLogin(pages[3]);
    await until(() => pages[3].executeJavaScript("window.fixture?.number==='9993'"), "saved identity");
    await input(pages[3], "#student-number", "1234");
    await input(pages[3], "#student-name", "다른 학생");
    await submit(pages[3], "form");
    await until(() => pages[3].executeJavaScript("Boolean(document.querySelector('[name=pin]'))"), "other student's PIN");
    assert.equal(await pages[3].executeJavaScript("document.querySelector('[name=pin]').value"), "");
    console.log("PASS: old PIN never fills another student's login or a new PIN setup; successful setup can be remembered");

    await pages[3].loadURL(siteUrl.replace("tenant=hana", "tenant=minjun"));
    await until(() => pages[3].executeJavaScript("Boolean(window.fixture)"), "different tenant's login");
    assert.equal(await pages[3].executeJavaScript("window.fixture.number"), "");
    assert.equal(await pages[3].executeJavaScript("window.fixture.name"), "");
    await pages[3].loadURL(siteUrl.replace("127.0.0.1", "localhost"));
    await until(() => pages[3].executeJavaScript("Boolean(window.fixture)"), "different origin's login");
    assert.equal(await pages[3].executeJavaScript("window.fixture.number"), "");
    assert.equal(await pages[3].executeJavaScript("window.fixture.name"), "");
    console.log("PASS: navigating a pane to a different tenant or origin never autofills its stored login");

    saveLogin(0, siteUrl, { email: "teacher@example.test", password: "0000" });
    await reload(pages[0]);
    await until(() => pages[0].executeJavaScript("Boolean(document.querySelector('[role=alert]'))"), "automatic login failure shown");
    await pages[0].executeJavaScript("document.body.append(document.createElement('div'))");
    await pages[0].executeJavaScript("new Promise(resolve=>setTimeout(resolve,200))");
    assert.equal(await pages[0].executeJavaScript("window.loginAttempts"), 1);
    assert.equal(await pages[0].executeJavaScript("document.querySelector('#admin-password').value"), "");
    saveLogin(0, siteUrl, { email: "teacher@example.test", password: teacherPassword });
    console.log("PASS: automatic login errors stop after one attempt and remain editable");

    await close(browser);
    browser = null;
    server.close();
    app.exit(0);
  } catch (error) {
    console.error(error.message); // Never print entered passwords or saved data.
    if (browser && !browser.window.isDestroyed()) {
      for (const pane of browser.panes) console.error("Login stage:", pane.index, await pane.view.webContents.executeJavaScript("({stage:window.fixture?.stage,attempts:window.loginAttempts,hasPassword:Boolean(document.querySelector('#admin-password')),hasPin:Boolean(document.querySelector('[name=pin]'))})"));
    }
    if (browser && !browser.window.isDestroyed()) browser.window.destroy();
    server.close();
    app.exit(1);
  }
}
void run();
