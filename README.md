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

Windows 수업 콘솔은 C# WinForms와 PC의 공유 WebView2 런타임을 사용합니다. [Windows 실행기 다운로드](https://github.com/minjun01145-ui/V2React/releases/download/classroom-console-v1.0.0/ClassroomConsole.exe) 또는 `npm run build:console`로 만든 `external-test-browser/dist/ClassroomConsole.exe` 하나만 복사해 실행할 수 있으며, 실행기 옆에는 DLL·설정 파일·Node.js가 필요하지 않습니다. 저장소에서는 기존 [교실 수업 콘솔.cmd](./교실%20수업%20콘솔.cmd)와 [하나쌤 수업 콘솔.cmd](./하나쌤%20수업%20콘솔.cmd)도 사용할 수 있습니다. 교사화면은 자동으로 열리고 테스트화면 1·2·3은 각각 `켜기`를 눌러 엽니다. 상단 메뉴에서 네 화면을 모아 보거나 한 화면만 크게 볼 수 있으며, 보기 전환은 진행 중인 화면을 다시 로드하지 않습니다. `주소 설정`에서 각 화면의 시작 주소를 바꾸고, 같은 실행기에서 다른 교실 콘솔도 열 수 있습니다.

각 화면의 쿠키·웹 저장소는 독립된 임시 프로필에서 실행하고, 성공한 로그인만 Windows DPAPI로 암호화해 다음 실행 때 자동 로그인합니다. 설정·암호화 로그인·작은 네이티브 로더는 `%LOCALAPPDATA%\V2React\ClassroomConsole`에 보관하며, 임시 브라우저 데이터는 종료 시와 다음 실행 시 정리합니다. 저장소에서 처음 실행하면 기존 Electron 프로필의 저장된 로그인도 원본을 보존하며 이전합니다. 배포 실행에는 Windows 64비트, .NET Framework 4.8과 WebView2 런타임이 필요합니다. 빠른 콘솔 검증은 `npm run test:console`, 실제 Windows 네 화면·암호화 저장·자동 로그인 회귀는 `npm run test:console:windows`입니다. 기존 Electron 코드는 웹 앱 브라우저 회귀 테스트용으로 남겨 두며 해당 테스트에는 `npm ci --prefix external-test-browser`가 필요합니다.

```bash
npm run check
npm run build
npm ci --prefix functions
npm test --prefix functions
```

## 교사 설정 · 테마와 시스템 폰트

교사 메뉴의 **설정**에서 기존 수업·상점 설정, **AI 설정**, **테마 · 폰트**를 선택합니다. 기존 `#/ai` 주소도 설정의 AI 항목으로 열립니다. AI 관리는 기존과 같이 기본 tenant 교사에게만 표시됩니다.

테마를 선택하면 같은 tenant의 교사·학생 화면(로그인 포함)에 즉시 적용됩니다. 딸기 우유·숲속 캠프·청량 바다는 기본 테마와 같은 둥근 화면 구조를 유지한 채 색상·배경 무늬·기본 폰트만 바꾸며(`src/styles/themes.css`의 토큰), 게임 대표 이미지는 모든 테마에서 원본을 그대로 씁니다. 기본 테마로 기존 화면에 돌아갈 수 있습니다. 테마 변경 시 폰트는 테마 기본값으로 돌아가며, 이후 시스템 폰트를 골라 **저장**하면 따로 사용할 수 있습니다. **테마 기본 폰트**를 선택하면 다시 테마를 따릅니다. 미저장 폰트 선택은 교사 화면에서만 미리 보입니다. 설정은 기존 공개 appearance 문서에 저장하며 해당 tenant 관리자만 변경할 수 있습니다. 슬라이드/Fabric 콘텐츠의 개별 글꼴과 게임 자체의 맵·캐릭터·Phaser 캔버스 텍스트는 유지합니다. 브라우저 회귀는 `npm run test:settings-fonts --prefix external-test-browser`, 권한 검증은 `npm run test:rules`로 실행합니다.

## AI1 · AI2와 학습자료 만들기

