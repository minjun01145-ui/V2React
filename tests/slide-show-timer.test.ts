import assert from "node:assert/strict";
import { MAX_TIMER_SECONDS, adjustTimerSeconds, countdownSeconds, formatTimerSeconds, parseSlideTimer, slideTimerSnapshot } from "../src/slide-show/timer.ts";
import { appleBites, elapsedFraction, isTimerSkin, showsRemainingTime } from "../src/slide-show/timerSkins.ts";
import { parseSlideShowSessionState } from "../src/slide-show/validation.ts";

assert.equal(adjustTimerSeconds(180, 60), 240);
assert.equal(adjustTimerSeconds(60, -1), 59);
assert.equal(adjustTimerSeconds(59, 1), 60);
assert.equal(adjustTimerSeconds(15, -30), 0);
assert.equal(adjustTimerSeconds(45, 30), 75);
assert.equal(adjustTimerSeconds(MAX_TIMER_SECONDS - 1, 30), MAX_TIMER_SECONDS);
assert.equal(adjustTimerSeconds(0, -1), 0);
assert.equal(formatTimerSeconds(0), "00:00");
assert.equal(formatTimerSeconds(75), "01:15");
assert.equal(formatTimerSeconds(MAX_TIMER_SECONDS), "99:59");
assert.equal(countdownSeconds(10_000, 8_500), 2);
assert.equal(countdownSeconds(10_000, 9_000), 1);
assert.equal(countdownSeconds(10_000, 10_000), 0);
assert.equal(countdownSeconds(10_000, 20_000), 0, "a throttled/background timer must still expire on time");
// Timer skins
assert.equal(elapsedFraction(180, 180), 0);
assert.equal(elapsedFraction(45, 180), 0.75);
assert.equal(elapsedFraction(0, 0), 0, "an unset timer shows nothing used");
assert.equal(appleBites(0, 10), 0, "a fresh apple is whole");
assert.equal(appleBites(0.999, 10), 9, "the last bite is saved for time up");
assert.equal(appleBites(1, 10), 10);
assert.equal(showsRemainingTime("hourglass"), false, "the hourglass hides the remaining time");
assert.equal(showsRemainingTime("glow"), true);
assert.equal(isTimerSkin("apple"), true);
assert.equal(isTimerSkin("banana"), false, "an unknown stored skin falls back to the default");

const startedAt = { toMillis: () => 100_000 };
const running = parseSlideTimer({ durationSeconds: 60, remainingSeconds: 60, startedAt });
assert.deepEqual(running, { durationSeconds: 60, remainingSeconds: 60, startedAtMs: 100_000 });
assert.equal(slideTimerSnapshot(running, 100_000).remainingSeconds, 60);
assert.equal(slideTimerSnapshot(running, 101_000).remainingSeconds, 59);
assert.equal(slideTimerSnapshot(running, 135_500).remainingSeconds, 25, "missed ticks do not accumulate drift");
assert.equal(slideTimerSnapshot(running, 160_000).running, false, "the student overlay disappears exactly at the deadline");
assert.equal(slideTimerSnapshot(running, 190_000).remainingSeconds, 0);
const paused = parseSlideTimer({ durationSeconds: 60, remainingSeconds: 25, startedAt: null });
assert.equal(slideTimerSnapshot(paused, 300_000).remainingSeconds, 25);
assert.equal(slideTimerSnapshot(paused, 300_000).running, false, "paused timers are not displayed to students");
assert.equal(slideTimerSnapshot(null, 100_000).running, false, "an engine countdown alone never displays the class timer");
assert.equal(slideTimerSnapshot(running, 101_000).remainingSeconds, slideTimerSnapshot(running, 71_000 + 30_000).remainingSeconds, "server clock correction cancels a student's local clock skew");
assert.equal(parseSlideTimer({ durationSeconds: -1, remainingSeconds: 60, startedAt }), null);
assert.equal(parseSlideTimer({ durationSeconds: 60, remainingSeconds: 61, startedAt }), null);
assert.equal(parseSlideTimer({ durationSeconds: 60, remainingSeconds: 1.5, startedAt }), null);
assert.equal(parseSlideTimer({ durationSeconds: 60, remainingSeconds: 60, startedAt: null })?.startedAtMs, null);
assert.equal(parseSlideTimer({ durationSeconds: 60, remainingSeconds: 60, startedAt: { toMillis: () => NaN } }), null);
assert.equal(parseSlideTimer({ durationSeconds: 60, remainingSeconds: 60, startedAt: { toMillis: () => { throw new Error("invalid timestamp"); } } }), null);
assert.equal(parseSlideTimer({ durationSeconds: 60, remainingSeconds: 60, startedAt: null, startedAtMs: 100_000 })?.startedAtMs, null, "untrusted client milliseconds must not override the server timestamp");

const showData = { runId: "run-1", showId: "show-1", name: "수업", slideIds: ["slide-1"], currentSlideIndex: 0, engine: null, scoredRoundIds: [], awards: {},
  timer: { durationSeconds: 60, remainingSeconds: 60, startedAt }, timerSkin: "glow" };
assert.equal(parseSlideShowSessionState(showData)?.timerSkin, "glow");
assert.equal(parseSlideShowSessionState({ ...showData, timerSkin: "apple" })?.timerSkin, "apple", "theme changes travel through the same session subscription");
assert.equal(parseSlideShowSessionState({ ...showData, timerSkin: "invalid" })?.timerSkin, null);
assert.equal(parseSlideShowSessionState({ ...showData, timer: { durationSeconds: Infinity } })?.timer, null, "malformed timer data must not hide the slide show");
console.log("Slide show timer tests passed");
