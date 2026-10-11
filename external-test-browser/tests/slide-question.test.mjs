import { app, BrowserWindow } from "electron";
import assert from "node:assert/strict";
import { resolve } from "node:path";
import { mkdir, writeFile } from "node:fs/promises";
import { createServer } from "../../node_modules/vite/dist/node/index.js";

app.on("window-all-closed", () => {});
const root = resolve(import.meta.dirname, "../..");
const fixture = String.raw`<!doctype html><html><meta charset="utf-8"><body style="margin:0;background:#eef1f4"><div id="teacher" style="width:1000px;height:540px"></div><div id="student" style="width:1000px;height:540px"></div><div id="settings" style="width:600px"></div><script type="module">
import React from 'react'; import {createRoot} from 'react-dom/client';
import TeacherEngineWindow from '/src/features/teacher/slide-show-runtime/TeacherEngineWindow.tsx';
import QuestionStudentView from '/src/slide-question/ui/QuestionStudentView.tsx';
import SlideEnginePanel from '/src/features/teacher/slide-show/SlideEnginePanel.tsx';
import {newQuestion} from '/src/slide-question/model.ts';
import '/src/styles/tokens.css';
window.responses=[];window.grading={correctOptions:[0,2]};window.skin='normal';window.kind='slide-question';window.phase='answering';
window.question={type:'multiple-choice',prompt:'지구에서 가장 큰 바다는?',options:['태평양','대서양','인도양','북극해','남극해'],doublePoints:false};
const teacher=createRoot(document.querySelector('#teacher')); const student=createRoot(document.querySelector('#student')); const settings=createRoot(document.querySelector('#settings'));
window.renderTeacher=()=>{window.dispatchEvent(new Event('engine-data'));const round={gameId:window.kind,durationSeconds:300,gameConfig:{},source:window.kind==='free-response'?{kind:'free-response',prompt:'자유 답변'}:{kind:'slide-question',question:window.question}};const engine={slideId:'slide',roundId:'round',phase:window.phase,frame:{x:0,y:0,width:1000,height:540},round};const show={runId:'run',scoredRoundIds:['old-round','round'],awards:{},engine};teacher.render(React.createElement(TeacherEngineWindow,{roomId:'test',session:{status:'playing',roundId:'round',startedAtMs:Date.now(),gameConfig:{quizRoundDurationMs:300000}},slideShow:show,round,engine,timerSkin:window.skin,onTimerSkinChange:skin=>{window.skin=skin;window.renderTeacher()},starting:false,onStart(){}}));};
window.renderStudent=(props={})=>{student.render(React.createElement(QuestionStudentView,{key:Math.random(),question:window.question,response:null,closed:false,loading:false,onSubmit:async answer=>{window.submittedAnswer=answer},...props}));};
window.round={gameId:'slide-question',durationSeconds:20,gameConfig:{},source:newQuestion()};
window.renderSettings=()=>settings.render(React.createElement(SlideEnginePanel,{round:window.round,sets:[],disabled:false,issue:null,onChange:round=>{window.round=round;window.renderSettings()},onRemove(){}}));
window.renderTeacher();window.renderStudent();window.renderSettings();window.ready=true;
</script></body></html>`;
let server, window;
async function evaluate(code) {
  try { return await window.webContents.executeJavaScript(code, true); }
  catch (error) { throw new Error(`Browser expression failed: ${code}`, { cause: error }); }
}
async function key(keyCode) {
  window.webContents.sendInputEvent({type:'keyDown',keyCode});
  window.webContents.sendInputEvent({type:'keyUp',keyCode});
  await new Promise(resolve => setTimeout(resolve,30));
}
async function characters(text) {
  for (const keyCode of text) window.webContents.sendInputEvent({type:'char',keyCode});
  await new Promise(resolve => setTimeout(resolve,30));
}
async function until(code, label) {
  const deadline = Date.now() + 20000;
  while (!await evaluate(code)) { if (Date.now() > deadline) throw new Error(`Timed out: ${label}`); await new Promise(resolve => setTimeout(resolve, 30)); }
}
async function screenshot(name, selector) {
  await evaluate(`document.querySelector(${JSON.stringify(selector)}).scrollIntoView({block:'start'})`);
  await evaluate('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))');
  const bounds = await evaluate(`(()=>{const r=document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();return {x:Math.round(r.x),y:Math.round(r.y),width:Math.round(r.width),height:Math.round(r.height)}})()`);
  const image = await window.webContents.capturePage(bounds);
  const dir = process.env.ENGINE_SCREENSHOT_DIR || resolve(root, "node_modules/.cache/engine-screenshots");
  await mkdir(dir, { recursive: true }); const path = resolve(dir, `${name}.png`); await writeFile(path, image.toPNG()); console.log(`SCREENSHOT ${path}`);
}
async function run() {
let exitCode = 0;
try {
  await app.whenReady();
  server = await createServer({ root, server: { host: "127.0.0.1", port: 0 }, plugins: [{
    name: "engine-browser-fixture",
    transform(code, id) {
      const path = id.replaceAll('\\', '/');
      if (path.endsWith('/src/multiplayer/hooks.ts')) return 'export function useRoundParticipants(){return {value:[{playerId:"a"},{playerId:"b"},{playerId:"c"}],loading:false,error:null}}';
      if (path.endsWith('/src/multiplayer/game-progress/hooks.ts')) return 'export function useRoundProgress(){return {value:[],loading:false,error:null}}';
      if (path.endsWith('/src/multiplayer/game-progress/repository.ts')) return 'export function subscribeRoundProgress(room,round,callback){const update=()=>callback(round==="run"?[]:round==="old-round"?[{id:"b",playerId:"b",score:window.olderScore??0,correctCount:window.olderScore?1:0,attemptCount:1,updatedAtMs:1}]:window.responses.map(r=>({id:r.playerId,playerId:r.playerId,score:r.score,correctCount:r.correct?1:0,attemptCount:1,updatedAtMs:1})));update();window.addEventListener("engine-data",update);return ()=>window.removeEventListener("engine-data",update)}';
      if (path.endsWith('/src/multiplayer/round-participants/repository.ts')) return 'export async function loadRoundParticipants(){return ["a","b","c"].map((playerId,index)=>({id:playerId,playerId,studentNumber:String(index+1),displayName:"학생"+(index+1),nickname:null,joinedAtMs:1}))}';
      if (path.endsWith('/src/slide-question/repository.ts')) return 'export function subscribeQuestionResponses(room,round,player,callback){const update=()=>callback(window.responses);update();window.addEventListener("engine-data",update);return ()=>window.removeEventListener("engine-data",update)};export function subscribeQuestionKey(room,run,slide,question,callback){const update=()=>callback(window.grading);update();window.addEventListener("engine-data",update);return ()=>window.removeEventListener("engine-data",update)};export async function submitQuestion(){}';
    },
    configureServer(vite) { vite.middlewares.use(async (request, response, next) => { if (request.url !== '/__engine-test') return next(); try { response.setHeader('Content-Type','text/html'); response.end(await vite.transformIndexHtml('/__engine-test', fixture)); } catch (error) { next(error); } }); },
  }] });
  await server.listen();
  window = new BrowserWindow({ show: false, width: 1400, height: 1800, webPreferences: { contextIsolation: true, nodeIntegration: false, backgroundThrottling: false } });
  await window.loadURL(`${server.resolvedUrls.local[0]}__engine-test`);
  await until('window.ready && document.querySelector("#teacher h2") && document.querySelectorAll("#student button").length===5', 'engine mount');
  assert.equal(await evaluate('document.querySelector("#teacher h2").textContent'), '지구에서 가장 큰 바다는?');
  assert.deepEqual(await evaluate('Array.from(document.querySelectorAll("#student button")).map(e=>getComputedStyle(e).backgroundColor)'), ['rgb(226, 27, 60)','rgb(19, 104, 206)','rgb(216, 158, 0)','rgb(38, 137, 12)','rgb(134, 76, 191)']);
  assert.ok(await evaluate('(()=>{const last=document.querySelector("#student button:last-child");return Math.abs(last.getBoundingClientRect().width-last.parentElement.getBoundingClientRect().width)<1})()'), 'fifth choice spans the full two-column grid');
  await screenshot('engine-student-choices', '#student'); await screenshot('engine-teacher-live', '#teacher');
  await evaluate('document.querySelector("#student button").click()');
  await until('document.querySelector("#student").textContent==="제출했어요"','neutral submission');
  assert.equal(await evaluate('window.submittedAnswer'), '0');
  await screenshot('engine-student-submitted', '#student');
  await evaluate('window.renderStudent({closed:true,response:{correct:true,score:1500}})');
  await until('document.querySelector("#student").textContent==="정답!+1500"','correct result');
  await screenshot('engine-student-correct', '#student');
  await evaluate('window.renderStudent({closed:true,response:{correct:false,score:0}})');
  await until('document.querySelector("#student").textContent==="오답"','incorrect result');
  await evaluate('window.renderStudent({closed:true})');
  await until('document.querySelector("#student").textContent==="시간 종료"','unsubmitted result');
  const optionAreaHeight = await evaluate('document.querySelector("#teacher [data-five]").getBoundingClientRect().height');
  await evaluate('window.phase="submissions";window.responses=[{playerId:"a",displayName:"학생",answer:"0",correct:true,method:"deterministic",score:1000}];window.renderTeacher()');
  await until(`document.querySelector('#teacher [aria-label="선택지별 제출 인원"]')`,'teacher chart');
  assert.equal(await evaluate('document.querySelectorAll("#teacher [data-wrong=true]").length'), 3);
  assert.equal(await evaluate(`document.querySelector('#teacher [aria-label="선택지별 제출 인원"] b').textContent`), '1');
  const chartLayout = await evaluate(`(() => {
    const chart = document.querySelector('#teacher [aria-label="선택지별 제출 인원"]');
    const columns = Array.from(chart.children);
    const bars = columns.map(column => column.children[1].firstElementChild);
    const chips = columns.map(column => column.lastElementChild);
    const rect = chart.getBoundingClientRect();
    const first = bars[0].getBoundingClientRect(), last = bars.at(-1).getBoundingClientRect();
    const submitted = Array.from(document.querySelectorAll("#teacher strong")).find(node => node.textContent.startsWith("제출 "));
    return {
      barWidths: bars.map(bar => bar.getBoundingClientRect().width),
      zeroHeights: bars.slice(1).map(bar => bar.getBoundingClientRect().height),
      colors: bars.map(bar => getComputedStyle(bar).backgroundColor),
      opacity: bars.map(bar => getComputedStyle(bar).opacity),
      symbols: chips.map(chip => chip.textContent),
      chipSizes: chips.map(chip => [chip.getBoundingClientRect().width, chip.getBoundingClientRect().height]),
      chipColors: chips.map(chip => getComputedStyle(chip).backgroundColor),
      countFonts: columns.map(column => getComputedStyle(column.firstElementChild).fontSize),
      gap: bars[1].getBoundingClientRect().left - first.right,
      centerOffset: (first.left + last.right - rect.left - rect.right) / 2,
      submittedAbove: submitted.getBoundingClientRect().bottom <= rect.top,
      submittedRight: Math.abs(submitted.getBoundingClientRect().right - rect.right) < 1,
      fillsAvailableHeight: Math.abs(rect.height - chart.parentElement.getBoundingClientRect().height) < 1,
      optionHeight: document.querySelector("#teacher [data-five]").getBoundingClientRect().height,
    };
  })()`);
  assert.deepEqual(chartLayout.barWidths, [96,96,96,96,96]);
  assert.deepEqual(chartLayout.zeroHeights, [6,6,6,6]);
  assert.deepEqual(chartLayout.colors, ['rgb(226, 27, 60)','rgb(19, 104, 206)','rgb(216, 158, 0)','rgb(38, 137, 12)','rgb(134, 76, 191)']);
  assert.deepEqual(chartLayout.opacity, ['1','0.35','1','0.35','0.35']);
  assert.deepEqual(chartLayout.symbols, ['▲','◆','●','■','★']);
  assert.deepEqual(chartLayout.chipSizes, Array.from({length:5}, () => [32,32]));
  assert.deepEqual(chartLayout.chipColors, chartLayout.colors);
  assert.deepEqual(chartLayout.countFonts, ['20px','20px','20px','20px','20px']);
  assert.equal(chartLayout.gap, 24);
  assert.ok(Math.abs(chartLayout.centerOffset) < 1, 'choice columns are centered within the chart');
  assert.ok(chartLayout.submittedAbove && chartLayout.submittedRight, 'submission count stays in the upper-right header outside the chart');
  assert.ok(chartLayout.fillsAvailableHeight, 'chart fills the remaining upper-area height');
  assert.equal(chartLayout.optionHeight, optionAreaHeight, 'result chart does not reduce the choice tile area');
  await screenshot('engine-teacher-results', '#teacher');
  await evaluate('window.question={type:"ai-short-answer",prompt:"사과의 영어 단어는?",doublePoints:false};window.grading={answer:"apple"};window.responses=[{playerId:"a",displayName:"학생",answer:"aple",correct:true,method:"ai",score:900},{playerId:"b",displayName:"학생2",answer:"other",correct:false,method:"fallback",score:0}];window.renderTeacher();window.renderStudent()');
  await until('document.querySelector("#teacher").textContent.includes("정답: apple") && document.querySelector("#student input")','short answer views');
  assert.ok(await evaluate('document.querySelector("#teacher").textContent.includes("AI") && document.querySelector("#teacher").textContent.includes("결정적 대체")'));
  assert.equal(await evaluate('document.querySelector("#student input").getBoundingClientRect().height'), 56);
  await screenshot('engine-teacher-ai-results', '#teacher');
  await screenshot('engine-student-short-answer', '#student');
  await evaluate('window.phase="results";window.responses=[{playerId:"a",displayName:"학생",answer:"aple",correct:null,method:null,score:0}];window.renderTeacher()');
  await until('document.querySelector("#teacher ol")?.textContent.includes("0점")','leaderboard before delayed grading');
  await evaluate('window.responses=[{playerId:"a",displayName:"학생",answer:"aple",correct:true,method:"ai",score:900}];window.renderTeacher()');
  await until('document.querySelector("#teacher ol")?.textContent.includes("900점")','leaderboard refresh after delayed AI grading');
  await evaluate('window.olderScore=700;window.renderTeacher()');
  await until('document.querySelector("#teacher ol")?.textContent.includes("700점")','leaderboard refresh for grading from an earlier slide');
  await screenshot('engine-teacher-leaderboard', '#teacher');
  await evaluate('document.querySelector("#student input").focus()'); window.webContents.focus(); await characters('apple');
  assert.equal(await evaluate('document.querySelector("#student input").value'),'apple');
  assert.equal(await evaluate('document.querySelector("#student button").disabled'),false);
  await evaluate('document.querySelector("#student button").click()');
  await until('document.querySelector("#student").textContent==="제출했어요"','short answer native submit');
  assert.equal(await evaluate('window.submittedAnswer'), 'apple');
  await evaluate('window.question={type:"ox",prompt:"지구는 둥글다",doublePoints:false};window.renderStudent()');
  await until('document.querySelector("#student button[aria-label=O]")','OX view');
  assert.equal(await evaluate('document.querySelector("#student").textContent'), '지구는 둥글다○✕');
  await screenshot('engine-student-ox', '#student');
  assert.equal(await evaluate('document.querySelector("#student [role=timer]")'), null, 'student engine never shows a themed timer');
  await evaluate('window.phase="submissions";window.grading={answer:"O"};window.responses=[{playerId:"a",displayName:"학생",answer:"O",correct:true,method:"deterministic",score:1000}];window.renderTeacher()');
  await until(`document.querySelector('#teacher [aria-label="선택지별 제출 인원"] > div > span')?.textContent==="○"`, 'OX result chart');
  assert.deepEqual(await evaluate(`Array.from(document.querySelectorAll('#teacher [aria-label="선택지별 제출 인원"] > div > span')).map(chip => [chip.textContent,getComputedStyle(chip).backgroundColor])`), [['○','rgb(19, 104, 206)'],['✕','rgb(226, 27, 60)']]);
  // Real editor events: option bounds/deletion, multiple correct choices and draft time commits.
  await evaluate(`document.querySelector('#settings [aria-label="2번 정답"]').click()`);
  assert.deepEqual(await evaluate('window.round.source.grading.correctOptions'), [0,1]);
  for (let count=3;count<=5;count++) { await evaluate('Array.from(document.querySelectorAll("#settings button")).find(e=>e.textContent==="선택지 추가").click()'); await until(`window.round.source.question.options.length===${count}`,'option add'); }
  assert.equal(await evaluate('Array.from(document.querySelectorAll("#settings button")).some(e=>e.textContent==="선택지 추가")'), false);
  await evaluate(`document.querySelector('#settings [aria-label="1번 선택지 삭제"]').click()`);
  assert.deepEqual(await evaluate('window.round.source.grading.correctOptions'), [0]);
  for (let count=3;count>=2;count--) { await evaluate(`document.querySelector('#settings [aria-label="1번 선택지 삭제"]').click()`); await until(`window.round.source.question.options.length===${count}`,'option delete'); }
  assert.equal(await evaluate(`document.querySelectorAll('#settings button[aria-label$="선택지 삭제"]').length`), 0);
  const input = 'document.querySelector("#settings input[type=number]")';
  await evaluate(`${input}.focus();${input}.select()`); window.webContents.focus(); await characters('2');
  assert.equal(await evaluate('window.round.durationSeconds'), 20);
  await evaluate(`${input}.blur()`); await until('window.round.durationSeconds===5','minimum time blur commit');
  await evaluate(`${input}.focus();${input}.select()`); window.webContents.focus(); await characters('400'); await key('Return');
  await until('window.round.durationSeconds===300','maximum time Enter commit');
  await evaluate(`${input}.focus();${input}.select()`); window.webContents.focus(); await key('Backspace'); await evaluate(`${input}.blur()`);
  await until('window.round.durationSeconds===300','empty draft restores committed time');
  const typeSelect = `Array.from(document.querySelectorAll('#settings label')).find(e=>e.firstElementChild?.textContent==='유형').querySelector('select')`;
  for (const type of ['ox','short-answer','ai-short-answer']) {
    await evaluate(`(()=>{const e=${typeSelect};e.value=${JSON.stringify(type)};e.dispatchEvent(new Event('change',{bubbles:true}))})()`);
    await until(`window.round.source.question.type===${JSON.stringify(type)}`,'question type change');
    if (type==='ox') {
      await evaluate(`(()=>{const e=Array.from(document.querySelectorAll('#settings label')).find(e=>e.firstElementChild?.textContent==='정답').querySelector('select');e.value='X';e.dispatchEvent(new Event('change',{bubbles:true}))})()`);
      assert.equal(await evaluate('window.round.source.grading.answer'),'X');
    } else {
      await evaluate(`Array.from(document.querySelectorAll('#settings label')).find(e=>e.firstElementChild?.textContent==='정답').querySelector('input').focus()`); window.webContents.focus(); await characters('apple');
      assert.equal(await evaluate('window.round.source.grading.answer'),'apple');
    }
  }
  await evaluate(`Array.from(document.querySelectorAll('#settings label')).find(e=>e.textContent.trim()==='점수 2배').querySelector('input').click()`);
  assert.equal(await evaluate('window.round.source.question.doublePoints'),true);
  await screenshot('engine-settings', '#settings');
  // All timer themes must fit even in resized engine windows, without hidden scrolling.
  await evaluate('window.kind="free-response";window.phase="answering";window.responses=[]');
  for (const [width,height] of [[1000,540],[640,360],[400,220]]) for (const skin of ['normal','glow','apple','hourglass']) {
    await evaluate(`document.querySelector('#teacher').style.width='${width}px';document.querySelector('#teacher').style.height='${height}px';window.skin=${JSON.stringify(skin)};window.renderTeacher()`);
    await until(`document.querySelector('#teacher [data-skin=${skin}]')`,'timer theme');
    if(width===1000) {
      const size = await evaluate(`(()=>{const root=document.querySelector('#teacher [data-skin=${skin}]');return ${skin==='normal' ? "parseFloat(getComputedStyle(root.querySelector('[role=timer]')).fontSize)" : "root.querySelector('svg').getBoundingClientRect().width"}})()`);
      assert.ok(size > (skin==='normal' ? 84 : skin==='hourglass' ? 220 : 300), `${skin} theme is enlarged from its previous default`);
      console.log(`TIMER_SIZE ${skin}: ${size.toFixed(1)}px`);
      await screenshot(`engine-timer-${skin}`, '#teacher');
    }
    const overflow = await evaluate(`(()=>{const root=document.querySelector('#teacher');const r=root.getBoundingClientRect();return [root,...root.querySelectorAll('*')].filter(e=>{const b=e.getBoundingClientRect();const scrollContainer=e===root||/auto|scroll|hidden/.test(getComputedStyle(e).overflow);return (scrollContainer&&(e.scrollHeight>e.clientHeight+1||e.scrollWidth>e.clientWidth+1))||b.top<r.top-1||b.bottom>r.bottom+1||b.left<r.left-1||b.right>r.right+1}).map(e=>({tag:e.tagName,className:String(e.className),width:e.clientWidth,height:e.clientHeight,scrollWidth:e.scrollWidth,scrollHeight:e.scrollHeight,bounds:e.getBoundingClientRect().toJSON()}))})()`);
    assert.deepEqual(overflow, [], `${skin} timer must fit ${width}x${height}`);
  }
  console.log('Engine browser settings, submission/result states, choice colors and responsive timer themes passed');
} catch (error) { console.error(error); exitCode=1; }
finally { window?.destroy(); await server?.close(); app.exit(exitCode); }
}
void run();
