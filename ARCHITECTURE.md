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
16. 학생의 학번/이름 검증은 Cloud Function에서만 수행하고 roster 전체를 브라우저에 공개하지 않습니다.
17. `auth`는 신원/권한만 소유합니다. 뱃지, 인벤토리, 통계, 장기 진행도는 `StudentIdentity`에 추가하지 않습니다.
18. `shared/ui`는 domain-neutral primitive만 소유하며 game/feature/auth/multiplayer를 import하지 않습니다.
19. evaluator/adapter가 있는 게임은 같은 게임의 자동 테스트를 반드시 가집니다.

`npm run check`가 타입 검사 + architecture/security 검사 + 엔진/라우팅/auth smoke test를 수행합니다.

## Teacher app structure

```text
src/apps/teacher/
  main.tsx
  TeacherApp.tsx
  TeacherNav.tsx
  teacherRoute.ts

src/features/teacher/
  auth/
  dashboard/
  lobby/
  settings/
```

새 관리자 기능은 `features/teacher/<feature>/`로 추가합니다. `TeacherApp`은 메뉴와 페이지 조립만 담당하고 실제 Firebase 작업/도메인 로직을 직접 구현하지 않습니다.

## Student app structure

```text
src/apps/student/
  main.tsx
  StudentApp.tsx

src/features/student/
  login/
  StudentPage.tsx
  ...
```

학생 앱은 관리자 기능을 알지 않습니다.

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

## Engine families

현재 구현된 것은 **question-engine** 하나입니다. 모든 게임을 여기에 맞추지 않습니다.

```text
game-engine/
  core/                  # 실제로 여러 엔진에서 공유되는 최소 계약/유틸
  question-engine/       # 문제 → 답 → 판정 → 진행 형태의 게임만
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
