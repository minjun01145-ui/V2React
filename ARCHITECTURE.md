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
4. `game-engine/core`와 `game-engine/question-engine`의 순수 모듈은 React/Firebase/구체 게임에 의존하지 않습니다. `useQuestionEngine.ts`만 React를 사용합니다.
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

현재 구현된 것은 **question-engine** 하나입니다. 모든 게임을 여기에 맞추지 않습니다.

```text
game-engine/
  core/                  # 실제로 여러 엔진에서 공유되는 최소 계약/유틸
  question-engine/       # 문제 → 답 → 판정 → 진행 형태의 게임만
    multiple-choice/     # 2~5지선다 생성·검증·판정
    multiplayer/         # question-engine 진행/답안의 Firestore adapter
  contracts/             # 게임 registry 같은 앱 수준 계약
```

```text
TQuestion → evaluator(TQuestion, TAnswer)
                    ↓
          AnswerResult<TDetails>
                    ↓
           GameProgress<TDetails>
```

실시간/보드/타이밍 게임이 이 모델과 맞지 않으면 그때 `realtime-engine/`, `board-engine/`처럼 별도 엔진 패밀리를 추가합니다. `useQuestionEngine`에 모드 플래그를 계속 추가하지 않습니다.

## Persistence rule

정답 제출과 그 결과의 player progress는 하나의 Firestore batch로 commit합니다. UI는 shared repository가 resolve된 뒤에만 로컬 진행 상태를 확정합니다.

## CSS rule

전역 CSS는 reset/design tokens/document defaults로 제한합니다. 컴포넌트와 게임은 CSS Modules를 사용합니다.


## Growth triggers (implement only when needed)

- 첫 뱃지/인벤토리/장기 통계 기능이 생길 때 `student-data/` 도메인을 추가합니다.
- 첫 싱글플레이 연습 모드가 생길 때 question engine persistence port에 localStorage repository를 추가합니다.
- multiplayer에 session/player 외에 matchmaking/team/season 책임이 실제로 생길 때 하위 도메인으로 분리합니다.
- Cloud Functions에 학생 인증 외 두 번째 독립 업무 도메인이 생길 때 `functions/src/<domain>/`으로 분리합니다.

빈 폴더나 미래용 추상화는 미리 만들지 않습니다.
