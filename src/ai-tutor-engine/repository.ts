import { httpsCallable } from "firebase/functions";
import { functions } from "../firebase/firebaseClient.ts";
import type { AiTutorReply, AiTutorTurnInput } from "./types.ts";
import { parseAiTutorReply } from "./validation.ts";

export async function submitAiTutorTurn(input: AiTutorTurnInput): Promise<AiTutorReply> {
  const callable = httpsCallable<AiTutorTurnInput, unknown>(functions, "submitAiTutorTurn");
  return parseAiTutorReply((await callable(input)).data);
}

