# Shared Game Engine

## 목적

게임마다 다시 만들 필요가 없는 **문제 진행, 정답 결과, 점수, 진행 복구, 응답 저장**을 공통화합니다. 각 게임은 자기 문제 타입/답 타입/판정 방식/UI만 소유합니다.

## TypeScript generic 구조

`game-engine/core`는 여러 엔진이 실제로 공유할 최소 계약만 둡니다. 현재는 `AnswerResult<TDetails>`와 순수 유틸이 여기에 있습니다. `game-engine/progress`는 question/pair 같은 도메인 명칭을 쓰지 않는 item 단위 진행 상태만 소유합니다.

`game-engine/question-engine`은 다음 계약을 소유합니다.

```text
BaseQuestion
CanonicalQuestionSet<TQuestion>
GameProgress<TDetails> (`completedItemIds`, `lastResult.itemId`)
Evaluator<TQuestion, TAnswer, TDetails>
AnswerSubmission<TQuestion, TAnswer, TDetails>
useQuestionEngine<TQuestion, TAnswer, TDetails>()
```

이 계층은 **문제 → 답 → 판정 → 다음 문제** 패턴에만 사용합니다.

## 역할별 게임 entry

학생 앱과 교사 앱의 번들을 분리하기 위해 모든 게임은 두 개의 lazy entry를 가집니다.

```text
MyStudentGame.tsx  → 학생 플레이 UI
MyTeacherGame.tsx  → 교사 모니터링/제어 UI
```

Registry는 다음 계약을 사용합니다.

```ts
loadStudent: () => import("./my-game/MyStudentGame.tsx")
loadTeacher: () => import("./my-game/MyTeacherGame.tsx")
```

학생/교사 entry 사이에서 실제 evaluator, adapter, types, 공통 hook은 같은 게임 폴더의 모듈을 공유할 수 있습니다.

## Sentence Builder 예

```text
SentenceQuestion
SentenceAnswer
SentenceEvaluationDetails
        ↓
evaluateSentenceSequence()
        ↓
AnswerResult<SentenceEvaluationDetails>
        ↓
useQuestionEngine
```

문장 조각은 표시 문자열이 아니라 고유 token ID로 판정하므로 같은 단어나 구가 반복되어도 안전합니다.

## Multiple-choice 전문 엔진

`question-engine/multiple-choice`는 question-engine 위에 구축한 순수 객관식 전문 모듈입니다.

```text
MultipleChoicePair<TSource>
        ↓ direction + choiceCount(2~5) + seed
buildMultipleChoiceSet()
        ↓
MultipleChoiceQuestion<TSource>
        ↓ selected option ID
evaluateMultipleChoice()
```

엔진은 left/right 문구만 알고 영어·한글·단어·Firestore를 알지 않습니다. 같은 prompt에 서로 다른 정답이 있는 항목은 제외하고, 정답 문구가 중복된 오답은 한 번만 사용하며, 필요한 수의 서로 다른 선택지를 만들 수 없는 문제는 생성하지 않습니다. seed가 같으면 문제와 선택지 순서도 같습니다.

학습 세트 변환은 `src/learning-sets/multipleChoiceAdapter.ts`가 담당합니다.

- 단어 전체: 단어 → 뜻 또는 뜻 → 단어
- 끊어읽기 전체: `/`를 제거한 문장 → 전체 뜻 또는 반대 방향
- 끊어읽기 덩어리: 영어 덩어리 → 대응 뜻 덩어리 또는 반대 방향

Firestore `gameConfig`처럼 신뢰할 수 없는 설정은 `parseLearningSetMultipleChoiceOptions()`로 먼저 검증합니다. 각 라운드의 `roundId`를 seed로 넘기면 같은 라운드의 모든 학생에게 같은 문제·선택지 순서를 재현할 수 있습니다. 생성된 question set과 `evaluateMultipleChoice()`는 기존 `useQuestionEngine()`에 그대로 전달할 수 있습니다.

## Adapter boundary

`readingChunksAdapter.ts`가 `unknown` 원본 세트를 Sentence Builder의 canonical question set으로 바꿉니다. UI와 evaluator는 Jurye 원본 DB 필드명을 알 필요가 없습니다.

## Question-engine multiplayer boundary

`multiplayer/game-progress`가 여러 게임에 공통인 진행 구독과 시도/진행 저장을 소유합니다. 기존 Firestore schema 호환을 위해 저장할 때만 `itemId`를 `questionId`, `completedItemIds`를 `completedQuestionIds`로 변환합니다. pure `game-engine`은 Firebase를 알지 않습니다.

`question-engine/multiplayer/useMultiplayerQuestionEngine.ts`는 세 question-style consumer가 반복하던 구독, 두 persistence callback, `useQuestionEngine` 연결만 담당합니다. evaluator, adapter, scoring, config와 UI는 각 게임이 계속 소유합니다.

pair-matching은 `game-engine/pair-matching`의 pair/card/짝 판정만 공유합니다. 학습 세트 변환은 `learning-sets/pairMatchingAdapter.ts`, 보드 생성과 라운드 규칙은 각 concrete game이 소유합니다.

Firestore에서 읽은 진행 데이터는 즉시 앱 타입이라고 단언하지 않습니다. `unknown`으로 구독한 뒤 안전하게 파싱합니다. 교사용 응답/진행 목록도 repository에서 runtime parsing한 뒤 반환합니다.

## 새 게임 추가

```text
src/games/new-game/
  types.ts
  adapter.ts
  evaluator.ts
  useNewGame.ts
  NewStudentGame.tsx
  NewTeacherGame.tsx
  StudentNewGame.tsx
  TeacherNewGame.tsx
  NewGame.module.css
```

새 게임이 Firebase를 직접 호출하거나 공통 진행 계산을 복사하지 않도록 합니다.


## Test rule

게임의 evaluator/adapter는 순수 함수로 유지하고 `tests/games/<game-id>.test.ts`에서 정상/오답/경계 데이터 사례를 검증합니다. UI 테스트보다 이 계약 테스트를 우선합니다.
