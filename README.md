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

## 교사 설정 · 테마와 시스템 폰트

교사 메뉴의 **설정**에서 기존 수업·상점 설정, **AI 설정**, **테마 · 폰트**를 선택합니다. 기존 `#/ai` 주소도 설정의 AI 항목으로 열립니다. AI 관리는 기존과 같이 기본 tenant 교사에게만 표시됩니다.

테마를 선택하면 같은 tenant의 교사·학생 화면(로그인 포함)에 즉시 적용됩니다. 딸기 우유·숲속 캠프·청량 바다는 기본 테마와 같은 둥근 화면 구조를 유지한 채 색상·배경 무늬·기본 폰트만 바꾸며(`src/styles/themes.css`의 토큰), 게임 대표 이미지는 모든 테마에서 원본을 그대로 씁니다. 기본 테마로 기존 화면에 돌아갈 수 있습니다. 테마 변경 시 폰트는 테마 기본값으로 돌아가며, 이후 시스템 폰트를 골라 **저장**하면 따로 사용할 수 있습니다. **테마 기본 폰트**를 선택하면 다시 테마를 따릅니다. 미저장 폰트 선택은 교사 화면에서만 미리 보입니다. 설정은 기존 공개 appearance 문서에 저장하며 해당 tenant 관리자만 변경할 수 있습니다. 슬라이드/Fabric 콘텐츠의 개별 글꼴과 게임 자체의 맵·캐릭터·Phaser 캔버스 텍스트는 유지합니다. 브라우저 회귀는 `npm run test:settings-fonts --prefix external-test-browser`, 권한 검증은 `npm run test:rules`로 실행합니다.

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

## 슬라이드 글상자 편집

글상자는 영어 단어를 유지하며 줄바꿈하고, 한 줄보다 긴 단어와 공백 없는 한국어는 박스 안에서 나누어 표시합니다. 편집기와 학생 화면에 같은 줄바꿈을 적용합니다. 글씨 크기·선 두께·문제 엔진 시간은 입력 중 빈 값을 허용하고, Enter 또는 포커스를 옮길 때 범위를 적용하며 빈 값은 이전 값으로 복원합니다.

글상자 캐럿, 줄바꿈, 숫자 입력의 브라우저 회귀 검증은 `npm ci --prefix external-test-browser` 후 `npm run test:slide-editor --prefix external-test-browser`로 실행합니다.

### 글꼴 · 디자인 양식

편집기 **양식**에서 현재 슬라이드 또는 전체 덱의 배경·글꼴을 바꿉니다. 첫 장은 표지, 나머지는 본문 양식이며, 다시 적용해도 장식은 쌓이지 않습니다. 기존 글상자의 내용·위치·크기·굵기와 사용자 그림·도형은 유지됩니다. 배경 이미지는 제거되며, 현재 슬라이드의 양식 적용은 한 번에 실행 취소할 수 있습니다.

