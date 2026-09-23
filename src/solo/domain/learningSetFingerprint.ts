import type { RuntimeLearningSet } from "../../learning-sets/types.ts";
import { sha256Hex } from "./config.ts";

export function canonicalizeLearningSetContent(set: RuntimeLearningSet): string {
  return JSON.stringify({
    type: set.type,
    items: set.items.map((item) => ({
      id: item.id,
      sourceText: item.sourceText.trim(),
      meaning: item.meaning.trim(),
    })),
  });
}

export function fingerprintLearningSet(set: RuntimeLearningSet): Promise<string> {
  return sha256Hex(canonicalizeLearningSetContent(set));
}
