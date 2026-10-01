import { usePlayers } from "../../../multiplayer/hooks.ts";
import PlayerGrid from "../../../multiplayer/ui/PlayerGrid.tsx";
import LobbyActivityTiles from "./LobbyActivityTiles.tsx";
import styles from "./WaitingRoomSkeleton.module.css";
export default function WaitingRoomSkeleton({ roomId, selfStudentNumber }: { readonly roomId: string; readonly selfStudentNumber: string }) {
  const { activePlayers } = usePlayers(roomId);
  return <div className={styles.skeleton}><PlayerGrid players={activePlayers} selfStudentNumber={selfStudentNumber} /><LobbyActivityTiles disabled /></div>;
}
