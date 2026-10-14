import assert from "node:assert/strict";
import { DEFAULT_FONT_FAMILY, FONT_CATALOG, FONT_GROUPS, fontById, fontForFamilyStack, fontStack } from "../src/fonts/catalog.ts";

// 앱 전역 카탈로그: 슬라이드 양식이 여기서 글꼴을 파생하므로 id/스택 유일성과 분류가 유지돼야 한다.
assert.ok(FONT_CATALOG.length >= 30, `카탈로그는 충분한 글꼴을 제공한다(현재 ${FONT_CATALOG.length}종)`);
assert.equal(new Set(FONT_CATALOG.map((font) => font.id)).size, FONT_CATALOG.length, "글꼴 id는 유일하다");
assert.equal(new Set(FONT_CATALOG.map((font) => font.family)).size, FONT_CATALOG.length, "font stack은 유일하다");
assert.equal(new Set(FONT_CATALOG.map((font) => font.cssFamily)).size, FONT_CATALOG.length, "css 패밀리 이름은 유일하다");

for (const font of FONT_CATALOG) {
  assert.ok(font.label.trim().length > 0, `${font.id}: 표시명이 있다`);
  assert.ok(font.family.includes(font.cssFamily), `${font.id}: 스택에 실제 패밀리 이름이 들어 있다`);
  assert.ok(font.license.trim().length > 0, `${font.id}: 라이선스 표기가 있다`);
  assert.ok(font.licenseUrl.startsWith("https://"), `${font.id}: 라이선스 출처가 있다`);
  if (font.source.kind === "google") assert.ok(font.source.weights.length > 0, `${font.id}: 로드 굵기가 지정돼 있다`);
  if (font.source.kind === "stylesheet") assert.ok(font.source.url.startsWith("https://"), `${font.id}: 스타일시트 URL이 있다`);
  if (font.source.kind === "faces") {
    assert.ok(font.source.faces.length > 0, `${font.id}: 폰트 파일이 지정돼 있다`);
    for (const face of font.source.faces) assert.ok(face.url.startsWith("https://"), `${font.id}: 폰트 파일 URL이 있다`);
  }
}

// 기존 6종은 그대로 남아 있어야 한다.
const labels = FONT_CATALOG.map((font) => font.label);
for (const kept of ["기본 고딕", "프리텐다드", "본명조", "검은고딕", "주아", "나눔손글씨 펜", "궁서"]) {
  assert.ok(labels.includes(kept), `기존 글꼴 유지: ${kept}`);
}

// 분류 그룹은 카탈로그를 빠뜨리지 않고 정확히 나눈다.
assert.equal(FONT_GROUPS.flatMap((group) => group.fonts).length, FONT_CATALOG.length, "분류 그룹이 모든 글꼴을 담는다");
assert.ok(FONT_GROUPS.length >= 4, "여러 분류가 있다");

assert.equal(fontById("jua").family, fontStack("jua"));
assert.throws(() => fontById("missing"), /알 수 없는 글꼴/);
assert.equal(fontForFamilyStack(DEFAULT_FONT_FAMILY)?.id, "noto-sans-kr");
assert.equal(fontForFamilyStack("'Nanum Gothic Coding', monospace")?.id, "nanum-gothic-coding", "긴 이름이 짧은 이름에 먼저 걸리지 않는다");
assert.equal(fontForFamilyStack("'Jalnan', sans-serif")?.id, "jalnan");
// 카탈로그에 없는 로컬 글꼴(Arial, PPT 가져오기)은 null이어야 기본 동작을 건드리지 않는다.
assert.equal(fontForFamilyStack("Arial"), null);
assert.equal(fontForFamilyStack("'SlideRegressionLateFont', monospace"), null);
console.log("font catalog tests passed");
