export type MatchingCardMode = "all" | "partial";

export function readMatchingCardMode(
  config: Readonly<Record<string, unknown>> | null,
  gameId = "matching",
): MatchingCardMode {
  // Sessions created before the merge keep their original rules.
  if (gameId === "matching-all") return "all";
  return config?.["matching-cards"] === "all" ? "all" : "partial";
}

export function matchingMinimumSetItemCount(config: Readonly<Record<string, unknown>>): number {
  return readMatchingCardMode(config) === "all" ? 4 : 6;
}
