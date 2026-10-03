import JumpTowerGame from "../../game-engine/jump-tower/JumpTowerGame.tsx";
import { ImmersiveStage } from "../../game-engine/stage/ImmersiveStage.tsx";
import type { Player } from "../../multiplayer/types.ts";

interface Props {
  readonly roomId: string;
  readonly playerId: string;
  readonly label: string;
  readonly players: readonly Player[];
  readonly onExit: () => void;
}

export default function LobbyPlatformer(props: Props) {
  return <ImmersiveStage><JumpTowerGame {...props} /></ImmersiveStage>;
}
