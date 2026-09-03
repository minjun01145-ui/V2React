import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { minimumSetItemCountForType } from "../../../game-engine/contracts/gameDefinition.ts";
import { getGame, listGames } from "../../../games/registry.ts";
import { listLearningSets } from "../../../learning-sets/readRepository.ts";
import type { LearningSetSummary } from "../../../learning-sets/types.ts";
import { deleteQuizGamePlan, getQuizGamePlan, listQuizGamePlans, saveQuizGamePlan } from "../../../quiz-game/repository.ts";
import type { QuizGameCustomItem, QuizGamePlan, QuizGamePlanSummary, QuizGameRound } from "../../../quiz-game/types.ts";
import { validateQuizGameName, validateQuizGameRounds } from "../../../quiz-game/validation.ts";
import PageShell from "../../../shared/PageShell.tsx";
import { toErrorMessage } from "../../../shared/errors/errorMessage.ts";
import { usePopup } from "../../../shared/popup/index.ts";
import Button from "../../../shared/ui/Button.tsx";
import Card from "../../../shared/ui/Card.tsx";
import { Muted } from "../../../shared/ui/Typography.tsx";
import styles from "./TeacherQuizGamePage.module.css";

const engines = listGames().filter((game) => game.supportedSetTypes.length > 0);

function newRound(index: number): QuizGameRound {
  const game = engines[0] ?? getGame("simple-quiz");
  return {
    id: crypto.randomUUID(),
    title: `${index + 1}번 문제`,
    gameId: game.id,
    source: { kind: "stored-set", setId: null },
    durationSeconds: 30,
    gameConfig: Object.fromEntries(game.settings.map((setting) => [setting.key, setting.defaultValue])),
  };
}

function newCustomItem(): QuizGameCustomItem {
  return { id: crypto.randomUUID(), sourceText: "", meaning: "" };
}

function compatibleSets(round: QuizGameRound, sets: readonly LearningSetSummary[]): readonly LearningSetSummary[] {
  const game = getGame(round.gameId);
  return sets.filter((set) => game.supportedSetTypes.includes(set.type));
}

