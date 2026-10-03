# 민준쌤 게임기 V2R

민준쌤 게임기 V2R은 React, TypeScript, Vite와 Firebase로 운영하는 교실용 웹 활동·게임 앱입니다. 학생은 `/`, 교사는 `/teacher/`에서 접속하며 역할별 화면과 공통 도메인 코드를 한 저장소에서 유지합니다.

세부 구현은 코드와 테스트가 source of truth이며 문서는 이를 반복해서 복제하지 않습니다.

## 로컬 실행

Node.js 22 이상이 필요합니다. 현재 패키지의 최소 버전은 22.12.0입니다.

```bash
npm ci
cp .env.example .env.local
npm run dev
```

`.env.local`에 Firebase Web 설정을 채웁니다. Firebase 초기 설정과 배포는 [SETUP_KO.md](./SETUP_KO.md)를 참고하세요.

Windows 수업 콘솔은 최상단의 [교실 수업 콘솔.cmd](./교실%20수업%20콘솔.cmd)를 더블클릭해 실행합니다. 첫 실행에는 Node.js와 런타임 다운로드를 위한 인터넷 연결이 필요합니다. 접속 사이트는 [external-test-browser/config.json](./external-test-browser/config.json)에서 설정합니다. 교사화면은 자동으로 열리고 테스트화면 1·2·3은 각각 `켜기`를 눌러 엽니다. 상단 메뉴에서 네 화면을 모아 보거나 한 화면만 크게 볼 수 있으며, 보기 전환은 진행 중인 화면을 다시 로드하지 않습니다.

각 화면에서 최초 한 번 로그인하면 이후에는 화면별 로그인 세션과 Windows에서 암호화한 로그인 정보를 사용해 자동으로 로그인합니다. 로그인 정보와 브라우저 프로필은 해당 PC에만 보관하며 Git에 포함하지 않습니다. 콘솔 검증은 `npm run test:console`, 브라우저 동작 및 자동 로그인 검증은 `npm run test:browser --prefix external-test-browser`, `npm run test:passwords --prefix external-test-browser`로 실행합니다.

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
- `external-test-browser/`: 독립 로그인 세션을 사용하는 교실 수업 콘솔.
- `security/`: Firestore Security Rules.
- `tests/`, `scripts/`: 테스트와 기존 검사·도구.
- `.github/workflows/`: CI와 Firebase 배포.

## 버전 기록

현재 기준 버전은 **v2.00**입니다. `npm ci` 또는 `npm install`이 Git hook을 설치합니다. 커밋할 때 일반 변경은 0.01씩 올리고, 새 `src/games/` 게임 디렉터리 추가는 다음 0.1 경계로 올립니다. 큰 기능 변경은 PowerShell에서 `$env:V2R_RELEASE = 'feature'`를 설정한 뒤 커밋하고 `Remove-Item Env:V2R_RELEASE`로 해제합니다. 예를 들어 v2.05 다음 기능 추가는 **v2.10**입니다. 필요하면 `V2R_RELEASE_NOTE`로 변경 제목을 설정한 뒤 커밋하고 해제합니다. v3.00 전환은 자동으로 진행하지 않습니다.

한 커밋의 푸시·배포는 같은 버전을 사용하며 재배포로 번호를 추가 소비하지 않습니다. [release-history.json](./release-history.json)에 버전별 날짜·변경 제목을 누적하고 npm 버전은 호환되는 세 자리 형식(v2.05 → `2.0.5`, v2.10 → `2.1.0`)으로 함께 갱신합니다. 학생·교사 브라우저 탭 제목에 현재 버전이 표시되고 배포된 `/version.json`에서 이력·커밋·빌드 시각을 확인할 수 있습니다.

GitHub Actions는 푸시와 Hosting·Functions·Rules 배포 결과를 실행 요약과 JSON artifact에 남깁니다. Artifact는 저장소의 보존 기간을 따르며 커밋별 버전 이력은 Git에 남습니다. 수동 배포는 [SETUP_KO.md](./SETUP_KO.md)의 npm 배포 명령을 사용하면 로컬 `.release-records/`에도 결과를 기록합니다. hook을 실행하지 않는 웹 편집·`--no-verify` 커밋은 자동 증가 대상이 아니므로 로컬 hook을 통해 커밋합니다.

## 작업 안내

- [AGENTS.md](./AGENTS.md): 코드를 수정할 때의 최소 작업 원칙.
- [ARCHITECTURE.md](./ARCHITECTURE.md): 장기간 유지할 의존 경계.
- [SECURITY.md](./SECURITY.md): 보안 신뢰 경계와 한계.
- [SETUP_KO.md](./SETUP_KO.md): 로컬 환경, Firebase 설정, 배포 운영.
