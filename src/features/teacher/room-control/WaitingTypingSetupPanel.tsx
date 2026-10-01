import { useEffect, useMemo, useRef, useState } from "react";
import { createWaitingTypingConfig, parseWaitingTypingConfig, serializeWaitingTypingConfig } from "../../../games/typing/waitingTypingConfig.ts";
import { listLearningSets } from "../../../learning-sets/readRepository.ts";
import { LEARNING_SET_TYPE, learningSetTypeLabel, type LearningSetSummary } from "../../../learning-sets/types.ts";
import { updateWaitingTypingConfig } from "../../../multiplayer/repository.ts";
import type { GameSession } from "../../../multiplayer/types.ts";
import { toErrorMessage } from "../../../shared/errors/errorMessage.ts";
import Field from "../../../shared/ui/Field.tsx";
import Select from "../../../shared/ui/Select.tsx";
import { Muted } from "../../../shared/ui/Typography.tsx";
import styles from "./WaitingTypingSetupPanel.module.css";

interface Props {
  readonly roomId: string;
  readonly session: GameSession | null;
  readonly disabled: boolean;
}

export default function WaitingTypingSetupPanel({ roomId, session, disabled }: Props) {
  const [sets, setSets] = useState<readonly LearningSetSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const initializedRoom = useRef<string | null>(null);
  const compatibleSets = useMemo(() => sets.filter((set) => set.type === LEARNING_SET_TYPE.VOCABULARY || set.type === LEARNING_SET_TYPE.READING_CHUNKS), [sets]);
  const config = parseWaitingTypingConfig(session?.waitingTypingConfig);
  const validConfig = config && compatibleSets.some((set) => set.id === config.setId) ? config : null;

  useEffect(() => {
    let active = true;
    void listLearningSets()
      .then((value) => { if (active) setSets(value); })
      .catch((value: unknown) => { if (active) setError(toErrorMessage(value, "학습 세트 목록을 불러오지 못했습니다.")); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    const firstSetId = compatibleSets[0]?.id;
    if (!session || validConfig || !firstSetId || initializedRoom.current === roomId) return;
    initializedRoom.current = roomId;
    setSaving(true);
    void updateWaitingTypingConfig(roomId, serializeWaitingTypingConfig(createWaitingTypingConfig(firstSetId)))
      .catch((value: unknown) => setError(toErrorMessage(value, "기본 타자 연습 세트를 저장하지 못했습니다.")))
      .finally(() => setSaving(false));
  }, [compatibleSets, roomId, session, validConfig]);

  const selectSet = (setId: string): void => {
    if (!setId || saving) return;
    setSaving(true);
    setError("");
    void updateWaitingTypingConfig(roomId, serializeWaitingTypingConfig(createWaitingTypingConfig(setId)))
      .catch((value: unknown) => setError(toErrorMessage(value, "타자 연습 세트를 저장하지 못했습니다.")))
      .finally(() => setSaving(false));
  };

  return <div className={styles.waitingTypingPicker}>
    <div>
      <Muted>학생이 대기실에서 문장 타자·산성비를 할 때 쓰는 세트입니다.</Muted>
    </div>
    <Field label="연습 세트"><Select
      value={validConfig?.setId ?? compatibleSets[0]?.id ?? ""}
      onChange={(event) => selectSet(event.target.value)}
      disabled={disabled || loading || saving || compatibleSets.length === 0}
    >
      {compatibleSets.length === 0 ? <option value="">사용할 수 있는 세트가 없습니다</option> : null}
      {compatibleSets.map((set) => <option value={set.id} key={set.id}>{set.name} · {learningSetTypeLabel(set.type)} ({set.itemCount}개)</option>)}
    </Select></Field>
    {error ? <p className={styles.setError}>{error}</p> : null}
  </div>;
}
