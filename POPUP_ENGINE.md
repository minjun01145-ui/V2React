# 사이트 팝업 엔진

브라우저의 `alert()`, `confirm()`, `prompt()` 대신 애플리케이션 디자인 안에서 메시지, 확인, 입력을 처리합니다.

```text
PopupProvider
    ↓ FIFO queue
PopupHost → React portal(document.body)
    ↓
PopupFrame                 # dialog, focus trap, ESC, scroll lock, backdrop/blur
    ├── MessagePopup       # 확인 후 닫기
    ├── ConfirmPopup       # 확인 또는 취소
    └── InputPopup         # 하나 이상의 입력, 검증, 비동기 제출
```

학생 앱과 교사 앱은 각각 최상위에 `PopupProvider`를 한 번만 둡니다. 도메인 컴포넌트는 `usePopup()`의 Promise API를 사용하며 portal, z-index, 포커스 처리나 디자인을 직접 구현하지 않습니다.

## 메시지 팝업

```ts
await showMessage({
  title: "저장 완료",
  message: "학습 세트를 저장했습니다.",
  tone: "success",
  blurBackground: false,
});
```

## 입력 팝업

```ts
const values = await requestInput({
  title: "이름 입력",
  fields: [{ name: "name", label: "이름", maxLength: 30 }],
  validate: (input) => input.name?.trim() ? null : "이름을 입력해 주세요.",
});
```

입력 팝업은 여러 필드, HTML 입력 제약, 동기 검증, 비동기 `onConfirm`, 서버 오류의 팝업 내부 표시, 오류 시 값 초기화, 취소 허용 여부를 지원합니다. 취소하면 `null`을 반환합니다.

## 확인 팝업

```ts
const confirmed = await requestConfirmation({
  title: "정말 삭제할까요?",
  message: "이 작업은 되돌릴 수 없습니다.",
  tone: "error",
  confirmLabel: "삭제",
});
```

확인을 누르면 `true`, 취소·ESC를 누르면 `false`를 반환합니다.

## 공통 옵션

- `blurBackground`: 배경 화면 블러 적용 여부. 기본값 `true`
- `closeOnBackdrop`: 배경 클릭 닫기. 기본값 `false`
- `closeOnEscape`: ESC 닫기. 기본값 `true`
- `tone`: `info`, `success`, `warning`, `error`
- `eyebrow`, `title`, `message`: 공통 헤더

팝업 요청이 동시에 여러 개 들어오면 FIFO 큐로 한 개씩 표시합니다. 요청 ID를 React key로 사용하므로 같은 종류의 입력 팝업이 연속되어도 이전 상태가 남지 않습니다.

## 접근성

- `role="dialog"`, `aria-modal="true"`, 제목/설명 연결
- 열릴 때 첫 입력 또는 확인 버튼으로 포커스 이동
- Tab/Shift+Tab 포커스 가두기
- 닫힐 때 이전 요소로 포커스 복귀
- 팝업 동안 body 스크롤 잠금
- 작은 화면에서는 하단 시트 형태로 표시
- `prefers-reduced-motion` 지원
