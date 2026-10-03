import { createSeededRandom } from "../../game-engine/core/random.ts";
import { CLIMB_STEP, CLIMB_WORLD_WIDTH, CLIMB_PLAYER_HEIGHT, CLIMB_ITEM_WINDOW_MS, type ClimbCourseSource, type ClimbPlatform } from "../../game-engine/jump-tower/course.ts";
import { ITEM_HOVER, PARTY_ITEM_KINDS, type PartyItemKind } from "../../game-engine/platformer-party/buffs.ts";
import type { LiveMovementState } from "../../live-world/core/types.ts";
import type { RuntimeLearningSet } from "../../learning-sets/types.ts";

export const LEARNING_TOWER_CHANNEL = "learning-tower";
export type TowerDirection = "source-to-meaning" | "meaning-to-source";

interface TowerWord {
  readonly prompt: string;
  readonly answer: string;
  readonly accepted: ReadonlySet<string>;
}

export interface LearningTowerPlatform extends ClimbPlatform {
  readonly floor: number;
  readonly label: string;
}

export interface TowerProgress {
  readonly floor: number;
  readonly platformIndex: number;
  readonly prompt: string;
  readonly best: number;
}

function shuffled<T>(values: readonly T[], random: () => number): T[] {
  const result = [...values];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const other = Math.floor(random() * (index + 1));
    [result[index], result[other]] = [result[other]!, result[index]!];
  }
  return result;
}