**설정 → AI 설정**에서 공유 API 키와 AI1/AI2를 관리합니다. 기존 채점·튜터·슬라이드 도우미는 AI1을 그대로 사용하며, 학습지는 AI2를 사용합니다. AI2를 처음 저장하기 전에는 AI1을 복사하되 사고 수준은 **최대**, 출력 토큰은 최소 **8192**, 제한시간은 **300초**로 시작합니다. 저장 후에는 두 설정이 독립적입니다.

**학습자료 만들기**에서 끊어읽기 세트와 종류(본문 학습지·본문 연습 학습지·연습문제 학습지)를 골라 만들고, **저장**하면 다음에 같은 세트·종류를 열 때 바로 표시되며 **재생성**으로 다시 만듭니다. 제목은 세트 이름의 "N학년 N과"를 써서 "3학년 5과 - 본문 학습지"처럼 표시합니다. 본문 학습지는 본문과 뜻 표 하나이며 두 페이지 안에 들어가도록 글자와 간격을 줄입니다. 본문 연습 학습지는 뜻 쓰기·영어 쓰기 표입니다. 두 학습지는 AI 없이 만들고 누락된 뜻만 AI2로 보완합니다. 연습문제는 AI2가 빈칸 채우기 10·단어 및 표현 쓰기 10·문장 쓰기 5·해석하기 5·틀린 부분 고치기 10문항을 만들고 정답은 별도 페이지에 둡니다. AI를 쓴 생성은 입력·출력 토큰 수를 함께 표시·저장합니다. 저장 문서는 `tenants/{tenantId}/worksheets/{세트ID}__{종류}`에 있으며 해당 tenant 교사만 읽고 씁니다. A4 양식은 시스템 폰트와 무관하게 Noto Sans KR을 사용합니다. AI 요청은 최대 100문장·JSON 기준 12,000자입니다.

**시험 연습문제**는 세트마다 문제 은행을 쌓아 만듭니다. **5문제 만들기**로 AI2가 내신 시험 유형(빈칸·어법·<보기> 쓰임·영작·내용 일치·고쳐 쓰기 등, `functions/src/question-bank/service.ts`) 문제를 만들면 원하는 문제만 체크해 저장하고, 반복해서 추가한 뒤 **학습지 생성하기**로 시험지와 별도 페이지의 정답·해설을 만듭니다. 이미 저장한 문제는 AI에 전달해 중복을 피합니다. 저장한 문제는 학습지와 별개로 `tenants/{tenantId}/questionBank/{문제ID}`(세트 ID 포함, 수정 없이 추가·삭제만)에 남으며 `src/question-bank/`의 형식·저장소·미리보기로 다른 기능에서도 다시 쓸 수 있습니다. 문제 문자열에서 `______`은 빈칸, `[[...]]`은 밑줄입니다.

모든 학습지는 **인쇄** 옆 **PDF 다운로드**로 바로 저장할 수 있습니다(`src/worksheet/pdf.ts`). 화면의 학습지를 이미지로 만들어 A4로 나누며, 표의 행·문항·제목 중간에서 자르지 않고 새 페이지 섹션(정답 등)은 새 쪽에서 시작합니다.

`src/worksheet/`는 도메인 중립 문서 타입·페이지 맞춤·저장 형식 검증·인쇄 UI, `src/learning-worksheets/`는 학습지 종류별 변환·저장·서버 경계를 담당합니다. 운영에는 **Hosting, Functions, Firestore Rules** 배포가 필요합니다. 회귀 검증은 `npm run test:sets`, `npm test --prefix functions`, `npm run test:worksheets --prefix external-test-browser`입니다.
학습지 브라우저 검증은 Java 21 이상을 PATH에 두고 실행합니다. 격리된 Firestore 에뮬레이터와 실제 repository·Rules로 본문을 읽고, AI callable 경계만 대체해 미리보기와 인쇄 PDF를 생성합니다.

## 문제 엔진: OX · 빈칸 채우기

게임이 가져다 쓰는 순수 문제 엔진입니다(`src/game-engine/question-engine/`). 학습 세트 연결은 `src/learning-sets/trueFalseAdapter.ts`, `fillBlankAdapter.ts`가 맡습니다.

