export const COOPERATIVE_TEAM_NAMES = Object.freeze([
  "watermelon", "strawberry", "blueberry", "pineapple", "tangerine", "avocado",
  "banana", "coconut", "peach", "cherry", "grape", "mango", "lemon", "kiwi",
  "papaya", "cookie", "waffle", "pancake", "pretzel", "cupcake", "brownie",
  "pudding", "donut", "bagel", "pizza", "taco", "noodle", "popcorn", "cheese", "honey",
] as const);

export function cooperativeTeamSizes(playerCount: number): readonly number[] {
  const count = Math.max(0, Math.trunc(playerCount));
  if (count === 0) return [];
  if (count === 1) return [1];
  if (count % 2 === 0) return Array.from({ length: count / 2 }, () => 2);
  return [...Array.from({ length: (count - 3) / 2 }, () => 2), 3];
}

export function cooperativeSearchDelayMs(searcherCount: number): number {
  return searcherCount === 2 ? 10_000 : 0;
}
