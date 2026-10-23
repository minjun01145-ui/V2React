import { app, BrowserWindow } from "electron";
import assert from "node:assert/strict";
import { resolve } from "node:path";
import { createServer } from "../../node_modules/vite/dist/node/index.js";

app.on("window-all-closed", () => {});
const root = resolve(import.meta.dirname, "../..");

// Keep React, subscription hooks, session orchestration and popup UI real. Only
// persistence, game asset preparation and unrelated screens are replaced.
const repository = String.raw`
export function subscribePlayer(room, player, onValue) { return window.testData.subscribe('player:' + room + ':' + player, onValue); }
export function subscribePlayers(_room, onValue) { onValue([]); return () => {}; }
export function subscribeSession(room, onValue) { return window.testData.subscribe('session:' + room, value => onValue(value?.session ?? null)); }
export async function ensureSession() {}
export async function touchPlayer(room, player) { window.testData.heartbeats.push({room, player}); }
export function joinSession(input) { return new Promise((resolve, reject) => window.testData.joins.push({input, resolve, reject})); }
export async function confirmRoundReady(room, round, player) { window.testData.ready.push({room, round, player}); }
export async function leaveSession() { if (window.testData.failLeave) throw new Error('방 정리 실패'); }
export async function updatePlayerAvatar(room, player, avatar) {
  window.testData.avatarWrites++;
  if (window.testData.failAvatar) throw new Error('캐릭터 동기화 실패');
  const key = 'player:' + room + ':' + player;
  window.testData.set(key, {...window.testData.values[key], avatar});
}
`;
const preparation = String.raw`
export function prepareStudentRound(input) {
  return new Promise((resolve, reject) => {
    const pending = {input, releases: 0, reject};
    pending.resolve = () => resolve({release: () => pending.releases++});
    window.testData.preparations.push(pending);
  });
}
`;
const fixture = String.raw`<!doctype html><html lang="ko"><meta charset="utf-8"><body>
<div id="root"></div><script type="module">
import React, {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import {useStudentSession} from '/src/features/student/session/useStudentSession.ts';
import StudentPage from '/src/features/student/StudentPage.tsx';
import StudentLobbyPage from '/src/features/student/lobby/StudentLobbyPage.tsx';
import {PopupProvider, usePopup} from '/src/shared/popup/index.ts';
import '/src/styles/tokens.css';

const data = window.testData = {
  values: {}, listeners: new Map(), preparations: [], joins: [], ready: [], heartbeats: [],
  failLeave: false, failLogout: false, failAvatar: false, logouts: 0, avatarWrites: 0,
  equippedAvatar: null,
  subscribe(key, listener) {
    const listeners = this.listeners.get(key) ?? new Set();
    this.listeners.set(key, listeners); listeners.add(listener);
    listener(this.values[key] ?? null);
    return () => listeners.delete(listener);
  },
  set(key, value) { this.values[key] = value; this.listeners.get(key)?.forEach(listener => listener(value)); },
};
let room = 'room-1';
let identity = {uid:'student-1', tenantId:'minjun', studentNumber:'1', displayName:'학생1'};
const logout = async () => { data.logouts++; if (data.failLogout) throw new Error('로그아웃 실패'); };
window.configure = (status = 'preparing', round = 'round-1', nextRoom = room, uid = identity.uid) => {
  room = nextRoom; identity = {...identity, uid};
  const player = {id:uid, playerId:uid, studentNumber:'1', displayName:'학생1', nickname:null,
    state:'waiting', joinedAtMs:1, lastSeenAtMs:Date.now(), avatar:null};
  data.set('player:' + room + ':' + uid, player);
  if (round) data.set('participant:' + room + ':' + round + ':' + uid, {...player});
  data.set('session:' + room, {session:{id:room, roomId:room, tenantId:'minjun', gameId:'simple-quiz',
    status, roundId:round, gameConfig:null, expectedPlayerIds:[uid]}, slideShow:null});
};
function Probe() {
  const session = useStudentSession({roomId:room, identity, onChangeStudent:logout});
  return React.createElement('div', null,
    React.createElement('output', {'data-view':session.state.view}, session.state.error?.message ?? session.state.view),
    React.createElement('button', {onClick:() => void session.joinWithNickname({nickname:'별명', nicknameGrade:null}).catch(() => {})}, '입장'),
    React.createElement('button', {onClick:session.retryJoin}, '다시 시도'),
    React.createElement('button', {onClick:() => void session.leave().catch(() => {})}, '나가기'));
}
function PopupProbe() {
  window.popup = usePopup();
  return React.createElement('button', null, '팝업 열기');
}
const root = createRoot(document.querySelector('#root'));
window.mount = (mode = 'session', strict = false) => {
  const player = data.values['player:' + room + ':' + identity.uid];
  const child = mode === 'page' ? React.createElement(StudentPage, {roomId:room, identity, onChangeStudent:logout})
    : mode === 'lobby' ? React.createElement(StudentLobbyPage, {roomId:room,
      session:data.values['session:' + room].session, player, identity, onLeave:logout})
    : mode === 'popup' ? React.createElement(PopupProbe) : React.createElement(Probe);
  const content = React.createElement(PopupProvider, null, child);
  root.render(strict ? React.createElement(StrictMode, null, content) : content);
};
window.unmount = () => root.render(null);
window.mountInvalidAddress = async role => {
  history.replaceState(null, '', '?tenant=unknown');
  const {default:App} = role === 'student'
    ? await import('/src/apps/student/StudentApp.tsx')
    : await import('/src/apps/teacher/TeacherApp.tsx');
  root.render(React.createElement(App));
};
window.fixtureReady = true;
</script></body></html>`;

