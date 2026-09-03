# Jurye TypeScript architecture

게임과 관리자 기능을 추가할수록 코드가 다시 섞이지 않도록 의존 방향과 앱 경계를 고정합니다.

## Two application entries

```text
index.html                     teacher/index.html
    ↓                                ↓
src/apps/student/main.tsx      src/apps/teacher/main.tsx
    ↓                                ↓
features/student               features/teacher
          \                      /
           \                    /
             auth / shared
                  │
        multiplayer / firebase
                  │
             game-engine
                  ↑
                games
```

학생과 교사는 **HTML/React entry가 다르지만 공통 domain 코드는 공유**합니다.

## Hard rules

1. 애플리케이션 코드는 `.ts/.tsx`만 사용합니다.
2. 학생 app/feature와 교사 app/feature는 서로 import하지 않습니다.
3. global CSS import는 `src/apps/student/main.tsx`, `src/apps/teacher/main.tsx` 두 entry에서만 허용합니다.
4. `game-engine/core`, `game-engine/progress`, `game-engine/pair-matching`과 `game-engine/question-engine`의 순수 모듈은 React/Firebase/구체 게임에 의존하지 않습니다. `useQuestionEngine.ts`와 multiplayer integration hook만 React를 사용합니다.
5. `games/<game-id>`는 Firebase SDK나 app/feature UI를 직접 import하지 않습니다.
6. `multiplayer`는 구체 게임을 import하지 않습니다.
7. 게임 UI 스타일은 해당 게임의 `.module.css`가 소유합니다.
8. 모든 게임은 typed `defineGame()`으로 등록합니다.
9. 각 게임은 `loadStudent()`와 `loadTeacher()`를 별도로 제공해 역할별 code splitting을 유지합니다.
10. evaluator는 `game-engine/core`의 `AnswerResult<TDetails>` 계약을 반환합니다.
11. adapter는 원본 세트를 `question-engine`의 typed canonical question으로 변환합니다. UI는 원본 저장 필드명을 파싱하지 않습니다.
12. 외부 데이터(Firestore/localStorage/raw set)는 먼저 `unknown`으로 취급하고 runtime validation 후 앱 타입으로 변환합니다.
13. explicit `any`를 사용하지 않습니다. 정말 알 수 없는 값은 `unknown`을 사용합니다.
14. 학생/교사 인증 전에는 multiplayer/teacher 데이터 구독을 시작하지 않습니다.
15. 관리자 비밀번호/서비스계정 키 같은 비밀은 browser bundle, `VITE_` 변수, GitHub에 넣지 않습니다.
16. 학생의 학번/이름/PIN 검증과 roster 관리는 Cloud Function에서만 수행하고 roster 전체와 PIN 해시를 브라우저에 공개하지 않습니다.
17. `auth`는 신원/권한만 소유합니다. 뱃지, 인벤토리, 통계, 장기 진행도는 `StudentIdentity`에 추가하지 않습니다.
18. `shared/ui`는 domain-neutral primitive만 소유하며 game/feature/auth/multiplayer를 import하지 않습니다.
19. evaluator/adapter가 있는 게임은 같은 게임의 자동 테스트를 반드시 가집니다.
20. AI 공급자 HTTP/인증 구현은 `functions/src/ai`에만 두고, 게임은 게임별 서버 계약을 통해 공통 AI 서비스를 호출합니다.
21. `ai-admin`은 app/feature/game UI를 import하지 않으며, 관리자 UI만 `ai-admin`을 사용합니다.
22. 상대 import 그래프의 순환 의존성은 자동 검사에서 실패합니다.
23. `learning-sets` 도메인은 app/feature/game/multiplayer를 import하지 않으며, 게임과 교사 UI가 이 도메인의 읽기·관리 인터페이스를 사용합니다.
24. 세트 목록 메타데이터와 실제 문항 문서를 분리하고, 게임 세션에는 문항 배열 대신 `setId`만 저장합니다.
25. 객관식 엔진은 left/right 쌍만 처리하며, 단어·끊어읽기 해석은 `learning-sets` adapter가 담당합니다. 엔진에서 세트 도메인을 import하지 않습니다.
26. `shared/popup`은 도메인을 import하지 않으며, 각 앱의 단일 Provider가 큐·portal·접근성을 소유합니다. 기능 코드는 `usePopup()` 계약만 사용합니다.
27. `classroom-test`는 iframe 메시지 계약과 학생 화면 선택 같은 순수 로직만 소유합니다. 관리자 Callable transport는 `classroom-test-admin`, 임시 사용자·방 발급은 Functions의 `multiplayer-test`가 소유합니다.
28. 테스트 학생은 별도 HTML entry와 메모리 인증을 사용하지만 기존 `features/student`, `multiplayer`, `games`를 그대로 실행합니다. 교사 테스트 UI는 실제 방 제어를 `features/teacher/room-control`을 통해서만 사용합니다.
29. 학생의 장기 인벤토리와 수집 기록은 인증 신원이나 라운드 진행도에 섞지 않고 `student-data` 도메인에서 소유합니다. 게임은 이 도메인의 typed hook만 사용하며 Firebase SDK를 직접 import하지 않습니다.
30. `games/<game-id>`는 다른 `games/<other-game-id>`를 직접 import하지 않습니다. 실제로 공유되는 순수 게임 개념은 `game-engine`, 학습 세트 변환은 `learning-sets`, 전송·저장은 `multiplayer`가 소유합니다.
31. 브라우저 lifecycle은 room membership 삭제 명령이 아닙니다. 새로고침·탭 종료·background·일시적 단절은 heartbeat만 stale하게 만들며, 명시적 학생 변경/로그아웃/나가기 또는 관리자 작업만 membership을 삭제합니다.
32. 라운드 순위의 참가자 source는 `round participants`이며 presence roster가 아닙니다. participant는 게임별 진행 상태를 갖지 않고, 점수와 완료 항목은 계속 `multiplayer/game-progress`가 소유합니다.
33. 캐릭터 정적 카탈로그는 `characters`, 학생별 캐릭터·포켓몬 장착 상태는 `student-data/cosmetics`, 대기실 표시와 선택 UI는 `features/student/shop`이 각각 소유합니다. 구매·재화 책임은 해당 기능을 실제로 만들기 전까지 이 모듈들에 추가하지 않습니다.
34. `quiz-game`은 기존 게임을 순서대로 실행하는 계획과 상태만 소유합니다. 문제 생성·채점·학생 진행도는 선택된 `games/<game-id>`와 기존 engine/progress 계층을 그대로 사용합니다.

