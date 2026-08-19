# Firebase Hosting notes

현재 빌드는 하나의 `dist/` 안에 학생/교사 HTML을 함께 생성합니다.

```text
dist/
  index.html
  teacher/
    index.html
  assets/
    ...
```

따라서 기본적으로 한 Firebase Hosting site에 함께 배포할 수 있습니다.

교사 앱 내부 메뉴는 hash route (`#/dashboard`, `#/lobby`, `#/settings`)이므로 하위 메뉴마다 서버 rewrite가 필요하지 않습니다.

향후 `/teacher/settings`처럼 history API 기반 실제 path routing으로 바꾸면 Firebase Hosting의 rewrite를 `teacher/index.html`로 추가해야 합니다.

기존 Jurye root `firebase.json`에 Hosting을 추가할 때 Functions 설정을 지우지 말고 `hosting` 항목을 병합해야 합니다. 실제 배포 전에 기존 Hosting 설정과 배포 경로를 먼저 확인하세요.

교사와 학생을 서로 다른 도메인으로 완전히 분리해야 할 필요가 생기면 Firebase의 multi-site Hosting도 검토할 수 있지만, 현재 단계에서는 한 site + 두 HTML entry가 더 단순합니다.
