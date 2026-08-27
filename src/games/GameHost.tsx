import { lazy, Suspense, type LazyExoticComponent } from "react";
import type {
  StudentGameModuleComponent,
  TeacherGameModuleComponent,
} from "../game-engine/contracts/gameDefinition.ts";
import TimedStudentGameBoundary from "../game-engine/timed-game/TimedStudentGameBoundary.tsx";
import { SESSION_STATUS } from "../multiplayer/constants.ts";
import type { ActiveGameSession, GameSession, Player } from "../multiplayer/types.ts";
import StatusPanel from "../shared/StatusPanel.tsx";
import GameErrorBoundary from "../shared/errors/GameErrorBoundary.tsx";
import { getGame } from "./registry.ts";

const studentComponentCache = new Map<string, LazyExoticComponent<StudentGameModuleComponent>>();
const teacherComponentCache = new Map<string, LazyExoticComponent<TeacherGameModuleComponent>>();

function getStudentComponent(gameId: string): LazyExoticComponent<StudentGameModuleComponent> {
  const game = getGame(gameId);
  const cached = studentComponentCache.get(game.id);
  if (cached) return cached;
  const component = lazy(game.loadStudent);
  studentComponentCache.set(game.id, component);
  return component;
}

function getTeacherComponent(gameId: string): LazyExoticComponent<TeacherGameModuleComponent> {
  const game = getGame(gameId);
  const cached = teacherComponentCache.get(game.id);
  if (cached) return cached;
  const component = lazy(game.loadTeacher);
  teacherComponentCache.set(game.id, component);
  return component;
}

function asActiveSession(session: GameSession): ActiveGameSession | null {
  return session.status === SESSION_STATUS.PLAYING && Boolean(session.roundId)
    ? { ...session, status: SESSION_STATUS.PLAYING, roundId: session.roundId as string }
    : null;
}

type Props =
  | { readonly role: "teacher"; readonly roomId: string; readonly session: GameSession; readonly player?: never }
  | { readonly role: "student"; readonly roomId: string; readonly session: GameSession; readonly player: Player };

export default function GameHost(props: Props) {
  const activeSession = asActiveSession(props.session);
  if (!activeSession) return <StatusPanel title="라운드 정보 오류" tone="error">진행 중인 게임의 roundId가 없습니다.</StatusPanel>;
  const resetKey = `${activeSession.roundId}:${activeSession.gameId}:${props.role}`;

  if (props.role === "student") {
    const game = getGame(activeSession.gameId);
    const StudentGame = getStudentComponent(game.id);
    const content = <StudentGame role="student" roomId={props.roomId} session={activeSession} player={props.player} />;
    return (
      <GameErrorBoundary resetKey={resetKey}>
        <Suspense fallback={<StatusPanel title="게임 불러오는 중">학생용 게임 모듈을 불러오고 있습니다.</StatusPanel>}>
          {game.timing === "timed" ? <TimedStudentGameBoundary roomId={props.roomId} session={activeSession} player={props.player}>{content}</TimedStudentGameBoundary> : content}
        </Suspense>
      </GameErrorBoundary>
    );
  }

  const TeacherGame = getTeacherComponent(activeSession.gameId);
  return (
    <GameErrorBoundary resetKey={resetKey}>
      <Suspense fallback={<StatusPanel title="게임 현황 불러오는 중">교사용 모니터링 모듈을 불러오고 있습니다.</StatusPanel>}>
        <TeacherGame role="teacher" roomId={props.roomId} session={activeSession} />
      </Suspense>
    </GameErrorBoundary>
  );
}
