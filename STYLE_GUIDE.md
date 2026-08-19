# Style guide

- 전역 CSS는 `src/styles/tokens.css`, `reset.css`, `global.css`로 제한합니다.
- global CSS import는 `src/apps/student/main.tsx`, `src/apps/teacher/main.tsx` 두 app entry에서만 합니다.
- 게임/컴포넌트 스타일은 `*.module.css`를 사용합니다.
- 학생 전용 UI 스타일은 학생 feature/app 폴더에, 교사 전용 UI 스타일은 교사 feature/app 폴더에 둡니다.
- 공통 색상/간격/radius는 `tokens.css` 변수로 승격합니다.
- 한 게임만 사용하는 selector나 animation은 게임 폴더 밖으로 빼지 않습니다.
- `!important`는 구조 문제를 숨기므로 기본적으로 사용하지 않습니다.
- 둘 이상의 기능에서 반복된다는 이유만으로 shared로 올리지 않습니다. **의미와 동작까지 domain-neutral로 동일한 primitive**일 때만 `src/shared/ui`로 승격합니다.
- `shared/ui`는 games/features/auth/multiplayer/firebase/game-engine에 의존하지 않습니다.
