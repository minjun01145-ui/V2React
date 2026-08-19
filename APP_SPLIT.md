# Student / Teacher app split

Jurye는 한 코드베이스 안에서 **두 개의 웹 진입점(entry point)** 을 사용합니다.

```text
index.html                → 학생 앱
teacher/index.html        → 교사 앱

src/apps/student/         → 학생 앱 조립/부트스트랩
src/apps/teacher/         → 교사 앱 조립/관리자 내비게이션

src/features/student/     → 학생 전용 기능 UI
src/features/teacher/     → 교사 전용 기능 UI

src/game-engine/          ┐
src/multiplayer/          ├ 공통 사용
src/firebase/             ┤
src/shared/               ┘
```

## 왜 HTML을 두 개 쓰는가

학생과 교사는 실제 사용 목적이 다릅니다. 학생은 입장/대기/게임만 필요하지만 교사는 관리자 홈, 대기실 제어, 설정, 실시간 게임 현황이 필요합니다.

두 HTML entry를 사용하면:

- 학생 초기 번들에서 교사 관리자 UI를 제외할 수 있습니다.
- 학생/교사 기능 폴더가 서로 import하지 못하도록 architecture check로 강제할 수 있습니다.
- 교사 화면이 커져도 학생 앱의 진입 구조가 복잡해지지 않습니다.
- 공통 게임 엔진/Firebase 코드는 그대로 공유하므로 프로젝트를 두 개 운영하는 중복은 없습니다.

## URL

```text
학생               /
학생 특정 방         /?room=2-3

교사 관리자 홈       /teacher/?room=2-3#/dashboard
교사 멀티 대기실     /teacher/?room=2-3#/lobby
교사 설정            /teacher/?room=2-3#/settings
```

교사 앱 내부는 hash route를 사용합니다. 따라서 `/teacher/`라는 정적 HTML 진입점 하나만 호스팅하면 되고 관리자 하위 메뉴마다 Hosting rewrite를 만들 필요가 없습니다.

## 게임 코드도 역할별로 분리

게임 Registry는 한 `load()`가 아니라 다음 두 진입점을 요구합니다.

```ts
loadStudent: () => import("./MyStudentGame.tsx")
loadTeacher: () => import("./MyTeacherGame.tsx")
```

따라서 학생이 Sentence Builder를 시작하면 학생 게임 UI만 lazy-load하고, 교사용 실시간 통계 UI는 학생 브라우저에서 가져오지 않습니다.

## 보안과는 별개

`/teacher/`를 별도 HTML로 만든 것은 **코드 구조와 번들 분리**를 위한 것입니다. URL을 숨긴다고 교사 권한이 생기는 것은 아닙니다.

현재 베이스는 Firebase Authentication + `admins/{uid}` allow-list + Firestore Security Rules 모델을 포함합니다. 학생도 서버 검증 후 발급된 Firebase custom claims를 사용합니다. 다만 실제 보안은 `SECURITY_SETUP.md`의 Functions 배포와 Rules 병합/배포가 완료되어야 활성화됩니다. `noindex` 메타 태그와 작은 관리자 링크는 접근 제어가 아닙니다.

## 언제 프로젝트 자체를 둘로 나누나

현재 단계에서는 별도 repository나 별도 Vite 프로젝트 두 개로 나눌 이유가 없습니다. 교사와 학생이 같은 게임 엔진, 세션 타입, Firebase 모델을 공유하기 때문입니다.

향후 교사 관리 시스템이 수업 게임과 거의 독립된 대형 백오피스가 되고 배포 주기/팀/도메인까지 달라질 때에만 별도 프로젝트 분리를 검토합니다.
