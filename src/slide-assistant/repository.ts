import { httpsCallable } from "firebase/functions";
import { functions } from "../firebase/firebaseClient.ts";
import type { AssistantDeck } from "./types.ts";
import { parseAssistantReply, type ParsedAssistantReply } from "./validation.ts";

/** Asks the built-in AI (server side) how to edit this deck for the teacher's request. */
export async function requestSlideAssist(instruction: string, deck: AssistantDeck): Promise<ParsedAssistantReply> {
  const call = httpsCallable<{ instruction: string; deck: AssistantDeck }, unknown>(functions, "assistSlide", { timeout: 180_000 });
  const { data } = await call({ instruction, deck });
  return parseAssistantReply(data, deck.fonts);
}