/** Duplicate prompts keep their aliases, so a synonym never becomes a false answer. */
export function buildLearningTower(set: RuntimeLearningSet, direction: TowerDirection, seed: string) {
  if (set.type !== "vocabulary") throw new Error("학습 점프타워에는 단어 세트를 선택해 주세요.");
  const groups = new Map<string, Set<string>>();
  for (const item of set.items) {
    const prompt = (direction === "source-to-meaning" ? item.sourceText : item.meaning).trim();
    const answer = (direction === "source-to-meaning" ? item.meaning : item.sourceText).trim();
    if (!prompt || !answer) continue;
    const accepted = groups.get(prompt) ?? new Set<string>();
    accepted.add(answer);
    groups.set(prompt, accepted);
  }
  const words: TowerWord[] = [...groups].map(([prompt, accepted]) => ({ prompt, answer: [...accepted][0]!, accepted }));
  const answers = [...new Set(words.map((word) => word.answer))];
  if (words.length < 2 || answers.length < 2) throw new Error("서로 구분되는 단어와 뜻이 최소 2쌍 필요합니다. 중복 단어와 뜻을 확인해 주세요.");
  const compatible = (left: TowerWord, right: TowerWord): boolean => left.answer === right.answer
    || !left.accepted.has(right.answer) && !right.accepted.has(left.answer);
  const partners = (word: TowerWord) => words.filter((other) => other !== word && compatible(word, other));
  const usable = words.filter((word) => partners(word).some((other) => word.answer !== other.answer
    || answers.some((answer) => !word.accepted.has(answer) && !other.accepted.has(answer))));
  if (usable.length < 2) throw new Error("서로 구분되는 단어와 뜻이 최소 2쌍 필요합니다. 중복 단어와 뜻을 확인해 주세요.");

  const promptRows = new Map<number, TowerWord[]>();
  const platformRows = new Map<number, LearningTowerPlatform[]>();
  function promptsAt(floor: number): TowerWord[] {
    const cached = promptRows.get(floor);
    if (cached) return cached;
    const random = createSeededRandom(`${seed}:words:${floor}`);
    const first = shuffled(usable, random)[0]!;
    if (floor === 0) { promptRows.set(floor, [first]); return [first]; }
    const second = shuffled(partners(first), random).find((other) => first.answer !== other.answer
      || answers.some((answer) => !first.accepted.has(answer) && !other.accepted.has(answer)))!;
    const result = [first, second];
    if (random() >= 0.5) {
      const third = shuffled(words, random).find((word) => !result.includes(word) && result.every((other) => compatible(word, other))
        && (new Set([...result, word].map((entry) => entry.answer)).size >= 2
          || answers.some((answer) => [...result, word].every((entry) => !entry.accepted.has(answer)))));
      if (third) result.push(third);
    }
    const row = shuffled(result, random);
    promptRows.set(floor, row);
    return row;
  }

  function platformsAt(floor: number): LearningTowerPlatform[] {
    const cached = platformRows.get(floor);
    if (cached) return cached;
    const random = createSeededRandom(`${seed}:row:${floor}`);
    const prompts = promptsAt(floor % 2 === 0 ? floor : floor - 1);
    let labels = prompts.map((word) => word.prompt);
    if (floor % 2 === 1) {
      labels = [...new Set(prompts.map((word) => word.answer))];
      const count = random() < 0.5 ? 2 : 3;
      for (const answer of shuffled(answers, random)) {
        if (labels.length >= count) break;
        if (!labels.includes(answer) && prompts.every((word) => !word.accepted.has(answer))) labels.push(answer);
      }
    }
    labels = shuffled(labels, random);
    const offset = Math.round((random() - 0.5) * 20);
    const row: LearningTowerPlatform[] = labels.map((label, slot) => ({
      index: floor * 3 + slot, floor, label,
      kind: floor % 10 === 0 ? "milestone" : "step",
      x: CLIMB_WORLD_WIDTH / 2 + (slot - (labels.length - 1) / 2) * 160 + offset - 65,
      y: floor === 0 ? 0 : -floor * CLIMB_STEP, width: 130, range: 0, periodMs: 0,
    }));
    platformRows.set(floor, row);
    return row;
  }

  const itemKind = (floor: number, window: number): PartyItemKind => {
    const random = createSeededRandom(`${seed}:item:${floor}:${window}`);
    return PARTY_ITEM_KINDS[Math.floor(random() * PARTY_ITEM_KINDS.length)]!;
  };
  const source: ClimbCourseSource = {
    platformsAt,
    itemsAt: (nowMs, nearFloor) => {
      const window = Math.floor(nowMs / CLIMB_ITEM_WINDOW_MS);
      const items = [];
      for (let floor = Math.max(3, nearFloor - 30); floor <= nearFloor + 30; floor += 1) {
        if (floor % 5 !== 3) continue;
        // Every answer platform gets the same item kind, keeping items from revealing the answer.
        for (const platform of platformsAt(floor)) {
          const slot = platform.index % 3;
          items.push({ id: `t${floor}-${slot}-${window}`, kind: itemKind(floor, window),
            x: platform.x + platform.width / 2, y: platform.y - ITEM_HOVER });
        }
      }
      return items;
    },
    kindOf: (id) => {
      const match = /^t(\d+)-([0-2])-(\d+)$/.exec(id);
      return match ? itemKind(Number(match[1]), Number(match[3])) : null;
    },
  };

  function initialProgress(): TowerProgress {
    const platform = platformsAt(0)[0]!;
    return { floor: 0, platformIndex: platform.index, prompt: platform.label, best: 0 };
  }

  function land(progress: TowerProgress, platformIndex: number): TowerProgress | null {
    const floor = Math.floor(platformIndex / 3);
    if (floor < progress.floor || floor > progress.floor + 1) return null;
    const platform = platformsAt(floor).find((entry) => entry.index === platformIndex);
    if (!platform) return null;
    if (floor % 2 === 1 && platform.label !== words.find((word) => word.prompt === progress.prompt)?.answer) return null;
    return { floor, platformIndex, prompt: floor % 2 === 0 ? platform.label : progress.prompt, best: Math.max(progress.best, floor) };
  }

  function respawnState(progress: TowerProgress): LiveMovementState {
    const platform = platformsAt(progress.floor).find((entry) => entry.index === progress.platformIndex)!;
    return { x: platform.x + platform.width / 2, y: platform.y - CLIMB_PLAYER_HEIGHT / 2, vx: 0, vy: 0 };
  }

  function parseProgress(raw: unknown): TowerProgress {
    const fallback = initialProgress();
    if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return fallback;
    const { floor, platformIndex, prompt, best } = raw as Record<string, unknown>;
    if (typeof floor !== "number" || !Number.isSafeInteger(floor) || floor < 0 || floor > 100_000
      || typeof platformIndex !== "number" || !Number.isSafeInteger(platformIndex)
      || typeof best !== "number" || !Number.isSafeInteger(best) || best < floor || best > 100_000
      || typeof prompt !== "string") return fallback;
    const platform = platformsAt(floor).find((entry) => entry.index === platformIndex);
    if (!platform || floor % 2 === 0 && platform.label !== prompt) return fallback;
    if (floor % 2 === 1 && !promptsAt(floor - 1).some((word) => word.prompt === prompt && word.answer === platform.label)) return fallback;
    return { floor, platformIndex, prompt, best };
  }

  return { source, platformsAt, initialProgress, land, respawnState, parseProgress };
}

export type LearningTower = ReturnType<typeof buildLearningTower>;
