import { getGame } from "../../../games/registry.ts";
import { readMatchingCardMode } from "../../../games/matching/config.ts";
import type { LearningSetSummary } from "../../../learning-sets/types.ts";
import type { SlideEngineRound, SlideEngineSource } from "../../../slide-show/types.ts";
import Button from "../../../shared/ui/Button.tsx";
import Field from "../../../shared/ui/Field.tsx";
import Select from "../../../shared/ui/Select.tsx";
import { compatibleSets, engineRoundForGame, newCustomItem, SLIDE_ENGINE_GAMES } from "./engineDraft.ts";
import styles from "./SlideEnginePanel.module.css";

interface Props {
  readonly round: SlideEngineRound;
  readonly sets: readonly LearningSetSummary[];
  readonly disabled: boolean;
  readonly issue: string | null;
  readonly onChange: (round: SlideEngineRound) => void;
  readonly onRemove: () => void;
}

export default function SlideEnginePanel({ round: storedRound, sets, disabled, issue, onChange, onRemove }: Props) {
  const round = storedRound.gameId === "matching" || storedRound.gameId === "matching-all"
    ? { ...storedRound, gameId: "matching", gameConfig: { ...storedRound.gameConfig, "matching-cards": readMatchingCardMode(storedRound.gameConfig, storedRound.gameId) } }
    : storedRound;
  const game = getGame(round.gameId);
  const candidates = compatibleSets(round, sets);
  const source = round.source;
  const readingChunks = source.kind === "custom" && source.setType === "reading-chunks";
  const setSource = (next: SlideEngineSource): void => onChange({ ...round, source: next });
  const updateItems = (update: (items: Extract<SlideEngineSource, { kind: "custom" }>["items"]) => Extract<SlideEngineSource, { kind: "custom" }>["items"]): void => {
    if (source.kind === "custom") setSource({ ...source, items: update(source.items) });
  };

  return <section className={styles.panel} aria-label="문제 엔진 설정">
    <header className={styles.header}><h3>문제 엔진</h3><Button variant="danger" size="sm" onClick={onRemove} disabled={disabled}>삭제</Button></header>
    <div className={styles.fields}>
      <Field label="엔진"><Select value={round.gameId} onChange={(event) => onChange(engineRoundForGame(event.target.value, sets))} disabled={disabled}>{SLIDE_ENGINE_GAMES.map((item) => <option value={item.id} key={item.id}>{item.title}</option>)}</Select></Field>
      <Field label="시간(초)"><input className={styles.input} type="number" min={10} max={600} step={5} value={round.durationSeconds} onChange={(event) => onChange({ ...round, durationSeconds: Number(event.target.value) })} disabled={disabled} /></Field>
      {source.kind !== "free-response" ? <Field label="문제 공급"><Select value={source.kind} onChange={(event) => setSource(event.target.value === "custom"
        ? { kind: "custom", setType: game.supportedSetTypes[0] === "reading-chunks" ? "reading-chunks" : "vocabulary", items: [newCustomItem()] }
        : { kind: "stored-set", setId: candidates[0]?.id ?? null })} disabled={disabled || !game.supportsFiniteQuizQuestions}>
        <option value="stored-set">학습 세트 반복</option>
        {game.supportsFiniteQuizQuestions ? <option value="custom">교사 직접 출제</option> : null}
      </Select></Field> : null}
      {source.kind === "stored-set" ? <Field label="학습 세트"><Select value={source.setId ?? ""} onChange={(event) => setSource({ kind: "stored-set", setId: event.target.value || null })} disabled={disabled}>
        <option value="">{game.requiresStoredSet ? "세트 선택" : "내장 세트"}</option>
        {candidates.map((set) => <option value={set.id} key={set.id}>{set.name} ({set.itemCount})</option>)}
      </Select></Field> : null}
      {source.kind === "custom" && game.supportedSetTypes.length > 1 ? <Field label="문항 형식"><Select value={source.setType} onChange={(event) => setSource({ ...source, setType: event.target.value === "reading-chunks" ? "reading-chunks" : "vocabulary" })} disabled={disabled}>
        {game.supportedSetTypes.includes("vocabulary") ? <option value="vocabulary">단어·뜻</option> : null}
        {game.supportedSetTypes.includes("reading-chunks") ? <option value="reading-chunks">문장 조각·뜻</option> : null}
      </Select></Field> : null}
      {game.settings.map((setting) => <Field label={setting.label} key={setting.key}><Select value={round.gameConfig[setting.key] ?? setting.defaultValue} onChange={(event) => onChange({ ...round, gameConfig: { ...round.gameConfig, [setting.key]: event.target.value } })} disabled={disabled}>
        {setting.options.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}
      </Select></Field>)}
    </div>
    {source.kind === "free-response" ? <Field label="학생에게 보여줄 질문"><textarea className={styles.textarea} rows={3} value={source.prompt} maxLength={1000} onChange={(event) => setSource({ kind: "free-response", prompt: event.target.value })} disabled={disabled} /></Field> : null}
    {source.kind === "custom" ? <div className={styles.items}>
      {source.items.map((item, index) => <div className={styles.item} key={item.id}>
        <b>{index + 1}</b>
        <input className={styles.input} aria-label={`${index + 1}번 ${readingChunks ? "문장 조각" : "단어·문장"}`} value={item.sourceText} placeholder={readingChunks ? "I go / to school." : "apple"} onChange={(event) => updateItems((items) => items.map((candidate) => candidate.id === item.id ? { ...candidate, sourceText: event.target.value } : candidate))} disabled={disabled} />
        <input className={styles.input} aria-label={`${index + 1}번 뜻`} value={item.meaning} placeholder={readingChunks ? "나는 학교에 간다." : "사과"} onChange={(event) => updateItems((items) => items.map((candidate) => candidate.id === item.id ? { ...candidate, meaning: event.target.value } : candidate))} disabled={disabled} />
        <Button variant="quiet" size="sm" aria-label={`${index + 1}번 문항 삭제`} onClick={() => updateItems((items) => items.filter((candidate) => candidate.id !== item.id))} disabled={disabled || source.items.length === 1}>×</Button>
      </div>)}
      <Button variant="ghost" size="sm" onClick={() => updateItems((items) => [...items, newCustomItem()])} disabled={disabled || source.items.length >= 100}>+ 문항 추가</Button>
    </div> : null}
    {issue ? <p className={styles.issue} role="alert">{issue}</p> : null}
  </section>;
}
