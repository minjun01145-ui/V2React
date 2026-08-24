import { useCallback, useEffect, useRef, useState } from "react";
import type { LearningSet } from "../../learning-sets/types.ts";
import type { ActiveGameSession, Player } from "../../multiplayer/types.ts";
import { toErrorMessage } from "../../shared/errors/errorMessage.ts";
import { captureChance, captureScore, didCapture, encounterId } from "./captureRules.ts";
import { fetchPokemonEncounter } from "./pokeApi.ts";
import type { CapturedPokemon, EncounterPhase, PokemonEncounter } from "./types.ts";
import { usePokemonQuiz } from "./usePokemonQuiz.ts";
import styles from "./PokemonCatch.module.css";

const wait = (milliseconds: number) => new Promise<void>((resolve) => globalThis.setTimeout(resolve, milliseconds));

export default function StudentPokemonCatch({ roomId, session, player, set }: {
  readonly roomId: string;
  readonly session: ActiveGameSession;
  readonly player: Player;
  readonly set: LearningSet;
}) {
  const quiz = usePokemonQuiz({ roomId, session, player, set });
  const [encounterIndex, setEncounterIndex] = useState(0);
  const [retryIndex, setRetryIndex] = useState(0);
  const [encounter, setEncounter] = useState<PokemonEncounter | null>(null);
  const [phase, setPhase] = useState<EncounterPhase>("loading");
  const [loadError, setLoadError] = useState("");
  const [balls, setBalls] = useState(1);
  const [captured, setCaptured] = useState<CapturedPokemon[]>([]);
  const [quizOpen, setQuizOpen] = useState(false);
  const [quizFeedback, setQuizFeedback] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [collectionOpen, setCollectionOpen] = useState(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    setPhase("loading");
    setLoadError("");
    const id = encounterId(`${session.roundId}:${player.id}:${encounterIndex}`);
    void fetchPokemonEncounter(id, controller.signal).then((next) => {
      setEncounter(next);
      setPhase("ready");
      if (next.cryUrl) void new Audio(next.cryUrl).play().catch(() => undefined);
    }).catch((error: unknown) => {
      if (controller.signal.aborted) return;
      setLoadError(toErrorMessage(error, "포켓몬을 불러오지 못했습니다."));
      setPhase("error");
    });
    return () => controller.abort();
  }, [encounterIndex, player.id, retryIndex, session.roundId]);

  const nextEncounter = useCallback(() => setEncounterIndex((value) => value + 1), []);
  const throwBall = async (): Promise<void> => {
    if (!encounter || phase !== "ready" || balls < 1) return;
    setBalls((value) => value - 1);
    setPhase("throwing");
    await wait(850);
    if (!mountedRef.current) return;
    const caught = didCapture(captureChance(encounter.captureRate), crypto.getRandomValues(new Uint32Array(1))[0]! / 4294967296);
    if (caught) {
      const score = captureScore(encounter.baseExperience, encounter.captureRate);
      setCaptured((values) => [...values, { ...encounter, captureId: crypto.randomUUID(), caughtAtMs: Date.now(), score }]);
      setPhase("caught");
      await wait(1250);
    } else {
      setPhase("escaped");
      await wait(950);
    }
    if (mountedRef.current) nextEncounter();
  };
  const runAway = async (): Promise<void> => {
    if (phase !== "ready") return;
    setPhase("escaped");
    await wait(420);
    if (mountedRef.current) nextEncounter();
  };
  const answerQuiz = async (optionId: string): Promise<void> => {
    if (submitting) return;
    setSubmitting(true);
    try {
      const result = await quiz.submitAnswer({ optionId });
      if (result?.isCorrect) {
        setBalls((value) => value + 1);
        setQuizFeedback("정답! 몬스터볼을 1개 얻었어요.");
      } else {
        setQuizFeedback("아쉬워요. 다른 답을 골라 보세요.");
      }
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
    } finally {
      setSubmitting(false);
    }
  };

  if (quiz.loading) return <div className={styles.loadingPage}>게임 기록을 연결하고 있습니다…</div>;
  if (quiz.error) return <div className={styles.loadingPage}>{quiz.error.message}</div>;
  const question = quiz.currentQuestion;
  const currentResult = question && quiz.progress.lastResult?.questionId === question.id ? quiz.progress.lastResult : null;
  const totalCaptureScore = captured.reduce((sum, pokemon) => sum + pokemon.score, 0);
  return <div className={styles.gameShell}>
    <header className={styles.hud}>
      <div><span>잡은 포켓몬</span><strong>{captured.length}</strong></div>
      <div className={styles.logo}><small>FIRERED WORD</small><strong>POCKET CATCH</strong></div>
      <div><span>포획 점수</span><strong>{totalCaptureScore}</strong></div>
    </header>

    <main className={styles.field} data-phase={phase}>
      <div className={styles.skyGlow} />
      <div className={styles.encounterCard}>
        <span>{encounter ? `No.${String(encounter.id).padStart(3, "0")}` : "SEARCHING"}</span>
        <strong>{encounter?.name ?? "야생 포켓몬 탐색 중"}</strong>
      </div>
      <div className={styles.pokemonStage}>
        {encounter ? <img className={styles.pokemon} src={encounter.spriteUrl} alt={encounter.name} /> : null}
        {phase === "loading" ? <div className={styles.scanner}>탐색 중</div> : null}
        {phase === "error" ? <div className={styles.apiError}><strong>연결 실패</strong><span>{loadError}</span><button type="button" onClick={() => setRetryIndex((value) => value + 1)}>다시 불러오기</button></div> : null}
        <div className={styles.shadow} />
        <div className={styles.ball} aria-hidden="true"><i /></div>
        {phase === "caught" ? <div className={styles.resultBurst}>GET!</div> : null}
        {phase === "escaped" ? <div className={styles.escapeText}>놓쳤다!</div> : null}
      </div>
      <div className={styles.grass}><i /><i /><i /><i /><i /><i /></div>
    </main>

    <section className={styles.commandPanel}>
      <div className={styles.ballCount}><span className={styles.miniBall}><i /></span><strong>× {balls}</strong></div>
      <div className={styles.commands}>
        <button type="button" onClick={() => { setQuizOpen(true); setQuizFeedback(""); }} disabled={!question || submitting}>단어 풀기<small>몬스터볼 +1</small></button>
        <button type="button" className={styles.primaryCommand} onClick={() => void throwBall()} disabled={phase !== "ready" || balls < 1}>던지기<small>{balls < 1 ? "공이 필요해요" : "포획 도전"}</small></button>
        <button type="button" onClick={() => void runAway()} disabled={phase !== "ready"}>다음 포켓몬<small>도망가기</small></button>
      </div>
      <button type="button" className={styles.collectionButton} onClick={() => setCollectionOpen(true)}>내 포획함 <b>{captured.length}</b></button>
    </section>

    {quizOpen && question ? <div className={styles.modalBackdrop} role="dialog" aria-modal="true" aria-label="단어 퀴즈">
      <section className={styles.quizCard}>
        <button type="button" className={styles.closeButton} onClick={() => setQuizOpen(false)} aria-label="닫기">×</button>
        <span className={styles.quizStep}>WORD {quiz.currentIndex + 1} / {quiz.questionCount}</span>
        <p>다음 단어의 뜻을 고르세요.</p><h2>{question.prompt}</h2>
        <div className={styles.options}>{question.options.map((option, index) => <button type="button" key={option.id} onClick={() => void answerQuiz(option.id)} disabled={submitting || Boolean(currentResult?.isCorrect)} data-state={currentResult ? (option.id === question.correctOptionId ? "correct" : currentResult.details?.selectedOptionId === option.id ? "wrong" : "") : ""}><span>{index + 1}</span>{option.text}</button>)}</div>
        {quizFeedback ? <div className={styles.quizFeedback} data-correct={Boolean(currentResult?.isCorrect)}>{quizFeedback}</div> : null}
        {currentResult?.isCorrect ? <button type="button" className={styles.continueButton} onClick={() => void finishQuestion()} disabled={submitting}>{quiz.currentIndex + 1 >= quiz.questionCount ? "문제 완료" : "계속 탐험하기"}</button> : null}
      </section>
    </div> : null}

    {collectionOpen ? <div className={styles.modalBackdrop} role="dialog" aria-modal="true" aria-label="내 포획함"><section className={styles.collectionCard}>
      <button type="button" className={styles.closeButton} onClick={() => setCollectionOpen(false)} aria-label="닫기">×</button><span className={styles.quizStep}>MY COLLECTION</span><h2>내 포획함</h2>
      {captured.length === 0 ? <p className={styles.emptyCollection}>아직 잡은 포켓몬이 없어요.</p> : <div className={styles.collectionGrid}>{captured.map((pokemon) => <div key={pokemon.captureId}><img src={pokemon.spriteUrl} alt="" /><strong>{pokemon.name}</strong><small>+{pokemon.score}점</small></div>)}</div>}
    </section></div> : null}
  </div>;
}
