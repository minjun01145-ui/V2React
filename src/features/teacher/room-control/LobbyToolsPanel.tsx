import { useState } from "react";
import type { GameSession, Player } from "../../../multiplayer/types.ts";
import Card from "../../../shared/ui/Card.tsx";
import SegmentedControl from "../../../shared/ui/SegmentedControl.tsx";
import TeacherWaitingDice from "../../../waiting-dice/TeacherWaitingDice.tsx";
import WaitingTypingSetupPanel from "./WaitingTypingSetupPanel.tsx";
import styles from "./LobbyToolsPanel.module.css";

const tools = [
  { id: "dice", label: "주사위" },
  { id: "typing", label: "대기 중 타자 세트" },
] as const;

interface Props {
  readonly roomId: string;
  readonly players: readonly Player[];
  readonly session: GameSession | null;
  readonly disabled: boolean;
  readonly typingDisabled: boolean;
}

export default function LobbyToolsPanel({ roomId, players, session, disabled, typingDisabled }: Props) {
  const [tool, setTool] = useState<"dice" | "typing">("dice");
  return <Card className={styles.panel}>
    <h2 className={styles.title}>대기실 도구</h2>
    <SegmentedControl options={tools} value={tool} onChange={setTool} ariaLabel="대기실 도구" size="sm" />
    {/* Keep rolls and the default typing-set initialization alive while switching tabs. */}
    <div hidden={tool !== "dice"}><TeacherWaitingDice roomId={roomId} players={players} disabled={disabled} /></div>
    <div hidden={tool !== "typing"}><WaitingTypingSetupPanel roomId={roomId} session={session} disabled={typingDisabled} /></div>
  </Card>;
}
