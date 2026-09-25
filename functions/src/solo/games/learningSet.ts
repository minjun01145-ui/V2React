import { createHash } from "node:crypto";
import { HttpsError } from "firebase-functions/v2/https";
import { isRecord } from "../../shared/validation.js";
import type { TenantId } from "../../shared/tenant.js";
import { soloGameRules, type SoloGameId } from "../registry.js";

export interface SoloLearningItem {
  readonly id: string;
  readonly sourceText: string;
  readonly meaning: string;
  readonly author?: {
    readonly studentNumber: string;
    readonly displayName: string;
    readonly nickname: string | null;
  };
}

export interface VerifiedSoloLearningSet {
  readonly type: string;
  readonly items: readonly SoloLearningItem[];
}

export function verifySoloLearningSet(input: {
  readonly gameId: SoloGameId;
  readonly tenantId: TenantId;
  readonly setId: string;
  readonly setFingerprint: string;
  readonly metadata: unknown;
  readonly content: unknown;
}): VerifiedSoloLearningSet {
  const rules = soloGameRules(input.gameId);
  const minimums = rules.minimumItems as Readonly<Record<string, number>>;
  const supportedSetTypes: readonly string[] = rules.supportedSetTypes;
  if (!isRecord(input.metadata)
    || (input.metadata.tenantId !== undefined && input.metadata.tenantId !== input.tenantId)
    || (input.tenantId !== "minjun" && input.metadata.tenantId !== input.tenantId)
    || typeof input.metadata.type !== "string"
    || !supportedSetTypes.includes(input.metadata.type)
    || !isRecord(input.content)
    || !Array.isArray(input.content.items)) {
    throw new HttpsError("failed-precondition", "선택한 학습 세트를 이 Solo 게임에서 사용할 수 없습니다.");
  }

  const items: SoloLearningItem[] = input.content.items.map((raw): SoloLearningItem => {
    if (!isRecord(raw) || typeof raw.id !== "string" || !raw.id.trim()
      || typeof raw.sourceText !== "string" || !raw.sourceText.trim()
      || typeof raw.meaning !== "string" || !raw.meaning.trim()) {
      throw new HttpsError("failed-precondition", "학습 세트 문항 형식이 올바르지 않습니다.");
    }
    const author = isRecord(raw.author)
      && typeof raw.author.studentNumber === "string"
      && typeof raw.author.displayName === "string"
      ? {
          studentNumber: raw.author.studentNumber,
          displayName: raw.author.displayName,
          nickname: typeof raw.author.nickname === "string" ? raw.author.nickname : null,
        }
      : undefined;
    return {
      id: raw.id,
      sourceText: raw.sourceText.trim(),
      meaning: raw.meaning.trim(),
      ...(author ? { author } : {}),
    };
  });

  if (items.length < (minimums[input.metadata.type] ?? 1)
    || new Set(items.map((item) => item.id)).size !== items.length) {
    throw new HttpsError("failed-precondition", "학습 세트 문항 수가 부족하거나 문항 ID가 중복되었습니다.");
  }
  if (fingerprintLearningSet(input.metadata.type, items) !== input.setFingerprint) {
    throw new HttpsError("failed-precondition", "학습 세트가 바뀌었습니다. 세트를 다시 선택해 주세요.");
  }
  if (input.gameId === "sentence-builder" && items.some((item) => item.sourceText.split("/").map((chunk) => chunk.trim()).filter(Boolean).length < 2)) {
    throw new HttpsError("failed-precondition", "문장 만들기는 문장 조각이 두 개 이상인 세트만 사용할 수 있습니다.");
  }
  return { type: input.metadata.type, items };
}

export function fingerprintLearningSet(type: string, items: readonly Pick<SoloLearningItem, "id" | "sourceText" | "meaning">[]): string {
  const canonical = JSON.stringify({
    type,
    items: items.map((item) => ({ id: item.id, sourceText: item.sourceText.trim(), meaning: item.meaning.trim() })),
  });
  return createHash("sha256").update(canonical).digest("hex");
}
