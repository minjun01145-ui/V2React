import { useState } from "react";
import type { GameSession, Player } from "../../../multiplayer/types.ts";
import type { StudentIdentity } from "../../../auth/types.ts";

import LobbyLayout from "./LobbyLayout.tsx";
import LobbyTopBar from "./LobbyTopBar.tsx";
import styles from "./StudentLobbyPage.module.css";

import StatusPanel from "../../../shared/StatusPanel.tsx";

import NicknamePrompt from "./NicknamePrompt.tsx";
import WaitingRoomSkeleton from "./WaitingRoomSkeleton.tsx";
import WaitingRoom from "./WaitingRoom.tsx";
import type { NicknameChoice } from "./NicknamePrompt.tsx";

interface LobbyProps {
  readonly roomId: string;
  readonly session: GameSession;
  readonly player: Player;
  readonly identity: StudentIdentity;
  readonly onLeave: () => Promise<void>;
}

interface EntryProps {
  readonly roomId: string;
  readonly player: null;
  readonly identity: StudentIdentity;
  readonly onJoin: (choice: NicknameChoice) => Promise<void>;
  readonly defaultDisplayName: string;
  readonly selfStudentNumber: string;
  readonly onLeave: () => Promise<void>;
}

type Props = LobbyProps | EntryProps;

export default function StudentLobbyPage(props: Props) {
  const [leaving, setLeaving] = useState(false);
  const topBar = <LobbyTopBar leaving={leaving} onLeave={() => {
    if (leaving) return;
    setLeaving(true);
    void props.onLeave().catch((error: unknown) => {
      console.error(error);
      setLeaving(false);
    });
  }} />;
  if (props.player === null) {
    if (leaving) return <LobbyLayout topBar={topBar}><StatusPanel title="대기실에서 나가는 중" tone="waiting">로그인 화면으로 이동하고 있습니다.</StatusPanel></LobbyLayout>;
    const { roomId, identity, onJoin, defaultDisplayName, selfStudentNumber } = props;
    return <LobbyLayout topBar={topBar}><div className={styles.entry}>
      <NicknamePrompt roomId={roomId} uid={identity.uid} studentNumber={identity.studentNumber} defaultDisplayName={defaultDisplayName} onChooseNickname={onJoin} />
      <WaitingRoomSkeleton roomId={roomId} selfStudentNumber={selfStudentNumber} />
    </div></LobbyLayout>;
  }
  const { roomId, session, player, identity } = props;
  return <LobbyLayout topBar={topBar}>
    <WaitingRoom roomId={roomId} session={session} player={player} identity={identity} selfStudentNumber={player.studentNumber} displayName={player.displayName} nickname={player.nickname} nicknameGrade={player.nicknameGrade ?? null} avatar={player.avatar ?? null} uid={identity.uid} />
  </LobbyLayout>;
}
