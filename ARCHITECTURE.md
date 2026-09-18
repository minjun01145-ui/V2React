# 의존 경계

이 문서의 목적은 모든 구현을 규정하는 것이 아니라 코드베이스가 다시 스파게티화되는 것을 막는 것입니다. 명시되지 않은 세부 구현은 현재 코드와 가장 단순하고 관용적인 방법을 따릅니다.

## 현재 구조

학생과 교사는 별도 HTML/React 진입점을 사용하고 공통 도메인 코드를 공유합니다. 아래는 책임의 흐름을 보여 주는 개략도이며 모든 import를 표현하지는 않습니다.

```text
apps
  ↓
role-specific features
  ↓
shared domain modules / games
  ↓
multiplayer / repositories / Firebase boundaries

live-world core
  ↓
live-world transport contract
  ↓
Realtime Database or another realtime transport adapter

functions
  ↓
server-only auth, secrets and privileged operations
```

## 유지할 원칙

1. 학생 app/feature와 교사 app/feature는 서로 직접 import하지 않습니다.
2. app 계층은 기능을 조립하고 재사용 가능한 domain/data logic을 직접 품지 않습니다.
3. 구체 게임은 다른 구체 게임이나 app/feature UI에 직접 의존하지 않습니다. 공통 데이터·전송 계층도 구체 게임이나 역할별 UI에 역으로 의존하지 않습니다.
4. 게임 UI에서 Firebase transport를 직접 구현하지 않고 기존 domain/repository 경계를 사용합니다.
5. 여러 곳에서 사용하는 순수 계산은 React/Firebase와 분리하되, 순수성을 위해 불필요한 계층을 새로 만들지 않습니다.
6. 외부 데이터는 경계에서 검증하고 내부의 typed data는 불필요하게 다시 검증하지 않습니다.
7. `shared`는 실제로 domain-neutral한 코드에만 사용하고 가상의 재사용을 위해 공통화하지 않습니다.
8. 인증, PIN, 비밀값, 관리자 권한과 privileged operation은 서버/보안 규칙 경계를 유지합니다. 구체적인 신뢰 경계는 [SECURITY.md](./SECURITY.md)를 따릅니다.
9. 순환 의존성과 명백한 역할 역참조는 허용하지 않습니다.
10. 구현 세부사항은 코드와 테스트가 source of truth입니다.
11. `live-world` 코어는 캐릭터 에셋, 맵, 렌더러, React, Firebase를 알지 않습니다. 구체 게임은 이동 상태를 계산하고, transport adapter가 실시간 전송만 담당합니다.
12. 사용자별 브랜딩과 데이터 범위는 `tenant` 및 repository/auth 경계에서 결정합니다. 게임·게임 엔진·공용 AI 실행 코드는 tenant별로 복제하거나 분기하지 않습니다.

기존 의존 경계 검사는 `npm run check:architecture`로 실행합니다. 파일별 책임, 저장 스키마와 게임 규칙은 해당 코드와 테스트에서 확인합니다.
