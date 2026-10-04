import assert from "node:assert/strict";
import { MAX_TIMER_SECONDS, adjustTimerSeconds, countdownSeconds, formatTimerSeconds } from "../src/features/teacher/slide-show-runtime/timer/model.ts";

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
console.log("Slide show timer tests passed");
