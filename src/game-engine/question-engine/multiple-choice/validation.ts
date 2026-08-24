import { CHOICE_DIRECTION, type ChoiceCount, type ChoiceDirection, type MultipleChoicePair } from "./types.ts";

export function parseChoiceCount(value: unknown): ChoiceCount {
  const count = typeof value === "number" ? value : Number(value);
  if (count === 2 || count === 3 || count === 4 || count === 5) return count;
  throw new Error("선택지 수는 2개부터 5개까지 설정할 수 있습니다.");
}

export function parseChoiceDirection(value: unknown): ChoiceDirection {
  if (value === CHOICE_DIRECTION.LEFT_TO_RIGHT || value === CHOICE_DIRECTION.RIGHT_TO_LEFT) return value;
  throw new Error("객관식 출제 방향이 올바르지 않습니다.");
}

export function validateMultipleChoicePairs<TSource>(pairs: readonly MultipleChoicePair<TSource>[]): readonly MultipleChoicePair<TSource>[] {
  if (!Array.isArray(pairs) || pairs.length < 2) throw new Error("객관식 문제를 만들려면 두 개 이상의 학습 항목이 필요합니다.");
  const ids = new Set<string>();
  return pairs.map((pair, index) => {
    const id = String(pair.id ?? "").trim();
    const left = String(pair.left ?? "").trim();
    const right = String(pair.right ?? "").trim();
    if (!id || !left || !right) throw new Error(`${index + 1}번째 객관식 쌍의 ID와 양쪽 문구가 모두 필요합니다.`);
    if (ids.has(id)) throw new Error(`객관식 쌍 ID가 중복되었습니다: ${id}`);
    ids.add(id);
    return { ...pair, id, left, right };
  });
}