## Quiz game orchestration

```text
features/teacher/quiz-game editor → quiz-game plan repository
                                      ↓ plan snapshot
features/teacher/room-control → multiplayer session.quizGame
                                      ↓ current gameId/config
                          games registry + GameHost
                             ↙                    ↘
             teacher quiz runtime          student quiz runtime
             submissions/ranking           answer/wait screens
```

퀴즈 계획은 라운드별 `gameId`, `setId`, 제한 시간, registry가 제공한 엔진 설정값만 저장합니다. 실행 시 계획을 방 세션에 스냅샷으로 고정해 편집 중인 원본과 진행 중 수업이 섞이지 않게 합니다. 답안 단계에서는 기존 게임 UI와 progress 저장을 그대로 사용하고, 마감 이후에는 세션 phase로 학생 입력을 내리며 보안 규칙도 progress 쓰기를 차단합니다. 라운드 간 점수 집계는 각 runtime round의 기존 progress 문서를 읽어 누적합니다.

## Persistent student game data

```text
games/pokemon-catch UI
          ↓ typed hook
student-data/pokemon-catch
          ↓
Firestore studentGameData/{studentNumber}/games/pokemon-catch
          └─ captured/{captureId}
```

인벤토리는 실제 계정의 안정적인 학번 키를 사용하는 학생별 게임 문서에 저장하고 포획 기록은 문서 크기 증가를 막기 위해 하위 컬렉션으로 분리합니다. 보안 규칙은 인증 토큰의 학번이 일치하는 본인 또는 관리자만 읽도록 하고, 인벤토리 필드와 포획 문서 형식을 검증합니다. 테스트 학생은 `test-{uid}` 격리 키를 사용하며 임시 게임 데이터는 테스트 사용자를 삭제하기 전에 서버에서 함께 정리합니다.

캐릭터 또는 포켓몬 장착 정보는 같은 학생 계정 키 아래의 `studentGameData/{studentNumber}/cosmetics/profile`에 저장합니다. 현재 대기실의 다른 참가자에게 보이도록 검증된 표시용 스냅샷도 본인 `multiplayerSessions/{roomId}/players/{uid}` 문서에 동기화합니다. 테스트 학생은 다른 장기 데이터와 동일하게 `test-{uid}` 키로 격리합니다. 구매와 재화 데이터는 아직 저장하지 않습니다.

캐릭터 원본은 `src/assets/characters/<캐릭터 이름>(<만든이>)` 폴더에 애니메이션 전체를 보존합니다. 독립 `characters/catalog.ts`가 각 폴더의 `stand1_0.png`부터 `stand1_3.png`까지를 빌드 시 자동 발견하며, 다른 동작과 표정 파일은 이후 게임에서 같은 원본을 사용합니다.

