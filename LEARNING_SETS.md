# 학습 세트

교사용 `학습 세트` 화면은 엑셀 또는 Google Sheets의 두 열을 붙여넣어 게임용 자료를 저장합니다.

## 지원 타입

- `vocabulary`: 왼쪽 열 단어·표현, 오른쪽 열 뜻
- `reading-chunks`: 왼쪽 열 `/`로 나눈 문장 조각, 오른쪽 열 뜻. 뜻도 같은 개수로 나누면 덩어리 객관식을 만들 수 있음

첫 행이 `단어 / 뜻`, `문장 / 뜻`, `word / meaning`과 같은 머리글이면 자동으로 제외합니다. 한 세트에는 최대 500개 항목을 저장하며 Firestore 단일 문서 제한을 넘지 않도록 전체 입력 크기도 검사합니다.

```text
단어	뜻
apple	사과
classroom	교실
```

```text
문장	뜻
I go / to school.	나는 간다 / 학교에.
She likes / this book.	그녀는 좋아한다 / 이 책을.
```

## Firestore 구조

```text
learningSets/{setId}                 # 이름, 타입, 문항 수, 수정 시각
learningSets/{setId}/content/main    # 실제 items 배열
```

목록 조회 시 큰 문항 배열을 내려받지 않습니다. 교사 편집 또는 게임 시작 때 선택된 세트의 `content/main` 한 문서만 추가로 읽습니다. 게임 세션에는 전체 세트가 아니라 `setId`만 저장합니다.

학습 자료에는 개인정보나 비밀값을 넣지 않습니다. 읽기는 공개되어 있으며 생성·수정·삭제만 `admins/{uid}`에 등록된 관리자에게 허용됩니다.

## 게임 연결

현재 `reading-chunks` 타입은 문장 만들기 게임에 연결됩니다. 교사용 게임 대기실에서 세트를 선택한 뒤 시작하면 학생과 교사 게임 모듈이 같은 `setId`를 지연 로딩합니다. 새 라운드가 시작되면 같은 ID도 다시 읽어 최신 저장 내용을 사용합니다. `vocabulary` 타입은 이후 단어형 게임이 추가될 때 같은 저장소 인터페이스를 재사용합니다.

`multipleChoiceAdapter.ts`는 단어·뜻 양방향, 끊어읽기 전체 문장 양방향, 대응 덩어리 양방향을 2~5지선다 공통 문제로 변환합니다. 전체 문장 모드는 양쪽의 `/`를 제거합니다. 덩어리 모드는 영어와 뜻의 덩어리 개수가 같은 항목만 허용합니다.

새 타입을 추가할 때는 다음을 함께 추가합니다.

1. `src/learning-sets/types.ts` 타입 상수와 표시 이름
2. `src/learning-sets/validation.ts` 타입별 붙여넣기 검증
3. 해당 게임의 adapter와 `supportedSetTypes`
4. 순수 parser/adapter 테스트
