# 작업 원칙

## 목적과 범위

이 저장소의 목표는 규칙을 늘리는 것이 아니라 기능을 이해하기 쉽고 안정적으로 유지하는 것입니다. 기존 동작을 보존하고 문제를 해결하는 데 필요한 가장 작은 변경을 선호합니다.

- 작업 전에 `git status`, `git log -1 --oneline`으로 현재 상태를 확인하고 사용자의 기존 변경을 보존합니다.
- 현재 문제와 관련된 코드를 먼저 읽습니다. 관련 없는 코드를 함께 정리하거나 정상인 코드를 구조적으로 더 예쁘게 만들기 위해 리팩터링하지 않습니다.
- 문제를 해결했다면 멈춥니다. “이왕 하는 김에” 주변 코드까지 변경하지 않습니다.

## 단순성

새 abstraction, manager, service, factory, registry, state machine, adapter, custom checker, dependency 또는 framework는 현재 문제를 실제로 단순하게 만들 때만 추가합니다. 미래에 필요할 것 같다는 이유만으로 만들지 않습니다. 직접적인 TypeScript 코드로 충분하면 그것을 사용합니다.

우연히 비슷하게 생긴 코드를 공통화하지 않습니다. 실제 중복과 변경 비용이 존재할 때 작은 helper부터 고려합니다.

## 검증과 방어 코드

Firestore, API, localStorage, URL, 사용자 입력처럼 신뢰할 수 없는 경계에서는 runtime validation을 합니다. TypeScript 내부에서 이미 타입이 보장된 값은 반복 검증하지 않으며, 실제로 발생할 수 없는 상태마다 guard를 추가하지 않습니다. 보안상 필요한 검증과 단순한 방어 코딩을 구분합니다.

## 테스트

사용자 동작, 실제 버그 회귀, 중요한 domain invariant를 테스트합니다. 버그가 발생했다면 가능한 경우 작은 regression test를 추가합니다. 구현 방식 자체가 요구사항이 아니라면 특정 함수 호출 순서, exact source text, AST 모양을 테스트로 고정하지 않습니다. 테스트를 통과시키기 위해 동작을 숨기거나 테스트를 skip하지 않습니다.

변경과 관련된 검증을 실행합니다. 기본 명령은 `npm run check`, `npm run build`, 서버 변경은 `npm test --prefix functions`입니다. 문서만 변경했다면 링크와 `git diff --check` 확인으로 충분합니다.

## 문서와 의존 경계

[ARCHITECTURE.md](./ARCHITECTURE.md)의 큰 의존 경계와 [SECURITY.md](./SECURITY.md)의 신뢰 경계를 유지합니다.

`README.md`, `AGENTS.md`, `ARCHITECTURE.md`, `SECURITY.md`, `SETUP_KO.md`에 자연스럽게 들어갈 내용 때문에 새 Markdown 파일을 만들지 않습니다. 코드에서 쉽게 확인할 수 있는 함수, 타입, 옵션 목록을 문서에 복제하지 않습니다. 구현이 바뀔 때마다 함께 고쳐야 하는 설명은 가능한 한 코드 가까이에 둡니다.

앞으로 새 규칙은 실제 반복 문제가 생겼을 때만 추가하며, 구현 세부사항을 architecture hard rule로 승격하지 않는다.

## 완료

요청된 문제가 해결되고 관련 검증이 통과했다면 작업을 종료합니다. 추가적인 개선 가능성을 발견했다는 이유로 범위를 넓히지 않습니다.
