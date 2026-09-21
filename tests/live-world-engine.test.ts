import assert from "node:assert/strict";
import { LiveMovementEngine } from "../src/live-world/LiveMovementEngine.ts";
import { LiveMovementObserver } from "../src/live-world/LiveMovementObserver.ts";
import { appendMovementSnapshot, sampleMovementTrack } from "../src/live-world/core/interpolation.ts";
import type { LiveMovementSnapshot, LiveMovementUpdate, LiveWorldScope } from "../src/live-world/core/types.ts";
import type {
  LiveMovementConnection,
  LiveMovementObserverConnection,
  LiveMovementObserverTransport,
  LiveMovementTransport,
  LiveMovementTransportHandlers,
} from "../src/live-world/transport.ts";

const first: LiveMovementSnapshot = {
  playerId: "other",
  sequence: 1,
  sentAtMs: 1_000,
  state: { x: 0, y: 10, vx: 10, vy: 0 },
};
const second: LiveMovementSnapshot = {
  playerId: "other",
  sequence: 2,
  sentAtMs: 1_200,
  state: { x: 2, y: 10, vx: 10, vy: 0 },
};
const third: LiveMovementSnapshot = {
  playerId: "other",
  sequence: 3,
  sentAtMs: 1_400,
  state: { x: 4, y: 10, vx: 10, vy: 0 },
};

let track = appendMovementSnapshot(null, first);
track = appendMovementSnapshot(track, second);
assert.equal(sampleMovementTrack(track, 1_100, 180).x, 1);
assert.equal(sampleMovementTrack(track, 1_300, 180).x, 3);
assert.equal(sampleMovementTrack(track, 2_000, 180).x, 3.8, "extrapolation must be capped");
assert.equal(appendMovementSnapshot(track, first), track, "older packets must not replace the newest sample");
track = appendMovementSnapshot(track, third);
assert.equal(sampleMovementTrack(track, 1_100, 180).x, 1, "interpolation delay must retain enough history after newer packets arrive");

class TestTransport implements LiveMovementTransport {
  readonly sent: LiveMovementUpdate[] = [];
  handlers: LiveMovementTransportHandlers | null = null;
  closed = false;

  async connect(
    _scope: LiveWorldScope,
    _playerId: string,
    handlers: LiveMovementTransportHandlers,
  ): Promise<LiveMovementConnection> {
    this.handlers = handlers;
    return {
      publish: async (update) => { this.sent.push(update); },
      close: async () => { this.closed = true; },
    };
  }
}

const transport = new TestTransport();
const engine = new LiveMovementEngine("self", transport, {
  sendHz: 20,
  interpolationDelayMs: 100,
  maxExtrapolationMs: 100,
});
await engine.connect(
  { roomId: "room", roundId: "round", channelId: "movement" },
  { x: 0, y: 0, vx: 0, vy: 0 },
);
assert.equal(transport.sent.length, 1, "connect should publish the initial position once");

engine.updateLocal({ x: 1, y: 0, vx: 10, vy: 0 });
engine.updateLocal({ x: 2, y: 0, vx: 10, vy: 0 });
await new Promise((resolve) => setTimeout(resolve, 70));
assert.equal(transport.sent.length, 2, "rapid local frames should be coalesced into one network write");
assert.equal(transport.sent[1]?.state.x, 2, "the newest coalesced position should be published");

transport.handlers?.onSnapshot({
  playerId: "other",
  sequence: 1,
  sentAtMs: 1_000,
  state: { x: 5, y: 6, vx: 0, vy: 0 },
});
assert.deepEqual(engine.sampleRemotePlayers(1_100), [
  { playerId: "other", sequence: 1, x: 5, y: 6, vx: 0, vy: 0 },
]);
transport.handlers?.onLeave("other");
assert.deepEqual(engine.sampleRemotePlayers(1_100), []);

await engine.close();
assert.equal(transport.closed, true);

const reconnectTransport = new TestTransport();
const reconnectEngine = new LiveMovementEngine("self", reconnectTransport, { sendHz: 20 });
await reconnectEngine.connect(
  { roomId: "room", roundId: "round", channelId: "movement" },
  { x: 3, y: 4, vx: 0, vy: 0 },
);
assert.ok(
  (reconnectTransport.sent[0]?.sequence ?? 0) > (transport.sent.at(-1)?.sequence ?? 0),
  "a remounted engine must start above its previous sequence range",
);
await reconnectEngine.close();

class TestObserverTransport implements LiveMovementObserverTransport {
  handlers: LiveMovementTransportHandlers | null = null;
  closed = false;

  async subscribe(
    _scope: LiveWorldScope,
    handlers: LiveMovementTransportHandlers,
  ): Promise<LiveMovementObserverConnection> {
    this.handlers = handlers;
    return {
      close: async () => { this.closed = true; },
    };
  }
}

const observerTransport = new TestObserverTransport();
const observer = new LiveMovementObserver(observerTransport, {
  interpolationDelayMs: 0,
  maxExtrapolationMs: 0,
});
await observer.connect({ roomId: "room", roundId: "round", channelId: "movement" });
observerTransport.handlers?.onSnapshot({
  playerId: "student",
  sequence: 1,
  sentAtMs: 2_000,
  state: { x: 4, y: 7, vx: 0, vy: 0 },
});
assert.deepEqual(observer.samplePlayers(2_000), [
  { playerId: "student", sequence: 1, x: 4, y: 7, vx: 0, vy: 0 },
], "observer should sample remote movement without publishing a local player");
observerTransport.handlers?.onLeave("student");
assert.deepEqual(observer.samplePlayers(2_000), []);
await observer.close();
assert.equal(observerTransport.closed, true);

const lateTransport = new TestTransport();
const lateEngine = new LiveMovementEngine("self", lateTransport);
const connecting = lateEngine.connect(
  { roomId: "room", roundId: "round", channelId: "movement" },
  { x: 0, y: 0, vx: 0, vy: 0 },
);
await lateEngine.close();
await connecting;
assert.equal(lateTransport.closed, true, "unmounting during connect must close the eventual connection");
assert.equal(lateTransport.sent.length, 0, "a closed engine must not publish a ghost player");
lateTransport.handlers?.onSnapshot(first);
assert.deepEqual(lateEngine.sampleRemotePlayers(), [], "late callbacks must not restore closed tracks");

const lateObserverTransport = new TestObserverTransport();
const lateObserver = new LiveMovementObserver(lateObserverTransport);
const subscribing = lateObserver.connect({ roomId: "room", roundId: "round", channelId: "movement" });
await lateObserver.close();
await subscribing;
assert.equal(lateObserverTransport.closed, true, "an observer closed during subscription must release it");

console.log("live world engine tests passed");
