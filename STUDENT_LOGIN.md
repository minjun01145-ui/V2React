# 학생 로그인 및 명단 관리

## 권장 데이터 저장 위치

학생 명단은 `src/` 코드나 JSON 파일이 아니라 **Cloud Firestore**에 저장합니다.

| 컬렉션 | 내용 | 브라우저 직접 접근 |
|---|---|---|
| `studentRoster/{학번}` | 이름, 로그인 허용 상태 | 차단 |
| `studentPinCredentials/{학번}` | 솔트와 scrypt PIN 해시 | 완전 차단 |
| `studentProfiles/{익명 UID}` | 현재 로그인 세션의 학생 표시 정보 | 본인 읽기만 허용 |
| `authRateLimits/{키}` | 로그인 시도 제한 | 완전 차단 |

명단과 PIN은 Cloud Functions의 Admin SDK만 읽고 씁니다. 따라서 학생이 개발자 도구에서 번들·네트워크·Firestore SDK를 살펴봐도 전체 명단이나 PIN 해시를 가져올 수 없습니다.

## 학생 로그인 흐름

1. 학생이 학번과 이름을 입력합니다.
2. 브라우저는 Firebase 익명 인증으로 임시 UID를 받습니다.
3. `prepareStudentLogin` 함수가 비공개 명단과 대조합니다.
4. 첫 접속이면 사이트 자체 입력 팝업에서 숫자 4자리 PIN을 두 번 입력해 설정합니다.
5. 이후 접속이면 같은 팝업에서 기존 PIN을 입력합니다. 로그인 첫 화면에는 학번과 이름 필드만 표시됩니다.
6. `completeStudentLogin` 함수가 PIN을 서버에서 검증하고 학생 custom claims를 발급합니다.
7. 브라우저가 ID token을 강제 갱신한 뒤 본인 게임 데이터에만 접근합니다.

PIN 원문은 저장하지 않습니다. 학번별 랜덤 솔트와 scrypt 해시만 저장하며 비교에는 constant-time 비교를 사용합니다. 같은 학번에 대해 5분 동안 10회까지만 완료 시도를 허용합니다.

> 숫자 4자리 PIN은 교실용 간편 인증입니다. 시험·성적처럼 중요한 용도에는 학교 Google 계정 SSO 또는 더 긴 비밀번호를 사용해야 합니다.

## 관리자 명단 관리

관리자 로그인 후 `학생 관리` 메뉴에서 다음 작업을 할 수 있습니다.

- 학생 한 명 등록 또는 수정
- 로그인 허용/중지
- 엑셀의 `학번`, `이름` 두 열을 한꺼번에 붙여넣기
- PIN 초기화
- 학생 삭제

PIN 초기화 후 학생은 다음 로그인에서 새 PIN을 설정합니다. 학생 삭제 시 명단, PIN 자격 정보, 기존 익명 로그인 프로필을 함께 정리합니다.

## 배포

`main` 브랜치에 아래 파일이 변경되어 Push되면 `Deploy Firebase Backend (live)` GitHub Actions가 Functions 테스트 후 Functions와 Firestore Rules를 함께 배포합니다.

- `functions/**`
- `security/firestore.rules.secure`
- `firebase.json`
- `.firebaserc`

수동 배포가 필요할 때만 다음 명령을 사용합니다.

```bash
cd functions
npm install
npm test
cd ..
firebase deploy --only functions:jurye-v2
firebase deploy --only firestore:rules
```

프런트엔드는 기존 GitHub Actions Hosting 워크플로로 별도 배포합니다.

Functions 배포 과정에서 만들어지는 `asia-northeast3`의 컨테이너 이미지는 7일 보관 후 자동 삭제됩니다.
