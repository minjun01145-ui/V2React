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

## 캐릭터 꾸미기 · 상점

학생 대기실의 **캐릭터 상점** 카드나 프로필의 같은 이름 버튼에서 아이템을 미리 보고 구매한 뒤 **캐릭터 저장**으로 코디를 저장합니다. 기본 코디는 자동 지급되며, 기존 학생 작품·포켓몬 장착도 유지됩니다. 교사가 시작한 수업 게임에 참가하면 라운드마다 V2코인 10개가 지급됩니다. 새로 로그인해도 같은 학생 계정의 코인·보유 아이템·저장한 코디를 사용합니다.

신상은 한국 시간 월요일 0시에 자동 공개됩니다. 교사는 **설정 → 다음 주 신상**에서 후보 제외·지정과 가격 변경을 저장할 수 있습니다. 변경은 다음 주부터 적용되고, 신상 기간이 지난 아이템도 일반 상점에 남습니다. 예약 실행이 지연되면 상점 조회 시 같은 주간 공개 로직이 실행됩니다.

[MapleStory.IO API](https://maplestory.io/swagger/V3/swagger.json)의 GMS/214 아이템 목록을 작은 메타데이터 카탈로그로 보관하고, 아이콘과 캐릭터 합성 이미지를 API에서 불러옵니다. 카탈로그 갱신은 `node scripts/sync-character-catalog.mjs`로 수행합니다. Firebase에는 이미지 대신 아이템 ID·코디·보유 목록을 저장합니다. 이번 기능을 운영하려면 Hosting과 함께 Functions 및 Firestore Rules도 배포해야 합니다.

캐릭터 검증은 `npm run test:characters`와 `npm run test:characters --prefix functions`로 실행합니다. 실제 Auth·Functions·Firestore 통합 검증은 `firebase emulators:start --only auth,firestore,functions --project demo-character`로 에뮬레이터를 시작하고, 콘솔에 표시된 로컬 포트로 `FIRESTORE_EMULATOR_HOST`, `FIREBASE_AUTH_EMULATOR_HOST`, `CHARACTER_FUNCTIONS_EMULATOR`를 지정한 뒤 `npm run test:characters:emulator --prefix functions`로 실행합니다.

## 작업 안내

- [AGENTS.md](./AGENTS.md): 코드를 수정할 때의 최소 작업 원칙.
- [ARCHITECTURE.md](./ARCHITECTURE.md): 장기간 유지할 의존 경계.
- [SECURITY.md](./SECURITY.md): 보안 신뢰 경계와 한계.
- [SETUP_KO.md](./SETUP_KO.md): 로컬 환경, Firebase 설정, 배포 운영.