`npm run check`가 타입 검사 + architecture/security 검사 + 엔진/라우팅/auth smoke test를 수행합니다.

## Teacher app structure

```text
src/apps/teacher/
  main.tsx
  TeacherApp.tsx
  TeacherNav.tsx
  teacherRoute.ts

src/features/teacher/
  ai/
  auth/
  dashboard/
  lobby/
  sets/
  settings/
```

새 관리자 기능은 `features/teacher/<feature>/`로 추가합니다. `TeacherApp`은 메뉴와 페이지 조립만 담당하고 실제 Firebase 작업/도메인 로직을 직접 구현하지 않습니다.

## Real multiplayer classroom test tool

```text
features/teacher/test-tool → classroom-test-admin → admin Callable
             │                                       ↓
             ├→ teacher/room-control → multiplayer test room
             │
             └→ three sandboxed iframes
                         ↓ postMessage bootstrap
              apps/test-student → features/student → games/multiplayer
```

관리자 전용 Callable이 테스트 방과 세 개의 일회성 참가 비밀을 발급합니다. 각 iframe은 고유 Firebase app 이름과 `inMemoryPersistence`로 익명 인증한 뒤, 서버가 참가 비밀의 해시와 슬롯을 검증하고 해당 익명 사용자에게 테스트 전용 claims를 설정합니다. 참가 비밀은 URL이나 영속 저장소에 넣지 않고 같은 출처의 `postMessage`로만 전달하며 서버에는 SHA-256 해시만 저장합니다. 보안 규칙은 claims의 `testRoomId`와 테스트 방의 `testOwnerUid`를 함께 확인하며, 일반 학생 roster 인증과 분리합니다.

테스트 툴을 끄거나 페이지를 떠나면 종료 Callable이 방의 하위 컬렉션과 임시 사용자를 정리합니다. 비정상 종료로 남은 실행은 같은 관리자가 다음 테스트를 시작할 때 먼저 정리됩니다.

## AI provider structure

```text
features/teacher/ai
        ↓
src/ai-admin                 # 관리자용 typed callable client
        ↓
functions/src/ai/callables   # 인증과 transport 경계
        ↓
functions/src/ai/service     # 공급자와 게임이 공유하는 orchestration
       ↙             ↘
configRepository      ollamaProvider
       ↓                    ↓
Firestore             Ollama Cloud API
                secretStore → Secret Manager
```

`ollamaProvider`, `configRepository`, `secretStore`는 callable이나 React를 알지 않습니다. 이후 게임별 AI 함수는 `service.generateAiReply()`만 사용하고 관리자 테스트 UI를 import하지 않습니다.

## Learning set structure

```text
features/teacher/sets
          ↓
src/learning-sets/adminRepository
          ↓
Firestore metadata + content
          ↑
src/learning-sets/readRepository
          ↑
games/<game>/adapter
```

학생 앱은 세트 편집 UI를 포함하지 않습니다. 게임 lazy chunk가 시작될 때 선택된 `setId`의 content만 읽고 게임별 adapter가 canonical question으로 변환합니다.

## Student app structure

```text
src/apps/student/
  main.tsx
  StudentApp.tsx

src/features/student/
  login/
  session/
    useStudentSession.ts
    studentSessionState.ts
    StudentStatusScreen.tsx
  StudentPage.tsx
  WaitingRoom.tsx
```

학생 앱은 관리자 기능을 알지 않습니다. `StudentPage`는 세션 상태에 맞는 화면만 조립하며, 자동 입장·하트비트·퇴장 생명주기는 `useStudentSession`, 화면 상태 우선순위는 순수 함수인 `studentSessionState`가 담당합니다.

## Multiplayer reconnect and participant structure

학생의 연결 상태와 라운드 참가 이력을 같은 문서의 생명주기로 취급하지 않습니다.

| 개념 | source of truth | 생명주기 |
| --- | --- | --- |
| Identity | Firebase Auth UID와 학생 claims | 인증 세션 |
| Room membership | `multiplayerSessions/{roomId}/players/{uid}` | 명시적 입장부터 명시적 나가기까지 |
| Presence | player 문서의 `lastSeenAt` / `lastSeenAtMs` heartbeat | online 동안 갱신, 단절 시 stale |
| Round participant | `multiplayerSessions/{roomId}/rounds/{roundId}/participants/{uid}` | 라운드 시작 또는 PLAYING 중 late join부터 라운드 기록 보존까지 |
| Game progress | `multiplayerSessions/{roomId}/rounds/{roundId}/progress/{uid}` | 해당 라운드의 게임 진행 |