기존 기본 고딕을 유지하고 추가 글꼴은 Google Fonts와 공개 CDN에서 편집기·학생 화면에 동일하게 불러옵니다. [Pretendard](https://github.com/orioncactus/pretendard/blob/v1.3.9/LICENSE)는 SIL OFL, [Google Fonts 글꼴](https://fonts.google.com/about)은 무료 상업용 이용이 가능합니다. 궁서는 [조선일보의 조선궁서체](https://event.chosun.com/100/100font.html)를 변경 없이 사용하며 개인·기업 무료 이용/배포가 허용됩니다(폰트 자체의 유료 판매·유료 배포 금지).

양식 데이터 불변식은 `npm run test:slide-templates`, 실제 편집기 양식 적용·폰트/캐럿·학생 렌더 회귀는 `npm run test:slide-templates --prefix external-test-browser`로 검증합니다. 브라우저 테스트는 `SLIDE_SCREENSHOT_DIR` 지정 시 해당 폴더에 각 표지·본문의 스크린샷을 저장합니다.


## 슬라이드 수업 타이머

교사가 **타이머 → 시작**으로 켠 일반 수업 타이머는 학생 화면 중앙에도 같은 모양으로 표시됩니다. 진행 중 모양을 바꾸면 학생 화면도 함께 바뀌며, 일시정지·초기화·시간 종료 시 학생 표시가 사라집니다.

자유답변 슬라이드의 제한시간은 교사 답변 영역의 가용 너비·높이에 맞춘 큰 테마 타이머로 표시됩니다. 이 타이머의 모양은 영역 안 조작이나 일반 타이머 설정에서 바꿀 수 있으며, 학생 답변 입력 영역에는 표시하지 않습니다. 제출 마감 시점은 기존 제한시간을 따릅니다.

교사 대기실의 **점프타워로 집합**은 자유 플레이 중인 학생까지 점프타워로 이동시키고, **해산**은 모두 대기실로 돌려보냅니다. 집합 중에는 수업·슬라이드쇼·질문 만들기를 시작할 수 없으며, 다른 교사 창에서도 먼저 해산해야 합니다.

## 대기실 캐릭터 게임

데스매치는 기존보다 가로로 3배 넓은 맵에서 내 캐릭터를 따라 카메라가 이동하며, 단단한 천장이 점프를 막습니다. 용암 동굴·심해·블랙홀 우주 중 기존 공유 게임 채널과 방 ID로 같은 맵을 정합니다.

대기실 점프타워는 하늘 섬·얼음 동굴·용암 탑 중 방 seed로 같은 맵을 정합니다. 두 게임의 맵은 선언형 정의 파일로 추가하며 기존 이동·충돌·렌더 엔진을 공유합니다.

공용 캐릭터 렌더는 내 이름표 바로 위의 노란 삼각형, 노란 이름표와 발밑 글로우로 나를 강조하고 다른 캐릭터보다 위에 그립니다. 학습 점프타워에는 맵 변경 없이 이 강조만 적용합니다.

단어 데스매치(`src/games/lobby-deathmatch/word/`)는 단어 세트 수업 게임입니다. 데스매치 맵 중앙 위쪽에 큰 선택지 발판 두 개를 두고, 15초 뒤 정답 발판 위에 있는 학생이 1개씩 득점하며 3초 공개 후 다음 문제로 넘어갑니다. 문제와 정답 발판은 라운드 ID와 서버 시각으로 모든 화면에서 같게 정해지고, 교사 화면은 문제와 실시간 순위를 보여 줍니다.

## 슬라이드 문제엔진

슬라이드의 **문제 엔진**에서 **슬라이드 문제엔진**을 선택하면 객관식·OX형·단답형·AI 단답형 문제 한 개를 출제합니다. 제한시간은 기본 20초(5~300초), 객관식은 선택지 2~5개이며 복수 정답을 지정해도 학생은 하나만 고릅니다. 단답형은 공백·대소문자를 정규화해 비교하고, AI 단답형은 문장부호까지 제거한 비교가 불일치할 때만 기존 서버 AI를 사용합니다. AI 연결 실패는 결정적 비교로 대체하며 교사 답변 목록에서 판정 방식을 확인합니다.

제출은 한 번만 가능하고 서버 접수 시각으로 마감·속도 점수를 계산합니다. 정답은 교사 전용 문서에 보관하며 학생에게 공개되는 슬라이드·세션에는 넣지 않습니다. 마감 후 교사 화면에 선택지별 인원 또는 답변별 판정이 표시됩니다. 선택지 결과는 가운데 정렬된 최대 96px 폭 막대와 색상 기호 칩으로 표시하며, 0명도 6px 바닥 막대를 유지하고 오답 막대는 흐리게 표시합니다. 제출 현황은 차트 위 오른쪽에 배치하고 선택지 타일 영역은 유지합니다. 점수는 기존 슬라이드쇼 누적 순위에 합산됩니다. 새 기능 운영에는 **Hosting, Functions, Firestore Rules 배포가 모두 필요**합니다.

도메인 회귀는 `npm run test:slide-question`, 서버 제출·인증·마감·점수 검증은 `npm test --prefix functions`에 포함됩니다. Java 21과 Firebase CLI가 준비되면 `npm run test:rules`로 Firestore와 Realtime Database의 실제 보안 규칙을 격리된 로컬 에뮬레이터에서 검증합니다. 교사·학생 입력/결과 및 네 타이머 테마의 브라우저 회귀는 `npm run test:slide-question --prefix external-test-browser`로 실행하며 `ENGINE_SCREENSHOT_DIR`을 지정하면 해당 폴더에 화면을 저장합니다.

main 배포는 화면 검사·빌드와 슬라이드 브라우저 회귀 검증을 먼저 완료하고, Rules 에뮬레이터 검증 및 서버 테스트를 통과한 뒤 Functions → Rules → Hosting 순으로 진행합니다. AI 단답형은 서버가 접수한 원래 답안과 시각으로 자동 채점하며, 실행이 중단되어도 Firestore 이벤트 재시도로 복구합니다.

## 짝 맞추기 · 점프타워 뽑기

짝 맞추기 카드의 선택·판정·보충은 `src/games/matching/`이 담당합니다. 한 짝을 판정하는 동안 누른 카드는 버리지 않고 그 판정이 끝난 뒤 순서대로 처리하므로, 빠르게 이어 누르는 학생도 카드를 잃지 않습니다. 보드에서 이미 바뀐 카드에 대한 탭만 무시합니다.

점프타워 뽑기의 골인과 도착 순서는 `src/game-engine/jump-tower/`와 `src/student-picker/jump-race/`가 담당합니다. 목표 층(`goalFloor`)에 먼저 도달한 학생은 그 자리에서 조작이 멈추고, 도착 시각은 서버 시각 기준으로 기록됩니다. 교사 화면은 도착 순서대로 1등·2등…을 실시간으로 보여 주며, 학생 화면에도 자기 등수가 표시됩니다. 기록은 라이브 채널과 나란한 `-records` 채널(`liveRecordsScope`)에 저장되므로 학생이 쓰는 곳과 교사가 읽는 곳이 항상 같습니다. 목표 층이 없는 대기실 점프타워는 지금처럼 끝없이 올라갑니다.

도메인 회귀는 `npm run test:games`와 `npm run test:routing`에 포함되며, 실제 카드 터치 회귀는 `npm run test:matching-cards --prefix external-test-browser`로 실행합니다.

## 작업 안내

- [AGENTS.md](./AGENTS.md): 코드를 수정할 때의 최소 작업 원칙.
- [ARCHITECTURE.md](./ARCHITECTURE.md): 장기간 유지할 의존 경계.
- [SECURITY.md](./SECURITY.md): 보안 신뢰 경계와 한계.
- [SETUP_KO.md](./SETUP_KO.md): 로컬 환경, Firebase 설정, 배포 운영.
