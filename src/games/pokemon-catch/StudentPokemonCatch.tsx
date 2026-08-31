import { useCallback, useEffect, useRef, useState, type ComponentType } from "react";
import type { LearningSet } from "../../learning-sets/types.ts";
import type { ActiveGameSession, Player } from "../../multiplayer/types.ts";
import { toErrorMessage } from "../../shared/errors/errorMessage.ts";
import { POKEMON_ITEM, type PokemonItemId, type StoredCapturedPokemon } from "../../student-data/pokemon-catch/types.ts";
import { usePokemonCatchData } from "../../student-data/pokemon-catch/usePokemonCatchData.ts";
import { pokemonQuizKind } from "./adapter.ts";
import { captureChance, didCapture } from "./captureRules.ts";
import { CollectionDialog } from "./components/CollectionDialog.tsx";
import { CommandPanel } from "./components/CommandPanel.tsx";
import { EncounterStage } from "./components/EncounterStage.tsx";
import { ItemBagDialog } from "./components/ItemBagDialog.tsx";
import { QuizDialog } from "./components/QuizDialog.tsx";
import { ANGER_TIME_BONUS_MS, ENCOUNTER_TIME_MS, SLEEP_CAPTURE_MULTIPLIER, itemDefinition, rewardItem } from "./itemRules.ts";
import type { EncounterActionPhase, EncounterPhase } from "./types.ts";
import { useEncounterTimer } from "./useEncounterTimer.ts";
import { useWildPokemonEncounter } from "./useWildPokemonEncounter.ts";
import styles from "./PokemonCatch.module.css";

const wait = (milliseconds: number) => new Promise<void>((resolve) => globalThis.setTimeout(resolve, milliseconds));
const randomRoll = () => crypto.getRandomValues(new Uint32Array(1))[0]! / 4_294_967_296;
type ActivePanel = "quiz" | "items" | "collection" | null;

export type PokemonMatchingQuizComponent = ComponentType<{
  readonly roomId: string;
  readonly session: ActiveGameSession;
  readonly player: Player;
  readonly set: LearningSet;
  readonly disabled?: boolean;
  readonly embedded?: boolean;
  readonly onRoundComplete?: (completionId: string) => void;
}>;

export type PokemonSentenceQuizComponent = ComponentType<{
  readonly roomId: string;
  readonly session: ActiveGameSession;
  readonly player: Player;
  readonly set: unknown;
  readonly disabled?: boolean;
  readonly embedded?: boolean;
  readonly advanceRequestId?: number;
  readonly onQuestionComplete?: (completionId: string) => void;
  readonly onAdvanced?: () => void;
}>;

