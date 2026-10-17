import { app, BrowserWindow } from "electron";
import assert from "node:assert/strict";
import { resolve } from "node:path";
import { createServer } from "../../node_modules/vite/dist/node/index.js";

app.on("window-all-closed", () => {});
const root = resolve(import.meta.dirname, "../..");

/**
 * Regression fixture for taps that were swallowed during a pair's judgment: the cards live in a real
 * page, taps are real hit-tested mouse input, and the progress repository is a stub with a Firestore-like
 * round trip so a rushed student can be reproduced deterministically.
 */
const fixture = String.raw`<!doctype html><html lang="ko"><meta charset="utf-8"><body style="margin:0;background:#eef1f4">
<div id="stage" style="width:1100px;height:640px"></div>
<script type="module">
import React from 'react'; import {createRoot} from 'react-dom/client';
import MatchingAllStudentGame from '/src/games/matching/MatchingAllStudentGame.tsx';
import MatchingStudentGame from '/src/games/matching/MatchingStudentGame.tsx';
import '/src/styles/tokens.css';

const set = { id:'set-1', name:'검증 세트', type:'vocabulary', itemCount:8,
  items:Array.from({length:8},(_,index)=>({ id:'pair-'+index, sourceText:'word-'+(index+1), meaning:'뜻-'+(index+1) })) };
const player = { id:'a', playerId:'a', studentNumber:'1', displayName:'에이', nickname:null, state:'ready', joinedAtMs:1, lastSeenAtMs:1 };
const empty = () => ({ currentIndex:0, score:0, correctCount:0, attemptCount:0, combo:0, completedItemIds:[], lastResult:null, completedAtMs:null });

window.progressLatencyMs = 120;
window.progressState = { value: { ...empty(), revision:0, lastOperationId:null } };
window.listeners = new Set();
window.snapshot = () => ({ value:window.progressState.value, loading:false, error:null,
  revision:window.progressState.value.revision, lastOperationId:window.progressState.value.lastOperationId });
window.subscribeProgress = listener => { window.listeners.add(listener); listener(window.snapshot()); return () => window.listeners.delete(listener); };
window.commitProgress = (progress, attemptId) => {
  const revision = (window.progressState.value.revision ?? 0) + 1;
  window.progressState.value = { ...progress, revision, lastOperationId:attemptId };
  window.listeners.forEach(listener=>listener(window.snapshot()));
  return { progress, revision, duplicate:false };
};
window.resetProgress = () => { window.progressState.value = { ...empty(), revision:0, lastOperationId:null }; window.listeners.forEach(listener=>listener(window.snapshot())); };

const buttons = () => Array.from(document.querySelectorAll('#stage button.matchCard, #stage button'));
window.cards = () => buttons().map(button=>({ text:button.querySelector('strong')?.textContent ?? '', pressed:button.getAttribute('aria-pressed')==='true', exiting:button.getAttribute('data-exiting')==='true' }));
window.texts = () => window.cards().filter(card=>!card.exiting).map(card=>card.text);
window.pressed = () => window.cards().filter(card=>card.pressed && !card.exiting).map(card=>card.text);
window.rect = text => { const button = buttons().find(entry=>(entry.querySelector('strong')?.textContent ?? '')===text); if (!button) return null; const r = button.getBoundingClientRect(); return { cx:r.x+r.width/2, cy:r.y+r.height/2 }; };
window.matched = () => document.querySelector('#stage').textContent.match(/완성한 판(\d+)/)?.[1]
  ?? document.querySelector('#stage').textContent.match(/찾은 짝(\d+)/)?.[1] ?? null;
/** Real pairs currently on the board, as [term, meaning] text pairs. */
window.pairsOnBoard = () => { const texts = window.texts();
  return texts.filter(text=>/^word-/.test(text) && texts.includes(text.replace(/^word-/,'뜻-'))).map(term=>[term, term.replace(/^word-/,'뜻-')]); };

const root = createRoot(document.querySelector('#stage'));
window.mount = (mode, roundId) => {
  const session = { id:'room', tenantId:'default', roomId:'room', gameId:'matching', status:'playing', roundId,
    gameConfig:{ timedGameMode:'unlimited', 'matching-cards': mode === 'all' ? 'all' : 'partial' }, createdAtMs:1, updatedAtMs:1, startedAtMs:1, expectedPlayerIds:['a'] };
  const Game = mode === 'all' ? MatchingAllStudentGame : MatchingStudentGame;
  root.render(React.createElement(Game,{ key:roundId, roomId:'room', session, player, set }));
};
window.ready = true;
</script></body></html>`;

