import type { AiTutorDirection } from "../../ai-tutor-engine/types.ts";
import type { ActiveGameSession } from "../../multiplayer/types.ts";

export function aiTutorDirection(session: ActiveGameSession): AiTutorDirection {
  return session.gameConfig?.direction === "meaning-to-source" ? "meaning-to-source" : "source-to-meaning";
}