export default function TeacherQuizGamePage({ roomId }: { readonly roomId: string }) {
  const [plans, setPlans] = useState<readonly QuizGamePlanSummary[]>([]);
  const [sets, setSets] = useState<readonly LearningSetSummary[]>([]);
  const [selected, setSelected] = useState<QuizGamePlan | null>(null);
  const [name, setName] = useState("");
  const [rounds, setRounds] = useState<readonly QuizGameRound[]>([newRound(0)]);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const { requestConfirmation } = usePopup();

  const refresh = useCallback(async (): Promise<void> => {
    const [nextPlans, nextSets] = await Promise.all([listQuizGamePlans(), listLearningSets()]);
    setPlans(nextPlans);
    setSets(nextSets);
  }, []);

  useEffect(() => { void refresh().catch((value: unknown) => setError(toErrorMessage(value, "퀴즈 목록을 불러오지 못했습니다."))); }, [refresh]);

  const validationError = useMemo(() => {
    try {
      validateQuizGameName(name);
      validateQuizGameRounds(rounds);
      for (const round of rounds) {
        const game = getGame(round.gameId);
        const source = round.source;
        if (source.kind === "stored-set") {
          const set = sets.find((item) => item.id === source.setId);
          if (game.requiresStoredSet && !set) throw new Error(`${round.title}: 학습 세트를 선택해 주세요.`);
          if (set && set.itemCount < minimumSetItemCountForType(game, set.type)) throw new Error(`${round.title}: ${game.title}에 필요한 문항 수가 부족합니다.`);
        } else {
          if (!game.supportsFiniteQuizQuestions || !game.supportedSetTypes.includes(source.setType)) throw new Error(`${round.title}: 이 엔진은 선택한 직접 출제 형식을 지원하지 않습니다.`);
          if (source.items.length < minimumSetItemCountForType(game, source.setType)) throw new Error(`${round.title}: ${game.title}에 필요한 문항 수가 부족합니다.`);
        }
      }
      return "";
    } catch (value: unknown) {
      return toErrorMessage(value, "퀴즈 설정을 확인해 주세요.");
    }
  }, [name, rounds, sets]);

  const updateRound = (id: string, update: (round: QuizGameRound) => QuizGameRound): void => {
    setRounds((current) => current.map((round) => round.id === id ? update(round) : round));
  };

  const selectEngine = (round: QuizGameRound, gameId: string): void => {
    const game = getGame(gameId);
    const candidates = sets.filter((set) => game.supportedSetTypes.includes(set.type));
    updateRound(round.id, (current) => ({
      ...current,
      gameId: game.id,
      source: { kind: "stored-set", setId: candidates[0]?.id ?? null },
      gameConfig: Object.fromEntries(game.settings.map((setting) => [setting.key, setting.defaultValue])),
    }));
  };

  const resetEditor = (): void => {
    setSelected(null);
    setName("");
    setRounds([newRound(0)]);
    setError("");
    setNotice("");
  };

  const loadPlan = async (summary: QuizGamePlanSummary): Promise<void> => {
    setBusy(`load-${summary.id}`);
    setError("");
    try {
      const plan = await getQuizGamePlan(summary.id);
      setSelected(plan);
      setName(plan.name);
      setRounds(plan.rounds);
    } catch (value: unknown) {
      setError(toErrorMessage(value, "퀴즈를 불러오지 못했습니다."));
    } finally {
      setBusy("");
    }
  };

  const save = async (event: FormEvent): Promise<void> => {
    event.preventDefault();
    if (busy || validationError) return;
    setBusy("save");
    setError("");
    try {
      const plan = await saveQuizGamePlan({ ...(selected ? { id: selected.id, createdAtMs: selected.createdAtMs } : {}), name, rounds });
      setSelected(plan);
      setName(plan.name);
      setRounds(plan.rounds);
      setNotice(`“${plan.name}” 퀴즈를 저장했습니다.`);
      await refresh();
    } catch (value: unknown) {
      setError(toErrorMessage(value, "퀴즈를 저장하지 못했습니다."));
    } finally {
      setBusy("");
    }
  };

  const remove = async (): Promise<void> => {
    if (!selected || busy) return;
    const confirmed = await requestConfirmation({ title: `“${selected.name}” 퀴즈를 삭제할까요?`, message: "저장된 퀴즈 계획만 삭제되며 학습 세트와 게임 엔진은 삭제되지 않습니다.", tone: "error", confirmLabel: "퀴즈 삭제", blurBackground: true });
    if (!confirmed) return;
    setBusy("delete");
    try {
      await deleteQuizGamePlan(selected.id);
      resetEditor();
      await refresh();
    } catch (value: unknown) {
      setError(toErrorMessage(value, "퀴즈를 삭제하지 못했습니다."));
    } finally {
      setBusy("");
    }
  };

  return <PageShell title="퀴즈게임 편집기" roomId={roomId} actions={<Button variant="ghost" onClick={resetEditor} disabled={Boolean(busy)}>새 퀴즈</Button>}>
    <p className={styles.intro}>각 라운드는 기존 문제 엔진과 학습 세트를 참조합니다. 여기서는 문제나 채점 로직을 복제하지 않습니다.</p>
    {error ? <p className={styles.error} role="alert">{error}</p> : null}
    {notice ? <p className={styles.notice} role="status">{notice}</p> : null}
    <div className={styles.workspace}>
      <Card className={styles.planList}>
        <h2>저장된 퀴즈</h2>
        {plans.length === 0 ? <Muted>아직 저장된 퀴즈가 없습니다.</Muted> : plans.map((plan) => <button className={styles.planButton} type="button" onClick={() => void loadPlan(plan)} disabled={Boolean(busy)} data-selected={selected?.id === plan.id} key={plan.id}><strong>{plan.name}</strong><small>{plan.roundCount}개 라운드</small></button>)}
      </Card>
      <Card as="form" className={styles.editor} onSubmit={(event) => void save(event)}>
        <label className={styles.nameField}>퀴즈 이름<input value={name} maxLength={80} onChange={(event) => setName(event.target.value)} placeholder="예: 2단원 복습 퀴즈" disabled={Boolean(busy)} /></label>
        <div className={styles.rounds}>{rounds.map((round, index) => {
          const game = getGame(round.gameId);
          const candidates = compatibleSets(round, sets);
          const source = round.source;
          const sourceType = source.kind === "custom" ? source.setType : (game.supportedSetTypes[0] ?? "vocabulary");
          const readingChunks = sourceType === "reading-chunks";
          return <section className={styles.round} key={round.id}>
            <header><strong>{index + 1}</strong><input aria-label={`${index + 1}번 라운드 제목`} value={round.title} maxLength={80} onChange={(event) => updateRound(round.id, (current) => ({ ...current, title: event.target.value }))} disabled={Boolean(busy)} /><Button variant="ghost" onClick={() => setRounds((current) => current.filter((item) => item.id !== round.id))} disabled={Boolean(busy) || rounds.length === 1}>삭제</Button></header>
            <div className={styles.fields}>
              <label>문제 엔진<select value={round.gameId} onChange={(event) => selectEngine(round, event.target.value)} disabled={Boolean(busy)}>{engines.map((item) => <option value={item.id} key={item.id}>{item.title}</option>)}</select></label>
              <label>문제 공급<select value={round.source.kind} onChange={(event) => updateRound(round.id, (current) => event.target.value === "custom" ? { ...current, source: { kind: "custom", setType: (game.supportedSetTypes[0] === "reading-chunks" ? "reading-chunks" : "vocabulary"), items: [newCustomItem()] } } : { ...current, source: { kind: "stored-set", setId: candidates[0]?.id ?? null } })} disabled={Boolean(busy) || !game.supportsFiniteQuizQuestions}><option value="stored-set">학습 세트 반복</option>{game.supportsFiniteQuizQuestions ? <option value="custom">교사 직접 출제</option> : null}</select></label>
              {round.source.kind === "stored-set" ? <label>학습 세트<select value={round.source.setId ?? ""} onChange={(event) => updateRound(round.id, (current) => ({ ...current, source: { kind: "stored-set", setId: event.target.value || null } }))} disabled={Boolean(busy)}><option value="">{game.requiresStoredSet ? "세트 선택" : "내장 세트"}</option>{candidates.map((set) => <option value={set.id} key={set.id}>{set.name} ({set.itemCount})</option>)}</select></label> : null}
              {round.source.kind === "custom" && game.supportedSetTypes.length > 1 ? <label>문항 형식<select value={round.source.setType} onChange={(event) => updateRound(round.id, (current) => current.source.kind === "custom" ? { ...current, source: { ...current.source, setType: event.target.value === "reading-chunks" ? "reading-chunks" : "vocabulary" } } : current)} disabled={Boolean(busy)}>{game.supportedSetTypes.includes("vocabulary") ? <option value="vocabulary">단어·뜻</option> : null}{game.supportedSetTypes.includes("reading-chunks") ? <option value="reading-chunks">문장 조각·뜻</option> : null}</select></label> : null}
              <label>답안 시간(초)<input type="number" min={10} max={600} value={round.durationSeconds} onChange={(event) => updateRound(round.id, (current) => ({ ...current, durationSeconds: Number(event.target.value) }))} disabled={Boolean(busy)} /></label>
              {game.settings.map((setting) => <label key={setting.key}>{setting.label}<select value={round.gameConfig[setting.key] ?? setting.defaultValue} onChange={(event) => updateRound(round.id, (current) => ({ ...current, gameConfig: { ...current.gameConfig, [setting.key]: event.target.value } }))} disabled={Boolean(busy)}>{setting.options.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}</select></label>)}
            </div>
            {source.kind === "custom" ? <div className={styles.customQuestions}>
              <div className={styles.customHeading}><strong>직접 출제 문항</strong><small>{readingChunks ? "문장을 / 기호로 두 조각 이상 나누세요." : "왼쪽 내용과 뜻을 입력하세요."}</small></div>
              {source.items.map((item, itemIndex) => <div className={styles.customRow} key={item.id}><b>{itemIndex + 1}</b><label>{readingChunks ? "문장 조각" : "단어·문장"}<input value={item.sourceText} onChange={(event) => updateRound(round.id, (current) => current.source.kind === "custom" ? { ...current, source: { ...current.source, items: current.source.items.map((candidate) => candidate.id === item.id ? { ...candidate, sourceText: event.target.value } : candidate) } } : current)} placeholder={readingChunks ? "I go / to school." : "apple"} disabled={Boolean(busy)} /></label><label>뜻·문제<input value={item.meaning} onChange={(event) => updateRound(round.id, (current) => current.source.kind === "custom" ? { ...current, source: { ...current.source, items: current.source.items.map((candidate) => candidate.id === item.id ? { ...candidate, meaning: event.target.value } : candidate) } } : current)} placeholder={readingChunks ? "나는 학교에 간다." : "사과"} disabled={Boolean(busy)} /></label><Button variant="ghost" onClick={() => updateRound(round.id, (current) => current.source.kind === "custom" ? { ...current, source: { ...current.source, items: current.source.items.filter((candidate) => candidate.id !== item.id) } } : current)} disabled={Boolean(busy) || source.items.length === 1}>삭제</Button></div>)}
              <Button variant="ghost" onClick={() => updateRound(round.id, (current) => current.source.kind === "custom" ? { ...current, source: { ...current.source, items: [...current.source.items, newCustomItem()] } } : current)} disabled={Boolean(busy) || source.items.length >= 100}>+ 문제 추가</Button>
            </div> : null}
          </section>;
        })}</div>
        <Button variant="ghost" onClick={() => setRounds((current) => [...current, newRound(current.length)])} disabled={Boolean(busy) || rounds.length >= 50}>+ 라운드 추가</Button>
        {validationError ? <p className={styles.error}>{validationError}</p> : null}
        <div className={styles.actions}><Button type="submit" disabled={Boolean(busy) || Boolean(validationError)}>{busy === "save" ? "저장 중…" : "퀴즈 저장"}</Button>{selected ? <Button variant="ghost" onClick={() => void remove()} disabled={Boolean(busy)}>삭제</Button> : null}</div>
      </Card>
    </div>
  </PageShell>;
}
