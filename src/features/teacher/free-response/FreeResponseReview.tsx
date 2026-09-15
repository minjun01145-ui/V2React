import { useRef, useState } from "react";
import { useFreeResponses } from "../../../free-response/hooks.ts";
import { freeResponseRows } from "../../../free-response/model.ts";
import { awardFreeResponsePoints } from "../../../free-response/repository.ts";
import FreeResponseDashboard from "../../../free-response/ui/FreeResponseDashboard.tsx";
import { useRoundParticipants } from "../../../multiplayer/hooks.ts";
import StatusPanel from "../../../shared/StatusPanel.tsx";
import { toErrorMessage } from "../../../shared/errors/errorMessage.ts";

export default function FreeResponseReview({ roomId, roundId, disabled = false, onWorkingChange }: {
  readonly roomId: string;
  readonly roundId: string;
  readonly disabled?: boolean;
  readonly onWorkingChange?: (working: boolean) => void;
}) {
  const participants = useRoundParticipants(roomId, roundId);
  const responses = useFreeResponses(roomId, roundId);
  const [busyPlayerId, setBusyPlayerId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const busyRef = useRef(false);
  const award = async (playerId: string): Promise<void> => {
    if (busyRef.current || disabled) return;
    busyRef.current = true;
    setBusyPlayerId(playerId);
    onWorkingChange?.(true);
    setError("");
    try { await awardFreeResponsePoints(roomId, roundId, playerId); }
    catch (value: unknown) { setError(toErrorMessage(value, "점수를 부여하지 못했습니다.")); }
    finally { busyRef.current = false; setBusyPlayerId(null); onWorkingChange?.(false); }
  };
  const loadError = participants.error ?? responses.error;
  if (loadError) return <StatusPanel title="답안 현황 오류" tone="error">{loadError.message}</StatusPanel>;
  if (participants.loading || responses.loading) return <StatusPanel title="답안 불러오는 중">학생별 답안을 준비하고 있습니다.</StatusPanel>;
  return <>{error ? <StatusPanel title="점수 저장 오류" tone="error">{error}</StatusPanel> : null}<FreeResponseDashboard rows={freeResponseRows(participants.value, responses.value)} busyPlayerId={busyPlayerId} disabled={disabled} onAward={(playerId) => void award(playerId)} /></>;
}