- **OX(`true-false/`)**: "dog - 고양이"처럼 짝을 보여 주고 O/X를 고릅니다. 단어 세트와 끊어읽기 세트 모두 쓰며, 끊어읽기 세트는 완성 문장(`entry`) 또는 끊어읽기 덩어리(`chunk`) 단위를 고릅니다. 틀린 짝은 다른 항목의 뜻에서 고르되, 같은 단어의 다른 뜻(dog - 강아지)은 X로 내지 않습니다. O 비율은 기본 50%입니다.
- **빈칸 채우기(`fill-blank/`)**: 끊어읽기 세트의 문장마다 한 단어를 비우고 뜻과 함께 보기 2~5개(게임에서 선택)를 냅니다. AI 없이 `wordClass.ts`의 규칙(전치사·be동사·대명사 같은 닫힌 품사 목록, 어미, 앞뒤 단어)으로 품사를 추정해 동사엔 동사, 비교급엔 비교급, 전치사엔 다른 전치사를 오답으로 고릅니다. 세트 안에서 같은 자리를 채운 적 있는 단어(정답이 될 수도 있는 단어)와 사람 이름은 오답으로 내지 않습니다. 규칙 기반이라 완벽하진 않으며, 품사 추정이 애매하면 철자·길이가 비슷한 단어로 채웁니다.
- **빈칸 재료 미리 만들기**: 끊어읽기 세트를 저장하면 서버 트리거(`functions/src/fill-blank-bank/`)가 AI2로 문장마다 빈칸 후보 3개와 빈칸마다 같은 품사·형태의 오답 6개를 만들어 `{세트}/content/fillBlanks`에 저장합니다(15문장씩 나눠 요청, 바뀐 문장만 다시 생성, 세트 삭제 시 함께 삭제). 게임은 `loadFillBlankBank`로 읽어 `adaptLearningSetToFillBlank`의 `bank`로 넘기면 판마다 빈칸 단어와 오답 조합이 무작위로 바뀝니다. AI 오답도 엔진 규칙으로 한 번 더 거르고, 재료가 없거나 문장이 바뀐 뒤 아직 다시 만들어지지 않았으면 규칙 기반 빈칸으로 바로 대체합니다. 기존 세트는 한 번 다시 저장하면 재료가 만들어집니다.

검증은 `npm run test:multiple-choice`에 포함됩니다.


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

## 골드런

골드런(`src/games/gold-run/`)은 단어 세트용 러너 게임입니다. OX 엔진(`adaptLearningSetToTrueFalse`)으로 문제를 만들고, 학생 캐릭터를 뒤에서 따라가는 원근 화면으로 그립니다. 학생은 세 갈래 길에서 금괴를 모으고 허들을 뛰어넘다가, 120m마다 나오는 문을 지나며 화면 위 "단어 = 뜻"이 맞는지 답합니다. 맞으면 왼쪽 O 문, 틀리면 오른쪽 X 문으로 들어가고, 가운데 벽에 부딪히면 오답입니다. 허들에 걸리거나 오답이면 하트 하나를 잃고 속도가 줄며, 하트 3개를 모두 잃으면 2초 넘어졌다가 하트를 다시 채워 달립니다.

- 길(금괴·허들·문 배치)은 라운드 ID로 정해져서 모든 학생이 같은 길을 달립니다.
- 문을 지날 때마다 그 사이에 얻은 거리·금괴·정답 점수를 한 번의 시도로 저장합니다. 교사 화면은 실시간 순위를 보여 줍니다.
- 조작은 ←/→(A/D) 또는 좌우로 밀어 차선을 바꾸고, ↑·W·Space, 위로 밀기, 화면 탭으로 점프합니다.
- 뒷모습 캐릭터는 다른 게임의 블롭 캐릭터와 같은 플레이어 색으로 `scene/RunnerActor.ts`에서 벡터로 그립니다.

규칙 회귀 검증은 `npm run test:games`에 포함됩니다(`tests/games/gold-run.test.ts`).

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