export default function StudentPokemonCatch({ roomId, session, player, set, MatchingQuiz, SentenceQuiz }: {
  readonly roomId: string;
  readonly session: ActiveGameSession;
  readonly player: Player;
  readonly set: LearningSet;
  readonly MatchingQuiz: PokemonMatchingQuizComponent;
  readonly SentenceQuiz: PokemonSentenceQuizComponent;
}) {
  const studentData = usePokemonCatchData({ uid: player.id, studentNumber: player.studentNumber });
  const quizKind = pokemonQuizKind(set);
  const [encounterIndex, setEncounterIndex] = useState(0);
  const { encounter, status: encounterStatus, loadError, reload } = useWildPokemonEncounter({
    roundId: session.roundId,
    playerId: player.id,
    encounterIndex,
  });
  const [actionPhase, setActionPhase] = useState<EncounterActionPhase>("ready");
  const [asleep, setAsleep] = useState(false);
  const [timeBonusMs, setTimeBonusMs] = useState(0);
  const [activePanel, setActivePanel] = useState<ActivePanel>(null);
  const [quizFeedback, setQuizFeedback] = useState("");
  const [reward, setReward] = useState<PokemonItemId | null>(null);
  const [actionMessage, setActionMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [advanceRequestId, setAdvanceRequestId] = useState(0);
  const [postAdvanceAction, setPostAdvanceAction] = useState<"continue" | "close" | null>(null);
  const [usingItem, setUsingItem] = useState(false);
  const mountedRef = useRef(true);
  const operationRef = useRef(0);
  const awardedCompletionIdsRef = useRef(new Set<string>());
  const pendingCompletionIdsRef = useRef(new Set<string>());

  const phase: EncounterPhase = encounterStatus === "ready" ? actionPhase : encounterStatus;
  const nextEncounter = useCallback(() => {
    operationRef.current += 1;
    setActionPhase("ready");
    setAsleep(false);
    setTimeBonusMs(0);
    setActionMessage("");
    setEncounterIndex((value) => value + 1);
  }, []);
  const expireEncounter = useCallback(() => {
    operationRef.current += 1;
    setActivePanel((panel) => panel === "items" ? null : panel);
    setActionPhase("escaped");
    setActionMessage("제한시간이 끝나 포켓몬이 도망갔어요.");
    void wait(950).then(() => { if (mountedRef.current) nextEncounter(); });
  }, [nextEncounter]);
  const timer = useEncounterTimer({
    encounterKey: encounterStatus === "ready" && encounter ? `${encounterIndex}:${encounter.id}` : null,
    running: encounterStatus === "ready" && !["caught", "escaped"].includes(actionPhase),
    onExpired: expireEncounter,
  });

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; operationRef.current += 1; };
  }, []);

  const throwBall = async (itemId: typeof POKEMON_ITEM.POKE_BALL | typeof POKEMON_ITEM.GREAT_BALL): Promise<void> => {
    if (!encounter || phase !== "ready" || usingItem) return;
    setUsingItem(true);
    setActionMessage("");
    const operation = ++operationRef.current;
    try {
      const consumed = await studentData.consumeItem(itemId);
      if (!consumed || operation !== operationRef.current) {
        if (!consumed) setActionMessage("사용할 공이 없습니다.");
        return;
      }
      setActivePanel(null);
      setActionPhase("throwing");
      await wait(850);
      if (!mountedRef.current || operation !== operationRef.current) return;
      const ball = itemDefinition(itemId);
      const chance = captureChance(encounter.captureRate, {
        ballMultiplier: ball.ballMultiplier ?? 1,
        statusMultiplier: asleep ? SLEEP_CAPTURE_MULTIPLIER : 1,
      });
      if (!didCapture(chance, randomRoll())) {
        setActionPhase("failed");
        setActionMessage("포켓몬이 공에서 빠져나왔지만 아직 도망가지는 않았어요.");
        await wait(850);
        if (mountedRef.current && operation === operationRef.current) setActionPhase("ready");
        return;
      }

      setActionPhase("caught");
      const capture: StoredCapturedPokemon = {
        captureId: crypto.randomUUID(),
        speciesId: encounter.id,
        name: encounter.name,
        spriteUrl: encounter.spriteUrl,
        fallbackSpriteUrl: encounter.fallbackSpriteUrl,
        caughtAtMs: Date.now(),
      };
      await studentData.saveCapture(capture);
      if (!mountedRef.current || operation !== operationRef.current) return;
      setActionMessage(`${encounter.name}을(를) 잡아 계정의 포획함에 저장했어요!`);
      await wait(1_250);
      if (mountedRef.current && operation === operationRef.current) nextEncounter();
    } catch (error: unknown) {
      if (operation === operationRef.current) {
        setActionPhase("ready");
        setActionMessage(toErrorMessage(error, "아이템 사용 결과를 저장하지 못했습니다."));
      }
    } finally {
      if (mountedRef.current) setUsingItem(false);
    }
  };

  const useEffectItem = async (itemId: typeof POKEMON_ITEM.SLEEP_SPRAY | typeof POKEMON_ITEM.ANGER): Promise<void> => {
    if (!encounter || phase !== "ready" || usingItem || (itemId === POKEMON_ITEM.SLEEP_SPRAY && asleep)) return;
    setUsingItem(true);
    setActionMessage("");
    try {
      const consumed = await studentData.consumeItem(itemId);
      if (!consumed) {
        setActionMessage("사용할 아이템이 없습니다.");
        return;
      }
      if (itemId === POKEMON_ITEM.SLEEP_SPRAY) {
        setAsleep(true);
        setActionMessage("포켓몬이 잠들어 이번 조우의 포획률이 2배가 됐어요.");
      } else if (timer.extend(ANGER_TIME_BONUS_MS)) {
        setTimeBonusMs((value) => value + ANGER_TIME_BONUS_MS);
        setActionMessage("제한시간이 15초 늘어났어요.");
      }
      setActivePanel(null);
    } catch (error: unknown) {
      setActionMessage(toErrorMessage(error, "아이템을 사용하지 못했습니다."));
    } finally {
      if (mountedRef.current) setUsingItem(false);
    }
  };

  const useItem = (itemId: PokemonItemId): void => {
    if (itemId === POKEMON_ITEM.POKE_BALL || itemId === POKEMON_ITEM.GREAT_BALL) void throwBall(itemId);
    else void useEffectItem(itemId);
  };

  const awardQuizCompletion = useCallback(async (completionId: string): Promise<void> => {
    if (awardedCompletionIdsRef.current.has(completionId) || pendingCompletionIdsRef.current.has(completionId)) return;
    pendingCompletionIdsRef.current.add(completionId);
    setSubmitting(true);
    setQuizFeedback("");
    try {
      const itemId = await studentData.addItem(rewardItem(randomRoll()), completionId);
      awardedCompletionIdsRef.current.add(completionId);
      if (!mountedRef.current) return;
      setReward(itemId);
      setQuizFeedback(`완료! ${itemDefinition(itemId).name}을(를) 얻어 가방에 저장했어요.`);
    } catch (error: unknown) {
      setQuizFeedback(toErrorMessage(error, "아이템 보상 저장에 실패했습니다. 창을 닫았다가 다시 열어 주세요."));
    } finally {
      pendingCompletionIdsRef.current.delete(completionId);
      if (mountedRef.current) setSubmitting(false);
    }
  }, [studentData.addItem]);

  const continueQuiz = (): void => {
    setReward(null);
    setQuizFeedback("");
    if (quizKind === "sentence-builder") {
      setPostAdvanceAction("continue");
      setAdvanceRequestId((value) => value + 1);
    }
  };

  const stopQuiz = (): void => {
    if (quizKind === "sentence-builder" && reward) {
      setReward(null);
      setQuizFeedback("");
      setPostAdvanceAction("close");
      setAdvanceRequestId((value) => value + 1);
      return;
    }
    setActivePanel(null);
    setReward(null);
    setQuizFeedback("");
  };

  const finishSentenceAdvance = (): void => {
    if (postAdvanceAction === "close") setActivePanel(null);
    setPostAdvanceAction(null);
  };

  if (studentData.loading) return <div className={styles.loadingPage}>게임 기록과 아이템을 연결하고 있습니다…</div>;
  if (studentData.error) return <div className={styles.loadingPage}>{studentData.error.message}</div>;
  const timerMaximum = ENCOUNTER_TIME_MS + timeBonusMs;
  const secondsRemaining = Math.ceil(timer.remainingMs / 1_000);

  return <div className={styles.gameShell}>
    <EncounterStage encounter={encounter} encounterStatus={encounterStatus} phase={phase} asleep={asleep} secondsRemaining={secondsRemaining} timerMaximum={timerMaximum} remainingMs={timer.remainingMs} loadError={loadError} onReload={reload} />
    <CommandPanel actionMessage={actionMessage} hasQuestion={set.items.length > 0} submitting={submitting} phase={phase} usingItem={usingItem} captureCount={studentData.captures.length} onOpenQuiz={() => { setActivePanel("quiz"); setQuizFeedback(""); setReward(null); }} onOpenItems={() => setActivePanel("items")} onOpenCollection={() => setActivePanel("collection")} />
    {activePanel === "items" ? <ItemBagDialog inventory={studentData.inventory} usingItem={usingItem} phase={phase} asleep={asleep} onClose={() => setActivePanel(null)} onUseItem={useItem} /> : null}
    {activePanel === "quiz" ? <QuizDialog
      title={quizKind === "matching-all" ? "8장 짝맞추기" : "문장 만들기"}
      description={quizKind === "matching-all" ? "4쌍을 모두 찾으면 아이템 하나를 얻습니다." : "문장을 올바르게 완성하면 아이템 하나를 얻습니다."}
      reward={reward}
      feedback={quizFeedback}
      submitting={submitting}
      onClose={stopQuiz}
      onMore={continueQuiz}
      onStop={stopQuiz}
    >
      {quizKind === "matching-all"
        ? <MatchingQuiz roomId={roomId} session={session} player={player} set={set} embedded disabled={submitting || Boolean(reward)} onRoundComplete={(completionId) => void awardQuizCompletion(completionId)} />
        : <SentenceQuiz roomId={roomId} session={session} player={player} set={set} embedded disabled={submitting || Boolean(reward)} advanceRequestId={advanceRequestId} onQuestionComplete={(completionId) => void awardQuizCompletion(completionId)} onAdvanced={finishSentenceAdvance} />}
    </QuizDialog> : null}
    {activePanel === "collection" ? <CollectionDialog captures={studentData.captures} onClose={() => setActivePanel(null)} /> : null}
  </div>;
}
