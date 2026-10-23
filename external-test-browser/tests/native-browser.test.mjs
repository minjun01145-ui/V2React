import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { once } from "node:events";
import { build } from "esbuild";

if (process.platform !== "win32") throw new Error("The native console regression requires Windows.");
const root = resolve(import.meta.dirname, "..", "..");
const artifacts = join(root, ".cache", "classroom-native", "tests");
mkdirSync(artifacts, { recursive: true });
const profile = mkdtempSync(join(artifacts, "run-"));
const fixture = `
import React,{useState}from'react';import{createRoot}from'react-dom/client';
function Login(){const teacher=location.pathname==='/teacher/';
const[number,setNumber]=useState(''),[name,setName]=useState(''),[email,setEmail]=useState(''),[password,setPassword]=useState(''),[pin,setPin]=useState(''),[confirmation,setConfirmation]=useState(''),[stage,setStage]=useState('identity'),[error,setError]=useState('');
window.fixture={number,name,email,password,pin,stage,reset:()=>{setNumber('');setName('');setEmail('');setPassword('');setPin('');setConfirmation('');setError('');setStage('identity')}};
function submit(e){e.preventDefault();setError('');window.loginAttempts=(window.loginAttempts||0)+1;if(!teacher&&stage==='identity'){setStage('pin');return;}if((teacher?password:pin)==='0000'||(number==='9994'&&pin!==confirmation)){setError('로그인 실패');setPin('');setPassword('');return;}setStage('success');}
if(stage==='success')return teacher?<nav aria-label="교사용 메뉴">대기실</nav>:<header><h1>대기실</h1><button>다른 학생으로 로그인</button></header>;
if(teacher)return <form onSubmit={submit}><h1>교사 로그인</h1><input id="admin-email" value={email} onChange={e=>setEmail(e.target.value)}/><input id="admin-password" type="password" value={password} onChange={e=>setPassword(e.target.value)}/>{error&&<p role="alert">{error}</p>}<button>입장</button></form>;
return <><form onSubmit={submit}><h1>학생 로그인</h1><input id="student-number" value={number} onChange={e=>setNumber(e.target.value)}/><input id="student-name" value={name} onChange={e=>setName(e.target.value)}/><button>로그인</button></form>{stage==='pin'&&<div role="dialog"><form onSubmit={submit}><input name="pin" autoComplete={number==='9994'?'new-password':'current-password'} type="password" value={pin} onChange={e=>setPin(e.target.value)}/>{number==='9994'&&<input name="pinConfirmation" type="password" value={confirmation} onChange={e=>setConfirmation(e.target.value)}/ >}{error&&<p role="alert">{error}</p>}<button>입장</button></form></div>}</>;}
window.ticks=0;setInterval(()=>window.ticks++,40);
window.framesRendered=0;function frame(){window.framesRendered++;requestAnimationFrame(frame)}requestAnimationFrame(frame);
window.saveAccount=async(value)=>{localStorage.setItem('account',value);document.cookie='account='+value+';path=/';const db=await new Promise((resolve,reject)=>{const request=indexedDB.open('accounts',1);request.onupgradeneeded=()=>request.result.createObjectStore('values');request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error)});await new Promise(resolve=>{const tx=db.transaction('values','readwrite');tx.objectStore('values').put(value,'account');tx.oncomplete=resolve});db.close();};
window.loadAccount=async()=>{const db=await new Promise(resolve=>{const request=indexedDB.open('accounts',1);request.onsuccess=()=>resolve(request.result)});return await new Promise(resolve=>{const request=db.transaction('values').objectStore('values').get('account');request.onsuccess=()=>{db.close();resolve(request.result)}});};
createRoot(document.getElementById('root')).render(<Login/>);`;
const bundle = await build({ stdin: { contents: fixture, loader: "jsx", resolveDir: root }, bundle: true, write: false, platform: "browser" });
let requests = 0;
const server = createServer((request, response) => {
  if (request.url.startsWith("/offline")) { response.destroy(); return; }
  response.setHeader("Cache-Control", "public, max-age=31536000, immutable");
  if (request.url.startsWith("/cached-resource")) { requests++; response.end("cacheable resource"); return; }
  if (request.url.startsWith("/fixture.js")) { response.setHeader("Content-Type", "text/javascript"); response.end(bundle.outputFiles[0].text); return; }
  response.setHeader("Content-Type", "text/html; charset=utf-8");
  response.end('<!doctype html><meta charset="utf-8"><style>body{font:18px system-ui;padding:24px;background:#f4f6fa}input,button{font:inherit;padding:10px;margin:4px;max-width:90%}</style><div id="root"></div><script src="/fixture.js"></script>');
});

async function run(command, args) {
  const child = spawn(command, args, { cwd: root, stdio: "inherit", windowsHide: command.toLowerCase().endsWith("powershell.exe") });
  const timeout = setTimeout(() => child.kill(), 150000);
  try { const [code] = await once(child, "exit"); return code; }
  finally { clearTimeout(timeout); }
}
try {
  assert.equal(await run("powershell.exe", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", "external-test-browser/windows/build.ps1", "-Tests"]), 0);
  server.listen(0, "127.0.0.1"); await once(server, "listening");
  const portableFolder = join(profile, "portable");
  mkdirSync(portableFolder);
  const executable = join(portableFolder, "ConsoleTests.exe");
  copyFileSync(join(root, ".cache", "classroom-native", "ConsoleTests.exe"), executable);
  const code = await run(executable, [profile, `http://127.0.0.1:${server.address().port}/?tenant=hana&room=fixture`]);
  const report = JSON.parse(readFileSync(join(profile, "report.json"), "utf8").replace(/^\uFEFF/, ""));
  for (const check of report.checks) console.log("PASS:", check);
  assert.ok(report.passed, `${report.error}\n${report.stack}`);
  assert.equal(code, 0);
  assert.equal(requests, 8, "A cacheable resource was reused by the browser cache");
  console.log(`Screenshots: ${profile}`);
} finally { server.close(); }