let server, window;
const evaluate = code => window.webContents.executeJavaScript(code, true);
async function until(code, label) {
  const deadline = Date.now() + 30_000;
  while (!await evaluate(`Boolean(${code})`)) {
    if (Date.now() > deadline) throw new Error(`Timed out: ${label}`);
    await new Promise(resolve => setTimeout(resolve, 25));
  }
}
async function settle() {
  await evaluate("new Promise(resolve => setTimeout(resolve, 50))");
}
async function reset() {
  await window.loadURL(`${server.resolvedUrls.local[0]}__student-session-test`);
  await until("window.fixtureReady", "fixture ready");
}
async function click(label) {
  await evaluate(`(() => { const button = [...document.querySelectorAll('button')].find(b => b.textContent.trim() === ${JSON.stringify(label)}); button.focus(); button.click(); })()`);
}
async function key(keyCode, modifiers = []) {
  window.webContents.sendInputEvent({type:"keyDown", keyCode, modifiers});
  window.webContents.sendInputEvent({type:"keyUp", keyCode, modifiers});
  await settle();
}

let exitCode = 0;
async function run() {
  try {
    await app.whenReady();
    server = await createServer({root, server:{host:"127.0.0.1", port:0}, plugins:[{
      name:"student-session-test-boundaries", enforce:"pre",
      load(id) {
        const file = id.split("?")[0].replaceAll("\\", "/");
        if (file.endsWith("/multiplayer/repository.ts")) return repository;
        if (file.endsWith("/multiplayer/round-participants/repository.ts")) return `
          export function subscribeRoundParticipant(room, round, player, onValue) { return window.testData.subscribe('participant:' + room + ':' + round + ':' + player, onValue); }
          export function subscribeRoundParticipants(_room, _round, onValue) { onValue([]); return () => {}; }`;
        if (file.endsWith("/multiplayer/round-readiness/repository.ts")) return "export function subscribeRoundReadiness(_room, _round, onValue) { onValue([]); return () => {}; }";
        if (file.endsWith("/slide-show/multiplayerService.ts")) return "export function subscribeSlideShowSession(room, onValue) { return window.testData.subscribe('session:' + room, onValue); }";
        if (file.endsWith("/session/prepareStudentRound.ts")) return preparation;
        if (file.endsWith("/student-data/cosmetics/StudentCharacterProvider.tsx")) return `
          export function StudentCharacterProvider({children}) { return children; }
          export function useStudentCharacter() { return {cosmetics:{equippedAvatar:window.testData.equippedAvatar}, loading:false, error:null}; }`;
        if (file.endsWith("/student-data/cosmetics/repository.ts")) return "export const equippedAvatarKey = value => JSON.stringify(value);";
        if (["/lobby/WaitingRoom.tsx", "/lobby/WaitingRoomSkeleton.tsx", "/lobby/NicknamePrompt.tsx", "/game/StudentGamePage.tsx",
          "/login/StudentLoginPage.tsx", "/auth/AdminLoginPage.tsx", "/teacher/TeacherWorkspace.tsx"].some(name => file.endsWith(name))) return "export default function UnrelatedScreen() { return null; }";
        if (file.endsWith("/auth/hooks.ts")) return "export const useStudentAuth = () => { throw new Error('Invalid address must not authenticate'); }; export const useAdminAuth = useStudentAuth;";
        if (file.endsWith("/auth/studentAuth.ts")) return "export async function clearStudentLogin() {}";
        if (file.endsWith("/fonts/useAppFont.ts")) return "export function useAppFont() { throw new Error('Invalid address must not subscribe'); }";
      },
      configureServer(vite) {
        vite.middlewares.use(async (request, response, next) => {
          if (request.url.split("?")[0] !== "/__student-session-test") return next();
          try { response.setHeader("Content-Type", "text/html"); response.end(await vite.transformIndexHtml("/__student-session-test", fixture)); }
          catch (error) { next(error); }
        });
      },
    }]});
    await server.listen();
    window = new BrowserWindow({show:false, width:1000, height:800, webPreferences:{contextIsolation:true, nodeIntegration:false, backgroundThrottling:false}});
    window.webContents.on("console-message", event => { if (event.level === "error") console.error("BROWSER:", event.message); });

    await reset();
    await evaluate("configure(); mount()");
    await until("testData.preparations.length === 1", "preparation starts");
    await evaluate("unmount()");
    await until("!document.querySelector('output')", "session unmounts");
    await evaluate("testData.preparations[0].resolve()");
    await settle();
    assert.equal(await evaluate("testData.ready.length"), 0, "leaving during preparation must not mark the student ready later");
    assert.equal(await evaluate("testData.preparations[0].releases"), 1, "late preparation releases its resources");
    console.log("Late preparation cleanup passed");

    await reset();
    await evaluate("configure(); mount()");
    await until("testData.preparations.length === 1", "old round starts preparing");
    await evaluate("testData.set('session:room-1', {session:{...testData.values['session:room-1'].session, roundId:'round-2'}, slideShow:null})");
    await settle();
    await evaluate("testData.preparations[0].resolve()");
    await settle();
    assert.equal(await evaluate("testData.ready.length"), 0, "an old round must be invalidated even before the new participant snapshot arrives");
    assert.equal(await evaluate("testData.preparations[0].releases"), 1);
    await evaluate("testData.set('participant:room-1:round-2:student-1', testData.values['player:room-1:student-1'])");
    await until("testData.preparations.length === 2", "new round starts preparing");
    await evaluate("testData.preparations[1].resolve()");
    await until("testData.ready.length === 1", "new round confirms readiness");
    assert.equal(await evaluate("testData.ready[0].round"), "round-2");
    await evaluate("unmount()");
    await settle();
    assert.equal(await evaluate("testData.preparations[1].releases"), 1);
    console.log("Round change preparation cleanup passed");

    await reset();
    await evaluate("configure(); mount()");
    await until("testData.preparations.length === 1", "first scope prepares");
    await evaluate("configure('preparing', 'round-1', 'room-2', 'student-2'); mount()");
    await until("testData.preparations.length === 2", "same round ID in a new room/student prepares again");
    await evaluate("testData.preparations[0].reject(new Error('이전 방 오류')); testData.preparations[1].resolve()");
    await until("testData.ready.length === 1", "current scope confirms readiness");
    assert.deepEqual(await evaluate("testData.ready[0]"), {room:"room-2", round:"round-1", player:"student-2"});
    assert.equal(await evaluate("document.querySelector('output').dataset.view"), "preparing");
    console.log("Room/student scope isolation passed");

    await reset();
    await evaluate("configure(); mount('session', true)");
    await until("testData.preparations.length > 0", "preparation starts in StrictMode");
    await settle();
    const initialPreparation = await evaluate("testData.preparations.length - 1");
    await evaluate(`testData.preparations.slice(0, ${initialPreparation}).forEach(pending => pending.resolve()); testData.preparations[${initialPreparation}].reject(new Error('준비 실패'))`);
    await until("document.querySelector('output')?.dataset.view === 'readiness-error'", "preparation error shown");
    await click("다시 시도");
    await until(`testData.preparations.length > ${initialPreparation + 1}`, "readiness retry starts");
    const retriedPreparation = await evaluate("testData.preparations.length - 1");
    await evaluate(`testData.preparations[${retriedPreparation}].resolve()`);
    await until("testData.ready.length === 1", "retry succeeds without stale confirmation");
    assert.equal(await evaluate(`testData.preparations.slice(0, ${initialPreparation}).every(pending => pending.releases === 1)`), true);
    for (const status of ["playing", "waiting"]) {
      await evaluate(`configure('${status}', ${status === "waiting" ? "null" : "'round-1'"}); mount('session', true)`);
      await until(`document.querySelector('output')?.dataset.view === '${status === "playing" ? "playing" : "lobby"}'`, "session transition");
      const before = await evaluate("testData.heartbeats.length");
      await evaluate("window.dispatchEvent(new Event('online'))");
      assert.equal(await evaluate("testData.heartbeats.length"), before + 1, "presence remains active across game/lobby transitions");
    }
    await evaluate("unmount()");
    await settle();
    const stopped = await evaluate("testData.heartbeats.length");
    await evaluate("window.dispatchEvent(new Event('online')); window.dispatchEvent(new Event('focus')); document.dispatchEvent(new Event('visibilitychange'))");
    assert.equal(await evaluate("testData.heartbeats.length"), stopped, "unmount removes heartbeat listeners");
    assert.equal(await evaluate(`testData.preparations[${retriedPreparation}].releases`), 1);
    assert.equal(await evaluate("[...testData.listeners.values()].every(listeners => listeners.size === 0)"), true, "unmount closes subscriptions");
    console.log("StrictMode readiness retry and real heartbeat cleanup passed");

    await reset();
    await evaluate("configure('waiting', null); testData.set('player:room-1:student-1', null); mount()");
    await until("document.querySelector('output')?.dataset.view === 'awaiting-nickname'", "nickname entry ready");
    await click("입장");
    await click("입장");
    assert.equal(await evaluate("testData.joins.length"), 1, "double entry submits only once");
    await evaluate("configure('waiting', null, 'room-2', 'student-2'); testData.set('player:room-2:student-2', null); mount()");
    await until("document.querySelector('output')?.dataset.view === 'awaiting-nickname'", "new identity ready");
    await evaluate("testData.joins[0].reject(new Error('이전 입장 오류'))");
    await settle();
    assert.equal(await evaluate("document.querySelector('output').dataset.view"), "awaiting-nickname", "stale join errors cannot replace the current screen");
    await click("입장");
    await until("testData.joins.length === 2", "new identity can join");
    await evaluate("testData.joins[1].resolve(); configure('waiting', null)");
    await until("document.querySelector('output')?.dataset.view === 'lobby'", "membership restores lobby");
    await evaluate("testData.failLeave = true");
    await click("나가기");
    await until("testData.logouts === 1", "remote cleanup failure still attempts local logout");

    await reset();
    await evaluate("configure('waiting', null); testData.failLogout = true; mount('lobby')");
    await until("document.querySelector('header button')", "lobby mounts");
    await click("다른 학생으로 로그인");
    await until("document.querySelector('[role=dialog]')?.textContent.includes('로그아웃 실패')", "logout failure is visible");
    assert.equal(await evaluate("document.querySelector('header button').disabled"), false, "failed logout can be retried");
    await key("Escape");
    await until("!document.querySelector('[role=dialog]')", "failure popup closes with Escape");
    assert.equal(await evaluate("document.activeElement === document.querySelector('header button')"), true, "popup restores focus");
    await evaluate("testData.failLogout = false");
    await click("다른 학생으로 로그인");
    await until("testData.logouts === 2", "logout retry succeeds");

    await reset();
    await evaluate("configure('waiting', null); testData.equippedAvatar = {characterId:'character-1'}; testData.failAvatar = true; mount('page')");
    await until("document.querySelector('[role=dialog]')?.textContent.includes('캐릭터 동기화 실패')", "avatar failure is visible");
    await evaluate("testData.failAvatar = false");
    await click("다시 시도");
    await until("testData.avatarWrites === 2 && !document.querySelector('[role=dialog]')", "avatar synchronization retries");

    await reset();
    await evaluate("mount('popup')");
    await until("window.popup", "popup provider mounts");
    await click("팝업 열기");
    await evaluate("void popup.requestInput({title:'입력 검증', fields:[{name:'first',label:'첫째'}, {name:'second',label:'둘째',autoFocus:true}]}).then(value => window.popupResult = value)");
    await until("document.activeElement?.getAttribute('name') === 'second'", "popup autofocus");
    assert.equal(await evaluate("document.querySelector('#root [role=dialog]')"), null, "the dialog is rendered outside the app root");
    await evaluate("[...document.querySelectorAll('[role=dialog] button')].at(-1).focus()");
    await key("Tab");
    assert.equal(await evaluate("document.activeElement?.getAttribute('name')"), "first", "Tab wraps inside the dialog");
    await key("Tab", ["shift"]);
    assert.equal(await evaluate("document.activeElement === [...document.querySelectorAll('[role=dialog] button')].at(-1)"), true, "Shift+Tab wraps backwards");
    await key("Escape");
    await until("window.popupResult === null && !document.querySelector('[role=dialog]')", "Escape cancels input");
    assert.equal(await evaluate("document.activeElement.textContent"), "팝업 열기");

    for (const role of ["student", "teacher"]) {
      await reset();
      await evaluate(`mountInvalidAddress('${role}')`);
      await until("document.querySelector('h1')?.textContent === '사용자 주소를 확인해 주세요'", "invalid tenant page");
      assert.equal(await evaluate("document.querySelector('[role=alert]')?.getAttribute('aria-busy')"), "false", "invalid tenant is an error, not loading");
      assert.equal(await evaluate("document.querySelector('a')?.getAttribute('href')"), "/", "invalid tenant offers a valid recovery link");
    }
    console.log("Student session browser tests passed: stale preparation, scope changes, StrictMode/retry, presence cleanup, duplicate joins, logout/avatar failures, popup keyboard behavior and invalid tenant recovery");
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
