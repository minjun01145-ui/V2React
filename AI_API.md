# AI API 공통 베이스

## 목표

현재 공급자는 Ollama Cloud입니다. 브라우저는 API 키나 Ollama HTTP 요청 형식을 알지 않고, 모든 외부 AI 요청은 서울 리전 Cloud Functions를 통과합니다.

```text
교사 UI → 관리자 전용 callable → 공통 AI service → Ollama provider → Ollama Cloud
                                   ├→ Firestore 비공개 설정
                                   └→ Secret Manager API 키
```

구 `Jurye` 저장소의 연결 테스트와 메시지 테스트 흐름만 참고했습니다. 기존 단일 Functions 파일은 복사하지 않았으며 설정, 비밀 저장소, 공급자, 서비스, callable을 독립 모듈로 분리했습니다.

## 교사용 관리 도구

관리자 로그인 후 `AI API` 메뉴에서 다음 작업을 수행합니다.

- Ollama API 키 신규 등록 또는 교체
- 모델, temperature, 최대 출력 토큰, 사고 수준, 제한 시간 설정
- `/api/tags` 인증 및 모델 목록 연결 테스트
- `/api/chat` 실제 메시지 전송 및 응답·지연 시간·토큰 수 확인
- 공급자 일시 비활성화

API 키 입력란은 저장 후 항상 비워집니다. 기존 키는 브라우저로 다시 가져오거나 표시할 수 없습니다.

## 서버 모듈

| 모듈 | 책임 |
|---|---|
| `types.ts` | 공급자와 서비스의 순수 타입 |
| `validation.ts` | 설정과 메시지 입력 제한 |
| `ollamaProvider.ts` | Ollama `/tags`, `/chat` HTTP 어댑터 |
| `configRepository.ts` | 비공개 Firestore 설정 저장 |
| `secretStore.ts` | Secret Manager API 키 버전 저장·조회 |
| `service.ts` | 게임과 관리자 테스트가 공유하는 AI orchestration |
| `callables.ts` | 관리자 인증과 HTTPS callable 경계 |

`functions/tests/architecture.test.mjs`와 루트 architecture 검사에서 상대 import 순환을 탐지합니다.

## 저장 위치

- 비밀키: Secret Manager의 `jurye-ollama-cloud-api-key`
- 일반 설정: `aiProviderConfigs/ollama-cloud`

Firestore 규칙은 `aiProviderConfigs`의 브라우저 직접 읽기와 쓰기를 모두 거부합니다.

현재 Firebase 프로젝트에는 Secret 보관함이 생성되어 있고, Functions 실행 계정에는 이 Secret 하나에 대한 `Secret Accessor`와 `Secret Version Adder` 권한만 부여되어 있습니다. 실제 키는 관리자 로그인 후 [AI API 관리 화면](https://v2react-jurye-classroom.web.app/teacher/#/ai)에서 저장합니다.

Ollama API 키를 `.env`, `VITE_` 환경변수, Firestore, GitHub Actions secret에 중복 등록하지 않습니다. `VITE_` 값은 빌드 결과와 브라우저에서 확인할 수 있으므로 비밀 저장소로 사용할 수 없습니다.

## 새 AI 게임 추가 원칙

1. 게임 폴더에는 문제 타입, 프롬프트 입력 타입, 응답 validator를 둡니다.
2. 서버에 게임 전용 callable을 만들고 학생의 입력 길이와 허용 필드를 제한합니다.
3. 게임 함수가 `generateAiReply()`를 호출합니다.
4. 모델 응답을 `unknown`으로 취급하고 게임별 validator로 검사합니다.
5. 잘못된 응답은 제한된 횟수만 재시도하고 학생에게 원문 오류나 비밀 정보를 보내지 않습니다.
6. 학생이 임의의 system prompt·model·URL을 보낼 수 있는 범용 프록시는 만들지 않습니다.

## AI 문답 엔진

`AI 문답`은 단어·끊어읽기 세트를 지원하는 독립 멀티플레이 게임이며 두 방향을 선택할 수 있습니다.

- 영어 → 한국어: 단어 뜻 또는 문장 해석
- 한국어 → 영어: 영단어 작성 또는 문장 영작

브라우저의 `ai-tutor-engine`은 전송 계약, 응답 검증, 공통 채점 결과만 소유합니다. 학습 세트 변환은 `learning-sets/aiTutorAdapter.ts`에 두어 AI 문답과 포켓몬 잡기가 함께 사용하고, 각 게임은 자체 UI만 소유합니다. 서버의 `ai-tutor` 계층은 현재 라운드·참가자·세트·문항을 직접 검증하고, 학생에게서 system prompt나 기준 답안을 받지 않습니다. 포켓몬 잡기는 문항마다 영어→뜻과 뜻→영어 방향을 무작위로 요청하며 서버가 허용된 두 방향과 실제 저장 문항을 다시 검증합니다.

응답은 `correct`, `retry`, `help`, `off-topic` 네 종류입니다. `retry`는 틀린 지점과 힌트만 제공하며 기준 답안 전체가 응답에 섞이면 서버가 제거합니다. `help`는 현재 문항의 단어·구문·문법 질문만 다루고, `off-topic`은 모델이 생성한 내용을 버린 뒤 고정 안내문만 반환합니다.

Ollama Cloud는 현재 structured outputs를 지원하지 않으므로 JSON 기반 게임도 서버에서 응답 검증과 실패 처리를 반드시 구현해야 합니다.
