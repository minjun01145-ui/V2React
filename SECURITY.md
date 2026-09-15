# 보안 신뢰 경계

## Browser

브라우저는 신뢰하지 않습니다. frontend route guard와 숨겨진 링크는 접근 권한을 보장하지 않습니다. 실제 권한은 Firebase Authentication, 서버 검증, custom claims 및 Firestore Security Rules가 담당합니다. 역할별 번들 분리도 보안 경계를 대신하지 않습니다.

## Student

학생 roster와 PIN credential은 모든 브라우저의 Firestore 직접 읽기를 차단합니다. 명단 관리도 관리자 권한을 검증하는 서버를 거칩니다. PIN 원문은 저장하지 않고 솔트가 있는 해시로 보관합니다. 학생 식별과 권한 부여는 서버가 명단과 PIN을 검증한 뒤 수행하며, 학생 데이터 접근은 인증된 본인 신원과 권한에 묶습니다.

최초 PIN 설정은 학번과 이름을 아는 사람의 선점 가능성을 막지 못합니다. 교실용 간편 인증의 한계를 전제로 하며 더 강한 본인 확인이 필요하면 교사 발급 초기 등록 코드나 학교 SSO 등을 검토합니다.

## Administrator

관리자 비밀번호는 Firebase Authentication이 처리하며 앱이 저장하지 않습니다. 인증 성공만으로 관리자 권한을 부여하지 않고 서버와 Firestore Rules가 `admins/{uid}`의 활성 allow-list도 확인합니다. 관리자 계정 이메일은 공개 식별자입니다.

## Secrets

서비스 계정 키, 관리자 비밀번호, 외부 AI API key 등의 비밀은 source code, 공개 Firestore 문서, `VITE_` 변수에 넣지 않습니다. `VITE_` 변수는 브라우저에 공개될 수 있다고 가정합니다.

AI provider key는 Google Secret Manager에서 관리하고 서버만 사용합니다. 관리자용 키 등록은 서버 인증을 거치며 저장된 키를 브라우저에 반환하지 않습니다. 외부 AI 요청은 서버가 허용한 공급자와 게임별 입력 범위로 제한하며 학생에게 임의 URL·프롬프트를 받는 범용 프록시를 제공하지 않습니다.

## Data

Firestore Rules를 실제 권한 경계로 취급합니다. 외부 입력은 서버 또는 repository 경계에서 검증하며, 권한이 필요한 서버 작업도 독립적으로 호출자 권한을 확인합니다. 공개 읽기가 허용된 classroom content에는 개인정보나 비밀을 저장하지 않습니다.

테스트용 임시 신원과 참가 비밀은 실제 학생 신원·권한과 격리하고 허용된 테스트 방과 소유자 범위로 제한합니다. 참가 비밀을 URL이나 영속 저장소에 노출하지 않습니다.

## Integrity limitation

현재 일부 게임 점수와 판정은 브라우저에서 수행합니다. 다른 학생의 데이터를 수정하지 못하도록 제한해도 본인 점수 조작까지 보장하지는 않습니다. 고위험 시험·성적 시스템 수준의 무결성을 제공한다고 표현하지 않으며, 그 수준이 실제로 필요할 때 서버 판정으로 이동합니다.

환경 설정, Rules 배포와 App Check 운영 절차는 [SETUP_KO.md](./SETUP_KO.md)를 참고하세요.