```text
features/student/session             game-engine/timed-game
  reconnect orchestration                leaderboard composition
              ↓                                  ↓
       multiplayer/repository ← round-participants → multiplayer/game-progress
              ↓                                  ↓
          Firebase                         Firebase realtime data
```

participant 문서는 `playerId`, `studentNumber`, `displayName`, `nickname`, `joinedAt`, `joinedAtMs`만 저장합니다. 교사가 라운드를 시작할 때 현재 online roster를 한 번 snapshot하고, PLAYING 중 처음 접속한 학생도 자신의 UID 문서에 upsert합니다. 학생 session orchestration은 현재 round의 자기 participant 문서를 별도로 확인하며, player와 participant가 모두 확인되기 전에는 게임 UI를 열지 않습니다. 같은 UID의 reconnect는 같은 participant 문서를 재사용하며 최초 참가 시각과 identity를 보존합니다. offline/stale presence는 participant를 삭제하지 않으므로 교사 새로고침 후에도 `participants + progress`로 순위를 복원할 수 있습니다.

라운드 시작은 `waiting → preparing → playing` 장벽을 사용합니다. `preparing` 진입 시 online roster와 participant를 고정하고, 학생 feature orchestration은 선택된 학생 게임 모듈·라운드 범위 학습 세트·학생 progress 및 게임별 선택 준비기를 병렬로 준비한 뒤 `rounds/{roundId}/readiness/{uid}`에 자기 준비 응답을 기록합니다. 학습 세트 Promise cache는 같은 round의 준비 단계와 실제 게임이 같은 두 문서 읽기를 재사용하며, 학생 progress channel은 준비기·타이머 경계·게임 로직의 동일 문서 구독을 multiplex합니다. 구체 게임의 추가 준비는 `GameDefinition.prepareStudent` 계약으로만 확장하므로 multiplayer base는 concrete game을 알지 않습니다. 교사 화면은 준비 수/전체 수를 실시간 표시하며 고정 명단 전원의 응답이 확인되면 같은 session 문서를 `playing`으로 전환합니다. 이때 server timestamp에 3초의 공통 delay를 더해 모든 client가 같은 목표 시각까지 카운트다운합니다. 응답하지 않는 학생이 있으면 교사가 대기실로 취소하거나 현재 준비 인원으로 강제 시작할 수 있습니다.

Firestore presence heartbeat는 roster 판단이 필요한 `waiting`·`preparing`에서만 실행하고 `playing`에서는 중단합니다. 라운드 순위는 participant를 source로 사용하므로 게임 중 heartbeat 중단은 순위 보존에 영향을 주지 않으며, 대기실 복귀 시 즉시 heartbeat를 다시 기록합니다.

Stale player housekeeping은 start snapshot과 동시에 수행하지 않습니다. snapshot 이후 heartbeat와 삭제가 경쟁하면 정상 membership을 지울 수 있기 때문입니다. 이후 WAITING/reset 경계에 최신 `lastSeenAtMs`를 다시 확인하는 안전한 정리 작업을 둘 수 있지만, round participant와 history는 정리 대상에 포함하지 않습니다.

## Adding a game

```text
src/games/my-game/
  types.ts
  adapter.ts
  evaluator.ts
  useMyGame.ts
  MyStudentGame.tsx
  MyTeacherGame.tsx
  StudentMyGame.tsx
  TeacherMyGame.tsx
  MyGame.module.css
```

Registry:

```ts
loadStudent: () => import("./my-game/MyStudentGame.tsx")
loadTeacher: () => import("./my-game/MyTeacherGame.tsx")
```

게임 전용 타입은 게임 폴더 안에 둡니다. 두 개 이상의 게임이 동일한 개념을 실제로 공유하게 된 뒤에만 `game-engine` 공통 계층으로 올립니다.

교사 대기실의 공통 설정은 registry의 `supportedSetTypes`, `minimumSetItemCount`, `timing`만 사용합니다. 첫 게임 고유 설정 UI가 실제로 필요해질 때에는 해당 게임 폴더가 typed 설정 UI와 config 변환을 소유하고, registry에 lazy setup entry를 추가합니다. `TeacherRoomController`에는 게임 ID 조건문이나 게임별 config 필드를 추가하지 않습니다.

## Engine families

완전한 진행 엔진 패밀리로 구현된 것은 **question-engine** 하나입니다. pair-matching은 두 게임이 실제 공유하는 최소 모델과 판정만 제공하며, 모든 게임을 question-engine에 맞추지 않습니다.

