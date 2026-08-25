import { useCallback, useEffect, useRef, useState } from "react";
import type { LearningSet } from "../../learning-sets/types.ts";
import type { ActiveGameSession, Player } from "../../multiplayer/types.ts";
import { toErrorMessage } from "../../shared/errors/errorMessage.ts";
import { POKEMON_ITEM, type PokemonItemId, type StoredCapturedPokemon } from "../../student-data/pokemon-catch/types.ts";
import { usePokemonCatchData } from "../../student-data/pokemon-catch/usePokemonCatchData.ts";
import { captureChance, didCapture } from "./captureRules.ts";
import { ANGER_TIME_BONUS_MS, ENCOUNTER_TIME_MS, POKEMON_ITEMS, SLEEP_CAPTURE_MULTIPLIER, itemDefinition, rewardItem } from "./itemRules.ts";
import { PokemonSprite } from "./PokemonSprite.tsx";
import type { EncounterActionPhase, EncounterPhase } from "./types.ts";
import { useEncounterTimer } from "./useEncounterTimer.ts";
import { usePokemonQuiz } from "./usePokemonQuiz.ts";
import { useWildPokemonEncounter } from "./useWildPokemonEncounter.ts";
import styles from "./PokemonCatch.module.css";

const wait = (milliseconds: number) => new Promise<void>((resolve) => globalThis.setTimeout(resolve, milliseconds));
const randomRoll = () => crypto.getRandomValues(new Uint32Array(1))[0]! / 4_294_967_296;

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
  const [quizOpen, setQuizOpen] = useState(false);
  const [itemsOpen, setItemsOpen] = useState(false);
  const [collectionOpen, setCollectionOpen] = useState(false);
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
    setItemsOpen(false);
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
      setItemsOpen(false);
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
      setItemsOpen(false);
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
      setQuizOpen(false);
      setQuizFeedback("");
      setReward(null);
    } finally {
      setSubmitting(false);
    }
  };

  if (quiz.loading || studentData.loading) return <div className={styles.loadingPage}>게임 기록과 아이템을 연결하고 있습니다…</div>;
  if (quiz.error || studentData.error) return <div className={styles.loadingPage}>{quiz.error?.message ?? studentData.error?.message}</div>;
  const question = quiz.currentQuestion;
  const currentResult = question && quiz.progress.lastResult?.questionId === question.id ? quiz.progress.lastResult : null;
  const timerMaximum = ENCOUNTER_TIME_MS + timeBonusMs;
  const secondsRemaining = Math.ceil(timer.remainingMs / 1_000);

  return <div className={styles.gameShell}>
    <main className={styles.field} data-phase={phase}>
      <div className={styles.skyGlow} />
      <div className={styles.encounterCard}>
        <span>{encounter ? `No.${String(encounter.id).padStart(3, "0")}` : "SEARCHING"}</span>
        <strong>{encounter?.name ?? "야생 포켓몬 탐색 중"}</strong>
        {asleep ? <small>잠듦 · 포획률 2배</small> : null}
      </div>
      {encounterStatus === "ready" ? <div className={styles.timerPanel} data-warning={secondsRemaining <= 10}>
        <strong>{secondsRemaining}초</strong><progress max={timerMaximum} value={timer.remainingMs} />
      </div> : null}
      <div className={styles.pokemonStage}>
        {encounter ? <PokemonSprite className={styles.pokemon} pokemon={encounter} alt={encounter.name} /> : null}
        {phase === "loading" ? <div className={styles.scanner}>탐색 중</div> : null}
        {phase === "error" ? <div className={styles.apiError}><strong>연결 실패</strong><span>{loadError}</span><button type="button" onClick={reload}>다시 불러오기</button></div> : null}
        <div className={styles.shadow} /><div className={styles.ball} aria-hidden="true"><i /></div>
        {phase === "caught" ? <div className={styles.resultBurst}>GET!</div> : null}
        {phase === "failed" ? <div className={styles.failedText}>아깝다!</div> : null}
        {phase === "escaped" ? <div className={styles.escapeText}>시간 종료!</div> : null}
      </div>
      <div className={styles.grass}><i /><i /><i /><i /><i /><i /></div>
    </main>

    <section className={styles.commandPanel}>
      {actionMessage ? <div className={styles.actionMessage}>{actionMessage}</div> : null}
      <div className={styles.commands}>
        <button type="button" onClick={() => { setQuizOpen(true); setQuizFeedback(""); setReward(null); }} disabled={!question || submitting}>문제 풀기<small>무작위 아이템 얻기</small></button>
        <button type="button" className={styles.primaryCommand} onClick={() => setItemsOpen(true)} disabled={phase !== "ready" || usingItem}>아이템 사용하기<small>공 · 스프레이 · 시간 증가</small></button>
      </div>
      <button type="button" className={styles.collectionButton} onClick={() => setCollectionOpen(true)}>내 포획함 <b>{studentData.captures.length}</b></button>
    </section>

    {itemsOpen ? <div className={styles.modalBackdrop} role="dialog" aria-modal="true" aria-label="아이템 가방"><section className={styles.itemCard}>
      <button type="button" className={styles.closeButton} onClick={() => setItemsOpen(false)} aria-label="닫기">×</button>
      <span className={styles.quizStep}>ITEM BAG</span><h2>아이템 사용하기</h2>
      <div className={styles.itemGrid}>{POKEMON_ITEMS.map((item) => {
        const unavailable = studentData.inventory[item.id] < 1 || usingItem || phase !== "ready" || (item.id === POKEMON_ITEM.SLEEP_SPRAY && asleep);
        return <div key={item.id} data-item={item.id}>
          <div className={styles.itemIcon}>{item.kind === "ball" ? "◉" : item.id === POKEMON_ITEM.SLEEP_SPRAY ? "Zz" : "+15"}</div>
          <div><strong>{item.name}</strong><small>{item.description}</small></div><b>× {studentData.inventory[item.id]}</b>
          <button type="button" onClick={() => useItem(item.id)} disabled={unavailable}>{item.kind === "ball" ? "던지기" : "사용"}</button>
        </div>;
      })}</div>
    </section></div> : null}

    {quizOpen && question ? <div className={styles.modalBackdrop} role="dialog" aria-modal="true" aria-label="단어 퀴즈"><section className={styles.quizCard}>
      <button type="button" className={styles.closeButton} onClick={() => setQuizOpen(false)} aria-label="닫기">×</button>
      <span className={styles.quizStep}>WORD {quiz.currentIndex + 1} / {quiz.questionCount}</span>
      <p>정답을 맞히면 아이템 하나를 얻습니다.</p><h2>{question.prompt}</h2>
      <div className={styles.options}>{question.options.map((option, index) => <button type="button" key={option.id} onClick={() => void answerQuiz(option.id)} disabled={submitting || Boolean(currentResult?.isCorrect)} data-state={currentResult ? (option.id === question.correctOptionId ? "correct" : currentResult.details?.selectedOptionId === option.id ? "wrong" : "") : ""}><span>{index + 1}</span>{option.text}</button>)}</div>
      {reward ? <div className={styles.rewardCard}><strong>{itemDefinition(reward).name}</strong><span>가방에 저장되었습니다.</span></div> : null}
      {quizFeedback ? <div className={styles.quizFeedback} data-correct={Boolean(currentResult?.isCorrect)}>{quizFeedback}</div> : null}
      {currentResult?.isCorrect ? <button type="button" className={styles.continueButton} onClick={() => void finishQuestion()} disabled={submitting}>{quiz.currentIndex + 1 >= quiz.questionCount ? "문제 완료" : "계속 탐험하기"}</button> : null}
    </section></div> : null}

    {collectionOpen ? <div className={styles.modalBackdrop} role="dialog" aria-modal="true" aria-label="내 포획함"><section className={styles.collectionCard}>
      <button type="button" className={styles.closeButton} onClick={() => setCollectionOpen(false)} aria-label="닫기">×</button><span className={styles.quizStep}>MY COLLECTION</span><h2>내 포획함</h2>
      {studentData.captures.length === 0 ? <p className={styles.emptyCollection}>아직 잡은 포켓몬이 없어요.</p> : <div className={styles.collectionGrid}>{studentData.captures.map((pokemon) => <div key={pokemon.captureId}><PokemonSprite pokemon={pokemon} alt="" /><strong>{pokemon.name}</strong><small>No.{String(pokemon.speciesId).padStart(3, "0")}</small></div>)}</div>}
    </section></div> : null}
  </div>;
}