let server, window;
async function evaluate(code) {
  try { return await window.webContents.executeJavaScript(code, true); }
  catch (error) { throw new Error(`Browser expression failed: ${code}`, { cause: error }); }
}
async function until(code, label, timeout = 20000) {
  const deadline = Date.now() + timeout;
  while (!await evaluate(code)) { if (Date.now() > deadline) throw new Error(`Timed out: ${label}`); await new Promise(resolve => setTimeout(resolve, 25)); }
}
async function mouseClick(text) {
  const rect = await evaluate(`window.rect(${JSON.stringify(text)})`);
  if (!rect) throw new Error(`Card not on screen: ${text}`);
  const point = { x: Math.round(rect.cx), y: Math.round(rect.cy) };
  window.webContents.sendInputEvent({ type: "mouseMove", ...point });
  window.webContents.sendInputEvent({ type: "mouseDown", ...point, button: "left", clickCount: 1 });
  await new Promise(resolve => setTimeout(resolve, 12));
  window.webContents.sendInputEvent({ type: "mouseUp", ...point, button: "left", clickCount: 1 });
}
const pause = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function run() {
  let exitCode = 0;
  try {
    await app.whenReady();
    server = await createServer({ root, server: { host: "127.0.0.1", port: 0 }, plugins: [{
      name: "matching-browser-fixture",
      transform(code, id) {
        const path = id.replaceAll('\\', '/');
        if (path.endsWith('/src/multiplayer/game-progress/hooks.ts')) return `import { useEffect, useState } from 'react';
export function usePlayerGameProgress(){ const [value, setValue] = useState(()=>window.snapshot()); useEffect(()=>window.subscribeProgress(setValue), []); return value; }
export function useRoundAttempts(){ return { value:[], loading:false, error:null }; }
export function useRoundProgress(){ return { value:[], loading:false, error:null }; }`;
        if (path.endsWith('/src/multiplayer/game-progress/repository.ts')) return `export async function persistGameAttempt(input){ await new Promise(resolve=>setTimeout(resolve, window.progressLatencyMs)); return window.commitProgress(input.progress, input.attemptId); }
export async function persistGameProgress(input){ await new Promise(resolve=>setTimeout(resolve, window.progressLatencyMs)); return window.commitProgress(input.progress, input.operationId); }
export function subscribePlayerProgress(){ return ()=>{}; }
export function subscribeRoundAttempts(){ return ()=>{}; }
export function subscribeRoundProgress(){ return ()=>{}; }
export async function loadRoundProgress(){ return []; }`;
      },
      configureServer(vite) { vite.middlewares.use(async (request, response, next) => { if (request.url !== '/__matching-test') return next(); try { response.setHeader('Content-Type','text/html'); response.end(await vite.transformIndexHtml('/__matching-test', fixture)); } catch (error) { next(error); } }); },
    }] });
    await server.listen();
    window = new BrowserWindow({ show: false, width: 1400, height: 1600, webPreferences: { contextIsolation: true, nodeIntegration: false, backgroundThrottling: false } });
    await window.loadURL(`${server.resolvedUrls.local[0]}__matching-test`);
    await until('window.ready', 'fixture ready');
    await pause(600);

    let round = 0;
    for (const mode of ["all", "partial"]) {
      const label = mode === "all" ? "모든 카드" : "일부 카드";

      // A card tapped while the previous pair is judged must be selected, not swallowed.
      round += 1;
      await evaluate(`window.resetProgress(); window.mount(${JSON.stringify(mode)}, "round-${round}")`);
      await until('document.querySelectorAll("#stage button").length === 8', `${label} mount`);
      await pause(500);
      const board = await evaluate('window.texts()');
      const [term, meaning] = (await evaluate('window.pairsOnBoard()'))[0];
      const bystander = board.find(text => text !== term && text !== meaning);
      assert.ok(bystander, `${label}: 판정 중 누를 카드가 필요합니다`);
      await mouseClick(term);
      await mouseClick(meaning);
      await pause(40);
      await mouseClick(bystander);
      // The tap is queued while the pair is judged and applied once it settles, so wait it out.
      await until(`window.pressed().length > 0`, `${label} queued tap replayed`, 8000);
      assert.deepEqual(await evaluate('window.pressed()'), [bystander],
        `${label}: 판정 중에 누른 카드는 선택되어야 합니다`);
      await until(`window.pairsOnBoard().every(([remainingTerm]) => remainingTerm !== ${JSON.stringify(term)})`, `${label} first pair resolved`, 8000);

      // Taps made while a pair is judged must replay in order and land on the last card tapped.
      round += 1;
      await evaluate(`window.resetProgress(); window.mount(${JSON.stringify(mode)}, "round-${round}")`);
      await until('document.querySelectorAll("#stage button").length === 8', `${label} remount`);
      await pause(500);
      const rushBoard = await evaluate('window.texts()');
      const [rushTerm, rushMeaning] = (await evaluate('window.pairsOnBoard()'))[0];
      // Two cards of one kind: the second replaces the first as the selection, as a fresh board would.
      const sameKind = rushBoard.filter(text => text !== rushTerm && text !== rushMeaning
        && text.startsWith('word-') === rushTerm.startsWith('word-')).slice(0, 2);
      assert.equal(sameKind.length, 2, `${label}: 검증에는 같은 종류의 카드가 2장 필요합니다`);
      await mouseClick(rushTerm);
      await mouseClick(rushMeaning);
      await pause(40);
      await mouseClick(sameKind[0]);
      await mouseClick(sameKind[1]);
      await until(`window.pressed().length > 0`, `${label} chained taps replayed`, 8000);
      assert.deepEqual(await evaluate('window.pressed()'), [sameKind[1]],
        `${label}: 판정 중 연속으로 누른 카드는 마지막 하나로 선택되어야 합니다`);
      await until(`window.pairsOnBoard().every(([remainingTerm]) => remainingTerm !== ${JSON.stringify(rushTerm)})`, `${label} rush pair resolved`, 8000);

      // A whole pair tapped during the previous pair's judgment must still be scored.
      round += 1;
      await evaluate(`window.resetProgress(); window.mount(${JSON.stringify(mode)}, "round-${round}")`);
      await until('document.querySelectorAll("#stage button").length === 8', `${label} third mount`);
      await pause(500);
      const pairsNow = await evaluate('window.pairsOnBoard()');
      if (pairsNow.length >= 2) {
        const [firstTerm, firstMeaning] = pairsNow[0];
        const [nextTerm, nextMeaning] = pairsNow[1];
        await mouseClick(firstTerm);
        await mouseClick(firstMeaning);
        await pause(40);
        await mouseClick(nextTerm);
        await pause(40);
        await mouseClick(nextMeaning);
        await until(`window.matched() !== "0" || window.pairsOnBoard().every(([remainingTerm]) => remainingTerm !== ${JSON.stringify(nextTerm)})`, `${label} second pair counted`, 9000);
        const remaining = await evaluate('window.pairsOnBoard()');
        assert.equal(remaining.some(([remainingTerm]) => remainingTerm === nextTerm), false,
          `${label}: 판정 중 누른 짝 ${nextTerm}도 인정되어야 합니다`);
      }
    }
    console.log("Matching card tap regression tests passed");
  } catch (error) {
    console.error(error);
    exitCode = 1;
  } finally {
    await server?.close();
    app.exit(exitCode);
  }
}

run();
