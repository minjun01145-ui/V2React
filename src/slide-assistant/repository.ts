import { httpsCallable } from "firebase/functions";
import { functions } from "../firebase/firebaseClient.ts";
import type { AssistantReply, AssistantSlide } from "./types.ts";
import { parseAssistantReply } from "./validation.ts";

/** Asks the built-in AI (server side) how to edit this slide for the teacher's request. */
export async function requestSlideAssist(instruction: string, slide: AssistantSlide): Promise<AssistantReply> {
  const call = httpsCallable<{ instruction: string; slide: AssistantSlide }, unknown>(functions, "assistSlide", { timeout: 180_000 });
  const { data } = await call({ instruction, slide });
  return parseAssistantReply(data);
}
