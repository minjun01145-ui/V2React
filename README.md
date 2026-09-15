# Jurye React Classroom

Jurye React Classroom은 React, TypeScript, Vite와 Firebase로 운영하는 교실용 웹 활동·게임 앱입니다. 학생은 `/`, 교사는 `/teacher/`에서 접속하며 역할별 화면과 공통 도메인 코드를 한 저장소에서 유지합니다.

세부 구현은 코드와 테스트가 source of truth이며 문서는 이를 반복해서 복제하지 않습니다.

## 로컬 실행

Node.js 22 이상이 필요합니다. 현재 패키지의 최소 버전은 22.12.0입니다.

```bash
npm ci
cp .env.example .env.local
npm run dev
```

`.env.local`에 Firebase Web 설정을 채웁니다. Firebase 초기 설정과 배포는 [SETUP_KO.md](./SETUP_KO.md)를 참고하세요.

```bash
npm run check
npm run build
npm ci --prefix functions
npm test --prefix functions
```

## 주요 디렉터리

- `src/apps/`: 역할별 앱 진입점과 화면 조립.
- `src/features/`: 학생·교사 전용 기능.
- `src/games/`, `src/game-engine/`: 구체 게임과 실제로 공유하는 게임 로직.
- `src/learning-sets/`, `src/student-data/` 등: 공통 도메인과 데이터 접근.
- `src/multiplayer/`, `src/firebase/`: 실시간 수업 데이터와 Firebase 연결 경계.
- `src/shared/`, `src/styles/`: 도메인 중립 UI·유틸과 공통 스타일.
- `functions/`: 서버 인증, 비밀값, 권한이 필요한 작업.
- `security/`: Firestore Security Rules.
- `tests/`, `scripts/`: 테스트와 기존 검사·도구.
- `.github/workflows/`: CI와 Firebase 배포.

## 작업 안내

- [AGENTS.md](./AGENTS.md): 코드를 수정할 때의 최소 작업 원칙.
- [ARCHITECTURE.md](./ARCHITECTURE.md): 장기간 유지할 의존 경계.
- [SECURITY.md](./SECURITY.md): 보안 신뢰 경계와 한계.
- [SETUP_KO.md](./SETUP_KO.md): 로컬 환경, Firebase 설정, 배포 운영.
