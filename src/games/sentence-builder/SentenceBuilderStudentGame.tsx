import type { StudentGameModuleProps } from "../../game-engine/contracts/gameDefinition.ts";
import { sentenceBuilderDemoSet } from "./demoSet.ts";
import StudentSentenceBuilder from "./StudentSentenceBuilder.tsx";

function resolveSet(session: StudentGameModuleProps["session"]): unknown {
  return session.gameConfig?.set ?? sentenceBuilderDemoSet;
}

export default function SentenceBuilderStudentGame({ roomId, session, player }: StudentGameModuleProps) {
  return <StudentSentenceBuilder roomId={roomId} session={session} player={player} set={resolveSet(session)} />;
}
