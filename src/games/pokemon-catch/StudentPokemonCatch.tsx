import { useCallback, useEffect, useRef, useState } from "react";
import type { LearningSet } from "../../learning-sets/types.ts";
import type { ActiveGameSession, Player } from "../../multiplayer/types.ts";
import { toErrorMessage } from "../../shared/errors/errorMessage.ts";
import { POKEMON_ITEM, type PokemonItemId, type StoredCapturedPokemon } from "../../student-data/pokemon-catch/types.ts";
import { usePokemonCatchData } from "../../student-data/pokemon-catch/usePokemonCatchData.ts";
import { captureChance, didCapture } from "./captureRules.ts";
import { CollectionDialog } from "./components/CollectionDialog.tsx";
import { CommandPanel } from "./components/CommandPanel.tsx";
import { EncounterStage } from "./components/EncounterStage.tsx";
import { ItemBagDialog } from "./components/ItemBagDialog.tsx";
import { QuizDialog } from "./components/QuizDialog.tsx";
import { ANGER_TIME_BONUS_MS, ENCOUNTER_TIME_MS, SLEEP_CAPTURE_MULTIPLIER, itemDefinition, rewardItem } from "./itemRules.ts";
import type { EncounterActionPhase, EncounterPhase } from "./types.ts";
import { useEncounterTimer } from "./useEncounterTimer.ts";
import { usePokemonQuiz } from "./usePokemonQuiz.ts";
import { useWildPokemonEncounter } from "./useWildPokemonEncounter.ts";
import styles from "./PokemonCatch.module.css";

const wait = (milliseconds: number) => new Promise<void>((resolve) => globalThis.setTimeout(resolve, milliseconds));
const randomRoll = () => crypto.getRandomValues(new Uint32Array(1))[0]! / 4_294_967_296;
type ActivePanel = "quiz" | "items" | "collection" | null;

export default function StudentPokemonCatch({ roomId, session, player, set }: {
  readonly roomId: string;
  readonly session: ActiveGameSession;
  readonly player: Player;
  readonly set: LearningSet;
}) {
  const quiz = usePokemonQuiz({ roomId, session, player, set });
  const studentData = usePokemonCatchData({ uid: player.id, studentNumber: player.studentNumber });
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
  const [usingItem, setUsingItem] = useState(false);
  const mountedRef = useRef(true);
  const operationRef = useRef(0);

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

  const answerQuiz = async (optionId: string): Promise<void> => {
    if (submitting) return;
    setSubmitting(true);
    try {
      const result = await quiz.submitAnswer({ optionId });
      if (result?.isCorrect) {
        const itemId = rewardItem(randomRoll());
        await studentData.addItem(itemId);
        setReward(itemId);
        setQuizFeedback(`정답! ${itemDefinition(itemId).name}을(를) 얻어 가방에 저장했어요.`);
      } else {
        setQuizFeedback("아쉬워요. 다른 답을 골라 보세요.");
      }
    } catch (error: unknown) {
      setQuizFeedback(toErrorMessage(error, "정답 또는 보상 저장에 실패했습니다."));
    } finally {
      setSubmitting(false);
    }
  };

  const finishQuestion = async (): Promise<void> => {
    setSubmitting(true);
    try {
      await quiz.nextQuestion();
      setActivePanel(null);
      setQuizFeedback("");
      setReward(null);
    } catch (error: unknown) {
      console.error(error);
      setQuizFeedback(toErrorMessage(error, "다음 문제로 이동하지 못했습니다. 다시 시도해 주세요."));
    } finally {
      setSubmitting(false);
    }
  };

  if (quiz.loading || studentData.loading) return <div className={styles.loadingPage}>게임 기록과 아이템을 연결하고 있습니다…</div>;
  if (quiz.error || studentData.error) return <div className={styles.loadingPage}>{quiz.error?.message ?? studentData.error?.message}</div>;
  const question = quiz.currentQuestion;
  const currentResult = question && quiz.progress.lastResult?.itemId === question.id ? quiz.progress.lastResult : null;
  const timerMaximum = ENCOUNTER_TIME_MS + timeBonusMs;
  const secondsRemaining = Math.ceil(timer.remainingMs / 1_000);

  return <div className={styles.gameShell}>
    <EncounterStage encounter={encounter} encounterStatus={encounterStatus} phase={phase} asleep={asleep} secondsRemaining={secondsRemaining} timerMaximum={timerMaximum} remainingMs={timer.remainingMs} loadError={loadError} onReload={reload} />
    <CommandPanel actionMessage={actionMessage} hasQuestion={Boolean(question)} submitting={submitting} phase={phase} usingItem={usingItem} captureCount={studentData.captures.length} onOpenQuiz={() => { setActivePanel("quiz"); setQuizFeedback(""); setReward(null); }} onOpenItems={() => setActivePanel("items")} onOpenCollection={() => setActivePanel("collection")} />
    {activePanel === "items" ? <ItemBagDialog inventory={studentData.inventory} usingItem={usingItem} phase={phase} asleep={asleep} onClose={() => setActivePanel(null)} onUseItem={useItem} /> : null}
    {activePanel === "quiz" && question ? <QuizDialog question={question} currentIndex={quiz.currentIndex} questionCount={quiz.questionCount} currentResult={currentResult} reward={reward} feedback={quizFeedback} submitting={submitting} onClose={() => setActivePanel(null)} onAnswer={(optionId) => void answerQuiz(optionId)} onContinue={() => void finishQuestion()} /> : null}
    {activePanel === "collection" ? <CollectionDialog captures={studentData.captures} onClose={() => setActivePanel(null)} /> : null}
  </div>;
}
