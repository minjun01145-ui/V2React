export const TEAM_NAMES = [
  "watermelon", "strawberry", "blueberry", "pineapple", "tangerine", "avocado", "banana", "coconut", "peach", "cherry",
  "grape", "mango", "lemon", "kiwi", "papaya", "cookie", "waffle", "pancake", "pretzel", "cupcake", "brownie", "pudding",
  "donut", "bagel", "pizza", "taco", "noodle", "popcorn", "cheese", "honey",
] as const;

export function teamSizes(count: number): number[] {
  if (count <= 0) return [];
  if (count === 1) return [1];
  if (count % 2 === 0) return Array.from({ length: count / 2 }, () => 2);
  return [...Array.from({ length: (count - 3) / 2 }, () => 2), 3];
}

export function shuffled<T>(values: readonly T[]): T[] {
  const result = [...values];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    const current = result[index];
    const swap = result[swapIndex];
    if (current !== undefined && swap !== undefined) { result[index] = swap; result[swapIndex] = current; }
  }
  return result;
}
