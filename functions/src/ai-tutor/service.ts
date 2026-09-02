import { generateAiReply } from "../ai/service.js";
import { buildAiTutorMessages } from "./prompt.js";
import { loadAiTutorRoundContext } from "./repository.js";
import type { AiTutorReply, AiTutorRoundContext, AiTutorTurnInput } from "./types.js";
import { AiTutorValidationError, parseAiTutorReply } from "./validation.js";

function compact(value: string): string {
  return value.normalize("NFKC").toLocaleLowerCase().replace(/[\s/.,!?'’"()-]+/g, "");
}

function protectReferenceAnswer(reply: AiTutorReply, context: AiTutorRoundContext): AiTutorReply {
  if (reply.kind === "correct" || reply.kind === "off-topic") return reply;
  const answer = compact(context.direction === "source-to-meaning" ? context.item.meaning : context.item.sourceText);
  const leaked = answer.length >= 2 && [reply.feedback, reply.hint ?? "", reply.focus ?? ""].some((value) => compact(value).includes(answer));
  if (!leaked) return reply;
  return {
    ...reply,
    feedback: reply.kind === "help" ? "정답 전체 대신, 막힌 단어나 문법을 더 구체적으로 물어봐 주세요." : "핵심 의미와 문장 구조를 다시 확인해 보세요.",
    hint: reply.kind === "retry" ? "제시문의 핵심어부터 하나씩 대응해 보세요." : null,
    focus: null,
  };
}

export async function evaluateAiTutorTurn(uid: string, turn: AiTutorTurnInput): Promise<AiTutorReply> {
  const context = await loadAiTutorRoundContext({ uid, roomId: turn.roomId, roundId: turn.roundId, itemId: turn.itemId, requestedDirection: turn.direction });
  const messages = buildAiTutorMessages(context, turn);
  try {
    return protectReferenceAnswer(parseAiTutorReply((await generateAiReply(messages)).reply), context);
  } catch (firstError: unknown) {
    if (!(firstError instanceof AiTutorValidationError)) throw firstError;
    const repairMessages = [
      ...messages,
      { role: "assistant" as const, content: "이전 출력이 JSON 계약을 지키지 못했습니다." },
      { role: "user" as const, content: "같은 판정을 JSON 객체 하나로만 다시 출력하세요." },
    ];
    return protectReferenceAnswer(parseAiTutorReply((await generateAiReply(repairMessages)).reply), context);
  }
}
