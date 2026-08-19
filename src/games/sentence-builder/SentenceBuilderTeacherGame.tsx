import type { TeacherGameModuleProps } from "../../game-engine/contracts/gameDefinition.ts";
import { sentenceBuilderDemoSet } from "./demoSet.ts";
import TeacherSentenceBuilder from "./TeacherSentenceBuilder.tsx";

function resolveSet(session: TeacherGameModuleProps["session"]): unknown {
  return session.gameConfig?.set ?? sentenceBuilderDemoSet;
}

export default function SentenceBuilderTeacherGame({ roomId, session }: TeacherGameModuleProps) {
  return <TeacherSentenceBuilder roomId={roomId} session={session} set={resolveSet(session)} />;
}