```text
game-engine/
  core/                  # 실제로 여러 엔진에서 공유되는 최소 계약/유틸
  progress/              # 여러 게임이 공유하는 item-neutral 진행 상태와 순수 갱신
  pair-matching/         # pair/card 모델, 카드 생성, 짝 판정만
  question-engine/       # 문제 → 답 → 판정 → 진행 형태의 게임만
    multiple-choice/     # 2~5지선다 생성·검증·판정
    multiplayer/         # question-engine과 multiplayer progress를 잇는 얇은 hook
  contracts/             # 게임 registry 같은 앱 수준 계약
```

`multiplayer/game-progress`는 여러 게임이 공유하는 라운드 진행 구독과 저장을 소유합니다. 메모리에서는 `itemId`/`completedItemIds`를 사용하고, 저장 경계에서 기존 Firestore 필드명인 `questionId`/`completedQuestionIds`로 변환해 스키마 호환성을 유지합니다. 저장된 progress의 `revision`은 remote snapshot reconciliation과 concurrent writer 직렬화에 사용하며 게임 규칙에는 관여하지 않습니다.

pair-matching 게임은 `learning-sets/pairMatchingAdapter.ts`에서 학습 세트를 pair로 바꾸고, 각 게임 폴더가 자체 board generation과 round rule을 소유합니다. 일부카드 refill 규칙과 모든카드 한 판 규칙을 mode 옵션으로 합치지 않습니다.

```text
TQuestion → evaluator(TQuestion, TAnswer)
                    ↓
          AnswerResult<TDetails>
                    ↓
           GameProgress<TDetails>
```

실시간/보드/타이밍 게임이 이 모델과 맞지 않으면 그때 `realtime-engine/`, `board-engine/`처럼 별도 엔진 패밀리를 추가합니다. `useQuestionEngine`에 모드 플래그를 계속 추가하지 않습니다.

## Persistence rule

정답 제출과 일반 progress transition은 `multiplayer/game-progress`의 하나의 Firestore transaction 경계를 사용합니다.

```text
multiplayerSessions/{roomId}/rounds/{roundId}
  operations/{playerId}/items/{operationId}  # immutable idempotency record
  answers/{playerId}:{attemptId}             # attempt display/audit record
  progress/{playerId}                        # canonical progress + revision
```

Idempotency scope는 `roomId + roundId + playerId + operationId`입니다. Transaction은 operation과 현재 progress를 먼저 읽고, 이미 처리된 operation이면 mutation 없이 canonical progress를 반환합니다. 새 operation이면 client가 계산한 game-neutral `previous → next` transition의 counter/set delta를 현재 progress에 적용하고 operation·answer(정답 제출인 경우)·progress를 원자적으로 기록합니다. 따라서 여러 탭 writer를 허용하되 동일 operation은 한 번만 반영되고 stale 전체 progress가 최신 값을 덮지 않습니다.

Evaluator와 점수 규칙은 계속 concrete game/game-engine이 소유합니다. Repository transaction은 game ID에 따른 분기나 정답 재계산을 하지 않으며, 이번 경계는 consistency와 retry 안정성만 책임집니다. UI는 transaction이 반환한 canonical progress를 받은 뒤 로컬 상태를 확정합니다.

## Game entry naming

새 게임의 registry lazy entry는 `XStudentGame.tsx`와 `XTeacherGame.tsx`로 이름 짓습니다. 이 entry는 세트 로딩과 오류 경계를 조립하고 실제 역할별 화면으로 위임할 수 있습니다. 내부 화면은 `StudentX.tsx`/`TeacherX.tsx`를 사용하며, 새 코드에는 책임이 모호한 `Module` 접미사를 추가하지 않습니다. 기존 entry 이름은 import churn을 피하기 위해 점진적으로 유지합니다.

## CSS rule

전역 CSS는 reset/design tokens/document defaults로 제한합니다. 컴포넌트와 게임은 CSS Modules를 사용합니다.


## Growth triggers (implement only when needed)

- 첫 뱃지/인벤토리/장기 통계 기능이 생길 때 `student-data/` 도메인을 추가합니다.
- 첫 싱글플레이 연습 모드가 생길 때 question engine persistence port에 localStorage repository를 추가합니다.
- multiplayer에 session/player 외에 matchmaking/team/season 책임이 실제로 생길 때 하위 도메인으로 분리합니다.
- Cloud Functions에 학생 인증 외 두 번째 독립 업무 도메인이 생길 때 `functions/src/<domain>/`으로 분리합니다.

빈 폴더나 미래용 추상화는 미리 만들지 않습니다.
