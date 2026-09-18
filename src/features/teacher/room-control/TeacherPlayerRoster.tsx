import { useState } from "react";
import { removePlayerFromSession } from "../../../multiplayer/repository.ts";
import { displayLabel, type Player } from "../../../multiplayer/types.ts";
import PlayerGrid from "../../../multiplayer/ui/PlayerGrid.tsx";
import { toErrorMessage } from "../../../shared/errors/errorMessage.ts";
import { usePopup } from "../../../shared/popup/index.ts";
import Card from "../../../shared/ui/Card.tsx";
import styles from "./TeacherRoomController.module.css";

interface Props {
  readonly roomId: string;
  readonly players: readonly Player[];
  readonly disabled?: boolean;
}

export default function TeacherPlayerRoster({ roomId, players, disabled = false }: Props) {
  const [showStudentNumbers, setShowStudentNumbers] = useState(true);
  const [removingPlayerId, setRemovingPlayerId] = useState<string | null>(null);
  const { requestConfirmation, showMessage } = usePopup();

  const removePlayer = async (player: Player): Promise<void> => {
    if (disabled || removingPlayerId) return;
    const label = displayLabel(player.displayName, player.nickname);
    const confirmed = await requestConfirmation({
      title: `${label} 학생을 대기실에서 내보낼까요?`,
      message: "현재 방의 접속만 종료합니다. 학생 명단과 로그인 정보는 삭제되지 않으며, 학생이 원하면 다시 입장할 수 있습니다.",
      tone: "error",
      confirmLabel: "강퇴하기",
      cancelLabel: "취소",
      blurBackground: true,
    });
    if (!confirmed) return;

    setRemovingPlayerId(player.id);
    try {
      await removePlayerFromSession(roomId, player.id);
    } catch (error: unknown) {
      console.error(error);
      await showMessage({
        title: "학생을 강퇴하지 못했습니다",
        message: toErrorMessage(error, "잠시 후 다시 시도해 주세요."),
        tone: "error",
        blurBackground: false,
      });
    } finally {
      setRemovingPlayerId(null);
    }
  };

  return (
    <Card>
      <div className={styles.heading}>
        <div className={styles.headingTitle}><h2>접속 학생</h2><span className={styles.count}>{players.length}</span></div>
        <button
          className={styles.studentNumberToggle}
          type="button"
          aria-pressed={showStudentNumbers}
          onClick={() => setShowStudentNumbers((visible) => !visible)}
        >
          <span className={styles.toggleTrack} aria-hidden="true"><span className={styles.toggleThumb} /></span>
          학번 {showStudentNumbers ? "표시" : "숨김"}
        </button>
      </div>
      <PlayerGrid
        players={players}
        showStudentNumber={showStudentNumbers}
        emptyMessage="접속한 학생이 없습니다."
        onPlayerClick={(player) => void removePlayer(player)}
        disabled={disabled || removingPlayerId !== null}
        disabledPlayerId={removingPlayerId}
      />
    </Card>
  );
}
