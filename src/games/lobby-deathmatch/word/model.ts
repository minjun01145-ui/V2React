import { createSeededRandom } from "../../../game-engine/core/random.ts";
import type { ClimbPlatform, ClimbPlatformStyle } from "../../../game-engine/jump-tower/course.ts";
import type { RuntimeLearningSet } from "../../../learning-sets/types.ts";
import type { ArenaMap } from "../maps/types.ts";

export type WordDirection = "source-to-meaning" | "meaning-to-source";

export const WORD_DEATHMATCH_CHANNEL = "word-deathmatch";
export const QUESTION_MS = 15_000;
export const REVEAL_MS = 3_000;
const ROUND_MS = QUESTION_MS + REVEAL_MS;

/** Left and right answer platforms; the HUD chips reuse the same colours. */
export const ANSWER_STYLES: readonly [ClimbPlatformStyle, ClimbPlatformStyle] = [
  { top: 0x60a5fa, side: 0x2563eb, labelColor: "#ffffff", labelBackground: "#2563eb" },
  { top: 0xfb923c, side: 0xc2410c, labelColor: "#ffffff", labelBackground: "#c2410c" },
];

interface QuizWord {
  readonly prompt: string;
  readonly accepted: ReadonlySet<string>;
}

export interface WordQuestion {
  readonly prompt: string;
  readonly options: readonly [string, string];
  readonly correctSlot: 0 | 1;
}

export interface WordRound {
  readonly index: number;
  readonly phase: "question" | "reveal";
  readonly remainingMs: number;
}

export interface WordQuiz {
  readonly questionAt: (index: number) => WordQuestion;
}

/** Duplicate prompts keep all their answers, so a synonym is never offered as the wrong platform. */
export function buildWordQuiz(set: RuntimeLearningSet, direction: WordDirection, seed: string): WordQuiz {
  if (set.type !== "vocabulary") throw new Error("단어 데스매치에는 단어 세트를 선택해 주세요.");
  const groups = new Map<string, Set<string>>();
  for (const item of set.items) {
    const prompt = (direction === "source-to-meaning" ? item.sourceText : item.meaning).trim();
    const answer = (direction === "source-to-meaning" ? item.meaning : item.sourceText).trim();
    if (!prompt || !answer) continue;
    groups.set(prompt, (groups.get(prompt) ?? new Set<string>()).add(answer));
  }
  const answers = [...new Set([...groups.values()].flatMap((accepted) => [...accepted]))];
  const words: QuizWord[] = [...groups].map(([prompt, accepted]) => ({ prompt, accepted }))
    .filter((word) => answers.some((answer) => !word.accepted.has(answer)));
  if (words.length < 2) throw new Error("서로 구분되는 단어와 뜻이 최소 2쌍 필요합니다. 중복 단어와 뜻을 확인해 주세요.");

  /** Every word appears once per pass; each pass has its own order. */
  function questionAt(index: number): WordQuestion {
    const pass = Math.floor(index / words.length);
    const order = shuffled(words, createSeededRandom(`${seed}:pass:${pass}`));
    const word = order[index % words.length]!;
    const random = createSeededRandom(`${seed}:question:${index}`);
    const accepted = [...word.accepted];
    const correct = accepted[Math.floor(random() * accepted.length)]!;
    const wrongs = answers.filter((answer) => !word.accepted.has(answer));
    const wrong = wrongs[Math.floor(random() * wrongs.length)]!;
    const correctSlot = random() < 0.5 ? 0 : 1;
    return { prompt: word.prompt, options: correctSlot === 0 ? [correct, wrong] : [wrong, correct], correctSlot };
  }
  return { questionAt };
}

/** Rounds run back to back from the shared start time: 15 s to choose, then a short reveal. */
export function roundAt(startedAtMs: number, nowMs: number): WordRound | null {
  const elapsed = nowMs - startedAtMs;
  if (elapsed < 0) return null;
  const index = Math.floor(elapsed / ROUND_MS);
  const into = elapsed - index * ROUND_MS;
  return into < QUESTION_MS
    ? { index, phase: "question", remainingMs: QUESTION_MS - into }
    : { index, phase: "reveal", remainingMs: ROUND_MS - into };
}

const ANSWER_Y = -440;
const ANSWER_WIDTH = 360;
const ANSWER_GAP = 80;
const STEP_Y = -300;
const STEP_WIDTH = 140;
/** Room under the answer platforms for their labels, kept clear of the map's own ledges. */
const LABEL_CLEARANCE = 80;

/** The two answer platforms sit side by side above the map's centre. */
export function answerPlatforms(map: ArenaMap): readonly [ClimbPlatform, ClimbPlatform] {
  const centre = map.width / 2;
  const platform = (slot: 0 | 1): ClimbPlatform => ({
    index: -1 - slot, floor: 0, kind: "step", range: 0, periodMs: 0, y: ANSWER_Y, width: ANSWER_WIDTH,
    x: slot === 0 ? centre - ANSWER_GAP / 2 - ANSWER_WIDTH : centre + ANSWER_GAP / 2, style: ANSWER_STYLES[slot],
  });
  return [platform(0), platform(1)];
}

/**
 * The chosen deathmatch map plus the answer platforms and two steps that keep them reachable.
 * Map ledges in their way are removed, and attractors are dropped so nothing drags players off an answer.
 */
export function wordArena(map: ArenaMap): ArenaMap {
  const [left, right] = answerPlatforms(map);
  const style = map.platforms[0]?.style;
  const steps: ClimbPlatform[] = [left.x + 60, right.x + right.width - 60 - STEP_WIDTH].map((x) => ({
    index: 0, floor: 0, kind: "step", range: 0, periodMs: 0, x, y: STEP_Y, width: STEP_WIDTH, ...(style ? { style } : {}),
  }));
  const reserved = [
    { left: left.x - 20, right: right.x + right.width + 20, top: ANSWER_Y - 40, bottom: ANSWER_Y + LABEL_CLEARANCE },
    ...steps.map((step) => ({ left: step.x - 30, right: step.x + step.width + 30, top: step.y - 50, bottom: step.y + 50 })),
  ];
  const clear = (platform: ClimbPlatform): boolean => reserved.every((zone) =>
    platform.x + platform.width + (platform.range ?? 0) < zone.left || platform.x > zone.right
    || platform.y < zone.top || platform.y > zone.bottom);
  const platforms = [...map.platforms.filter(clear), ...steps, left, right]
    .map((platform, index) => ({ ...platform, index }));
  return { ...map, platforms, hazards: map.hazards.filter((hazard) => hazard.kind !== "attractor") };
}

/** Standing on (or hopping just above) a platform counts as being on it. */
export function isOnPlatform(feet: { readonly x: number; readonly y: number }, platform: ClimbPlatform): boolean {
  return feet.x >= platform.x && feet.x <= platform.x + platform.width
    && feet.y >= platform.y - 50 && feet.y <= platform.y + 6;
}

function shuffled<T>(values: readonly T[], random: () => number): T[] {
  const result = [...values];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(random() * (index + 1));
    [result[index], result[swap]] = [result[swap]!, result[index]!];
  }
  return result;
}
