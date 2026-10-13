import assert from "node:assert/strict";
import { mock } from "node:test";

const now = 100_000;
const player = (id, lastSeenAtMs) => ({
  id, playerId: id, studentNumber: id, displayName: id, nickname: null,
  state: "playing", joinedAtMs: 1, lastSeenAtMs,
});
const canvas = JSON.stringify({ objects: [], background: "#ffffff" });
const engine = {
  frame: { x: 140, y: 90, width: 1000, height: 540 },
  round: { gameId: "simple-quiz", source: { kind: "stored-set", setId: "set-1" }, durationSeconds: 30, gameConfig: {} },
};
const fixture = {
  uploadFailure: false,
  loseActivationAck: false,
  beforeTransaction: null,
  players: [player("online", now - 1_000), player("offline", now - 31_000)],
  participants: new Map(),
  documents: new Map([
    ["multiplayerSessions/room-1", {
      status: "playing", roundId: "run-1", gameId: "slide-show",
      slideShow: { runId: "run-1", showId: "show-1", name: "수업", slideIds: ["s1", "s2"], currentSlideIndex: 1, engine: null, scoredRoundIds: [], awards: {} },
    }],
    ["multiplayerSessions/room-1/showRuns/run-1/slides/s2", { canvas, engine }],
  ]),
};
const session = () => fixture.documents.get("multiplayerSessions/room-1");
// Replace only persistence and environment boundaries; run the actual transition.
const unexpected = () => { throw new Error("Unexpected persistence operation"); };
const path = (base, ...parts) => [...(typeof base === "string" ? [base] : []), ...parts].join("/");
const snapshot = ref => { const data = fixture.documents.get(ref); return { id: ref.split("/").at(-1), exists: () => data !== undefined, data: () => data }; };
let transactionQueue = Promise.resolve();
mock.module("firebase/firestore", {
  namedExports: {
    doc: path,
    collection: path,
    deleteField: () => undefined,
    serverTimestamp: () => ({ toMillis: () => now }),
    getDoc: async ref => snapshot(ref),
    getDocFromServer: async ref => snapshot(ref),
    deleteDoc: async ref => fixture.documents.delete(ref),
    setDoc: async (ref, data) => {
      if (fixture.uploadFailure) {
        if (ref.includes("/questionKeys/")) throw new Error("simulated upload failure");
        await new Promise(resolve => setTimeout(resolve, 10));
      }
      fixture.documents.set(ref, data);
    },
    getDocs: unexpected,
    runTransaction: (_db, work) => {
      const result = transactionQueue.then(async () => {
        const before = fixture.beforeTransaction;
        fixture.beforeTransaction = null;
        before?.();
        const writes = [];
        const value = await work({
          get: async ref => snapshot(ref),
          update: (ref, patch) => writes.push(() => {
            const data = fixture.documents.get(ref);
            for (const [key, value] of Object.entries(patch)) {
              const segments = key.split(".");
              let target = data;
              for (const segment of segments.slice(0, -1)) target = target[segment];
              target[segments.at(-1)] = value;
            }
          }),
          set: (ref, data) => writes.push(() => fixture.participants.set(ref, data)),
        });
        writes.forEach(apply => apply());
        if (fixture.loseActivationAck) {
          fixture.loseActivationAck = false;
          throw new Error("simulated lost commit response");
        }
        return value;
      });
      transactionQueue = result.catch(() => {});
      return result;
    },
  },
});
mock.module(new URL("../src/config/appConfig.ts", import.meta.url), {
  namedExports: { appConfig: { playerStaleAfterMs: 30_000 } },
});
mock.module(new URL("../src/firebase/firebaseClient.ts", import.meta.url), {
  namedExports: { db: {} },
});
mock.module(new URL("../src/multiplayer/repository.ts", import.meta.url), {
  namedExports: { loadPlayers: async () => fixture.players, ensureSession: async () => {}, subscribeSessionField: unexpected },
});
mock.module(new URL("../src/multiplayer/round-participants/repository.ts", import.meta.url), {
  namedExports: { roundParticipantRef: (_room, round, playerId) => `${round}:${playerId}` },
});
mock.method(Date, "now", () => now);
try {
  const { startShowSlideEngine, goToShowSlide, closeShowEngine, changeShowTimer, setShowTimerSkin, startRegularGameSession, startSlideShow } = await import("../src/slide-show/multiplayerService.ts");
  const { parseSlideShowSessionState } = await import("../src/slide-show/validation.ts");
  const { slideTimerSnapshot } = await import("../src/slide-show/timer.ts");
  await startShowSlideEngine("room-1");
  const started = session();
  assert.equal(started.status, "preparing", "an engine uses the normal readiness handshake");
  assert.equal(started.gameId, "simple-quiz");
  assert.deepEqual(started.gameConfig, { setId: "set-1", quizRoundDurationMs: 30_000 });
  assert.deepEqual(started.expectedPlayerIds, ["online"], "disconnected students must not block the engine start");
  assert.equal(started.slideShow.engine.phase, "answering");
  assert.equal(started.slideShow.engine.roundId, started.roundId);
  assert.deepEqual(started.slideShow.scoredRoundIds, [started.roundId]);
  assert.equal(fixture.participants.get(`${started.roundId}:online`)?.playerId, "online");
  assert.equal(fixture.participants.has(`${started.roundId}:offline`), false);

  await assert.rejects(goToShowSlide("room-1", 0), /문제를 마친 뒤/);
  await closeShowEngine("room-1");
  assert.equal(session().status, "playing", "abandoning a preparing engine returns to the slide");
  assert.equal(session().gameId, "slide-show");
  assert.equal(session().slideShow.engine, null);
  await goToShowSlide("room-1", 0);
  assert.equal(session().slideShow.currentSlideIndex, 0);
  await assert.rejects(startShowSlideEngine("room-1"), /문제 엔진이 없습니다/, "slides without an engine cannot start one");

  await changeShowTimer("room-1", "run-1", -120, now, "hourglass");
  assert.equal(session().slideShow.timer.remainingSeconds, 60);
  await changeShowTimer("room-1", "run-1", "start", now, "hourglass");
  const timerTimestamp = session().slideShow.timer.startedAt;
  assert.equal(timerTimestamp.toMillis(), now, "timer starts from the server timestamp");
  assert.equal(session().slideShow.timerSkin, "hourglass", "a remembered theme is published when the timer starts");
  await setShowTimerSkin("room-1", "run-1", "apple");
  assert.equal(parseSlideShowSessionState(session().slideShow).timerSkin, "apple");
  assert.equal(session().slideShow.timer.startedAt, timerTimestamp, "changing skins does not reset the deadline");
  await goToShowSlide("room-1", 1);
  assert.equal(session().slideShow.timer.startedAt, timerTimestamp, "slide navigation must retain the raw server timestamp");
  await startShowSlideEngine("room-1");
  assert.equal(session().slideShow.timer.startedAt, timerTimestamp, "starting an engine must not restart or corrupt the manual timer");
  await closeShowEngine("room-1");
  await changeShowTimer("room-1", "run-1", "pause", now + 10_000, "apple");
  const pausedTimer = parseSlideShowSessionState(session().slideShow).timer;
  assert.equal(pausedTimer.remainingSeconds, 50);
  assert.equal(slideTimerSnapshot(pausedTimer, now + 40_000).running, false, "pausing hides the student's timer");
  await changeShowTimer("room-1", "run-1", "start", now + 10_000, "apple");
  assert.equal(session().slideShow.timer.remainingSeconds, 50, "resume only runs the unused seconds");
  await changeShowTimer("room-1", "run-1", "reset", now, "apple");
  assert.equal(session().slideShow.timer.remainingSeconds, 60);
  assert.equal(session().slideShow.timer.startedAt, null, "reset hides the student's timer");
  await assert.rejects(changeShowTimer("room-1", "obsolete-run", "start", now, "normal"), /변경되었습니다/);
  session().slideShow.timer = null;
  fixture.documents.get("multiplayerSessions/room-1/showRuns/run-1/slides/s2").engine = {
    ...engine, round: { gameId: "free-response", source: { kind: "free-response", prompt: "생각을 적어 주세요" }, durationSeconds: 60, gameConfig: {} },
  };
  await startShowSlideEngine("room-1");
  assert.equal(session().gameConfig.quizRoundDurationMs, 60_000, "free-response submission deadlines are unchanged");
  assert.equal(session().slideShow.timer, null, "a free-response countdown must never create the student overlay timer");
  assert.equal(slideTimerSnapshot(parseSlideShowSessionState(session().slideShow).timer, now).running, false);

  session().status = "waiting";
  session().lobbyGathering = { runId: "gather-1", active: true };
  const show = { id: "show-1", name: "수업", slides: [{ id: "s1", canvas, engine: null }] };
  const participantsBeforeGatheredLaunch = fixture.participants.size;
  await assert.rejects(startRegularGameSession("room-1", { gameId: "simple-quiz" }), /집합을 해산/, "a stale teacher cannot launch a regular game during gathering");
  await assert.rejects(startSlideShow("room-1", show), /집합을 해산/, "a stale teacher cannot launch slides during gathering");
  assert.equal(session().status, "waiting");
  assert.equal(session().lobbyGathering.active, true);
  assert.equal(fixture.participants.size, participantsBeforeGatheredLaunch, "rejected launches must not create classroom participants");
  session().lobbyGathering.active = false;
  await startSlideShow("room-1", show);
  assert.equal(session().status, "playing", "slides can start after dismissal");
  session().status = "waiting";
  await startRegularGameSession("room-1", { gameId: "simple-quiz" });
  assert.equal(session().status, "preparing", "regular games can start after dismissal");

  const documentsBeforeRejectedStart = new Set(fixture.documents.keys());
  await assert.rejects(startSlideShow("room-1", show), /진행 중인 수업/);
  await assert.rejects(startRegularGameSession("room-1", { gameId: "simple-quiz" }), /진행 중인 수업/);
  assert.deepEqual(new Set(fixture.documents.keys()), documentsBeforeRejectedStart, "preflight rejection writes no run data");
  session().status = "waiting";
  session().classroomActivity = { kind: "student-question-authoring" };
  await assert.rejects(startSlideShow("room-1", show), /질문 만들기/);
  assert.deepEqual(new Set(fixture.documents.keys()), documentsBeforeRejectedStart);
  delete session().classroomActivity;
  const questionShow = { ...show, slides: [{ id: "question", canvas, engine: {
    ...engine, round: { gameId: "slide-question", source: { kind: "slide-question", question: { type: "ox", prompt: "문제", doublePoints: false }, grading: { answer: "O" } }, durationSeconds: 20, gameConfig: {} },
  } }] };
  const participantsBeforeFailures = new Map(fixture.participants);
  fixture.uploadFailure = true;
  await assert.rejects(startSlideShow("room-1", questionShow), /upload failure/);
  fixture.uploadFailure = false;
  assert.equal(session().status, "waiting", "an incomplete upload never activates a show");
  assert.deepEqual(new Set(fixture.documents.keys()), documentsBeforeRejectedStart, "cleanup waits for delayed uploads and removes both slides and keys");
  assert.deepEqual(fixture.participants, participantsBeforeFailures);

  fixture.beforeTransaction = () => { session().status = "playing"; session().roundId = "another-teacher-round"; };
  await assert.rejects(startSlideShow("room-1", questionShow), /진행 중인 수업/);
  assert.equal(session().roundId, "another-teacher-round", "a stale launch cannot overwrite another teacher's active class");
  assert.deepEqual(new Set(fixture.documents.keys()), documentsBeforeRejectedStart, "a rejected activation cleans only its own prepared run");
  assert.deepEqual(fixture.participants, participantsBeforeFailures);

  session().status = "waiting";
  const concurrent = await Promise.allSettled([startSlideShow("room-1", questionShow), startSlideShow("room-1", questionShow)]);
  assert.equal(concurrent.filter(result => result.status === "fulfilled").length, 1, "only one concurrent start can activate");
  assert.equal(concurrent.filter(result => result.status === "rejected").length, 1);
  const activeRun = session().slideShow.runId;
  const newlyWritten = [...fixture.documents.keys()].filter(path => !documentsBeforeRejectedStart.has(path));
  assert.equal(newlyWritten.length, 2, "only the winning run's slide and answer key remain");
  assert.ok(newlyWritten.every(path => path.includes('/showRuns/' + activeRun + '/')));
  const publicSlide = fixture.documents.get('multiplayerSessions/room-1/showRuns/' + activeRun + '/slides/question');
  assert.equal("grading" in publicSlide.engine.round.source, false);
  assert.equal(JSON.stringify(session().slideShow).includes('"grading"'), false);
  assert.deepEqual(fixture.documents.get('multiplayerSessions/room-1/showRuns/' + activeRun + '/questionKeys/question'), { grading: { answer: "O" } });

  session().status = "waiting";
  fixture.loseActivationAck = true;
  await startSlideShow("room-1", questionShow);
  const committedRun = session().slideShow.runId;
  assert.equal(session().status, "playing");
  assert.ok(fixture.documents.has('multiplayerSessions/room-1/showRuns/' + committedRun + '/slides/question'), "a lost commit response must never delete an active show's slides");
  assert.ok(fixture.documents.has('multiplayerSessions/room-1/showRuns/' + committedRun + '/questionKeys/question'));
} finally {
  mock.restoreAll();
}
console.log("slide show session transitions, atomic activation, failed-upload cleanup and concurrent start tests passed");
