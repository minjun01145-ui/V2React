/**
 * 앱 공용 글꼴 카탈로그.
 *
 * 슬라이드 편집기가 먼저 사용하지만 슬라이드에 의존하지 않으므로 앱 전체 테마 글꼴로 그대로 재사용할 수 있다.
 * 여기에는 선언만 두고 실제 로드는 `loader.ts`가 필요할 때 지연 수행한다.
 * 모든 항목은 무료(개인·상업용 사용 가능)이며 라이선스 출처를 함께 기록한다.
 */

export type FontCategory = "고딕" | "명조" | "손글씨" | "디스플레이" | "고정폭";

export interface FontFaceFile {
  readonly url: string;
  readonly format: "woff" | "woff2" | "truetype";
  /** 이 파일이 담당하는 굵기. */
  readonly weight: number;
}

export type FontSource =
  /** Google Fonts css2. 유니코드 슬라이스 덕분에 실제로 쓰는 글자 조각만 내려받는다. */
  | { readonly kind: "google"; readonly weights: readonly number[] }
  /** 배포처가 제공하는 완성된 웹폰트 CSS(동적 서브셋 등). */
  | { readonly kind: "stylesheet"; readonly url: string }
  /** 직접 지정한 폰트 파일 목록. */
  | { readonly kind: "faces"; readonly faces: readonly FontFaceFile[] };

export interface FontDefinition {
  readonly id: string;
  /** 드롭다운에 보이는 이름. */
  readonly label: string;
  /** 캔버스 JSON에 저장되는 font stack. */
  readonly family: string;
  /** 로드·측정에 쓰는 실제 패밀리 이름. */
  readonly cssFamily: string;
  readonly category: FontCategory;
  readonly source: FontSource;
  readonly license: string;
  readonly licenseUrl: string;
}

/** 캔버스·앱 기본 글꼴. 카탈로그 첫 항목과 같은 패밀리 스택을 쓴다. */
export const DEFAULT_FONT_FAMILY = "'Noto Sans KR', sans-serif";

const OFL = "SIL Open Font License 1.1 (Google Fonts)";
const google = (weights: readonly number[]): FontSource => ({ kind: "google", weights });
const googleLicense = (family: string): string => `https://fonts.google.com/specimen/${family.replaceAll(" ", "+")}/license`;
const noonnuLicense = (page: number): string => `https://noonnu.cc/font_page/${page}`;

function googleFont(id: string, label: string, cssFamily: string, weight: "hinted" | "plain", category: FontCategory, weights: readonly number[]): FontDefinition {
  return {
    id, label, family: `'${cssFamily}', ${weight === "hinted" ? "sans-serif" : "serif"}`, cssFamily, category, source: google(weights),
    license: OFL, licenseUrl: googleLicense(cssFamily),
  };
}

/** 슬라이드 글상자·앱 테마가 공유하는 글꼴 목록. 순서가 곧 드롭다운 기본 순서다. */
export const FONT_CATALOG: readonly FontDefinition[] = [
  {
    id: "noto-sans-kr", label: "기본 고딕", family: "'Noto Sans KR', sans-serif", cssFamily: "Noto Sans KR", category: "고딕",
    source: google([400, 700, 800]), license: OFL, licenseUrl: googleLicense("Noto Sans KR"),
  },
  {
    id: "pretendard", label: "프리텐다드", family: "'Pretendard', sans-serif", cssFamily: "Pretendard", category: "고딕",
    // 동적 서브셋 CSS: 문서에 실제 등장한 글자만 내려받는다.
    source: { kind: "stylesheet", url: "https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard-dynamic-subset.css" },
    license: "SIL Open Font License 1.1", licenseUrl: "https://github.com/orioncactus/pretendard/blob/main/LICENSE",
  },
  {
    id: "noto-serif-kr", label: "본명조", family: "'Noto Serif KR', serif", cssFamily: "Noto Serif KR", category: "명조",
    source: google([400, 700, 800]), license: OFL, licenseUrl: googleLicense("Noto Serif KR"),
  },
  {
    id: "black-han-sans", label: "검은고딕", family: "'Black Han Sans', sans-serif", cssFamily: "Black Han Sans", category: "디스플레이",
    source: google([400]), license: OFL, licenseUrl: googleLicense("Black Han Sans"),
  },
  {
    id: "jua", label: "주아", family: "'Jua', sans-serif", cssFamily: "Jua", category: "디스플레이",
    source: google([400]), license: OFL, licenseUrl: googleLicense("Jua"),
  },
  {
    id: "nanum-pen-script", label: "나눔손글씨 펜", family: "'Nanum Pen Script', cursive", cssFamily: "Nanum Pen Script", category: "손글씨",
    source: google([400]), license: OFL, licenseUrl: googleLicense("Nanum Pen Script"),
  },
  {
    id: "chosun-gs", label: "궁서", family: "'ChosunGs', 'Gungsuh', '궁서', serif", cssFamily: "ChosunGs", category: "명조",
    // 무료 배포 폰트를 그대로 사용: https://event.chosun.com/100/100font.html
    source: { kind: "faces", faces: [{ url: "https://cdn.jsdelivr.net/gh/projectnoonnu/noonfonts_20-04@1.0/ChosunGs.woff", format: "woff", weight: 400 }] },
    license: "조선일보 100년체 무료 사용 (수정·재판매 금지)", licenseUrl: "https://event.chosun.com/100/100font.html",
  },

  googleFont("nanum-gothic", "나눔고딕", "Nanum Gothic", "hinted", "고딕", [400, 700, 800]),
  {
    id: "nanum-gothic-coding", label: "나눔고딕코딩", family: "'Nanum Gothic Coding', monospace", cssFamily: "Nanum Gothic Coding", category: "고정폭",
    source: google([400, 700]), license: OFL, licenseUrl: googleLicense("Nanum Gothic Coding"),
  },
  googleFont("nanum-myeongjo", "나눔명조", "Nanum Myeongjo", "plain", "명조", [400, 700, 800]),
  googleFont("gowun-dodum", "고운돋움", "Gowun Dodum", "hinted", "고딕", [400]),
  googleFont("gowun-batang", "고운바탕", "Gowun Batang", "plain", "명조", [400, 700]),
  {
    id: "do-hyeon", label: "도현", family: "'Do Hyeon', sans-serif", cssFamily: "Do Hyeon", category: "디스플레이",
    source: google([400]), license: OFL, licenseUrl: googleLicense("Do Hyeon"),
  },
  googleFont("gaegu", "개구", "Gaegu", "hinted", "손글씨", [300, 400, 700]),
  googleFont("hi-melody", "하이멜로디", "Hi Melody", "hinted", "손글씨", [400]),
  googleFont("gamja-flower", "감자꽃", "Gamja Flower", "hinted", "손글씨", [400]),
  {
    id: "poor-story", label: "푸어스토리", family: "'Poor Story', cursive", cssFamily: "Poor Story", category: "디스플레이",
    source: google([400]), license: OFL, licenseUrl: googleLicense("Poor Story"),
  },
  googleFont("sunflower", "해바라기", "Sunflower", "hinted", "고딕", [300, 500, 700]),
  googleFont("song-myung", "송명", "Song Myung", "plain", "명조", [400]),
  googleFont("stylish", "스타일리시", "Stylish", "hinted", "고딕", [400]),
  googleFont("yeon-sung", "연성", "Yeon Sung", "hinted", "손글씨", [400]),
  googleFont("dongle", "동글", "Dongle", "hinted", "고딕", [300, 400, 700]),
  googleFont("gothic-a1", "고딕 A1", "Gothic A1", "hinted", "고딕", [400, 700, 900]),
  googleFont("ibm-plex-sans-kr", "IBM Plex Sans KR", "IBM Plex Sans KR", "hinted", "고딕", [400, 600, 700]),
  googleFont("hahmlet", "함렛", "Hahmlet", "plain", "명조", [400, 700, 900]),
  googleFont("orbit", "오르빗", "Orbit", "hinted", "디스플레이", [400]),
  {
    id: "single-day", label: "싱글데이", family: "'Single Day', cursive", cssFamily: "Single Day", category: "디스플레이",
    source: google([400]), license: OFL, licenseUrl: googleLicense("Single Day"),
  },
  {
    id: "gugi", label: "구기", family: "'Gugi', cursive", cssFamily: "Gugi", category: "디스플레이",
    source: google([400]), license: OFL, licenseUrl: googleLicense("Gugi"),
  },
  googleFont("east-sea-dokdo", "동해독도", "East Sea Dokdo", "hinted", "손글씨", [400]),
  {
    id: "cute-font", label: "큐트폰트", family: "'Cute Font', cursive", cssFamily: "Cute Font", category: "디스플레이",
    source: google([400]), license: OFL, licenseUrl: googleLicense("Cute Font"),
  },
  googleFont("diphylleia", "디필레이아", "Diphylleia", "plain", "명조", [400]),

  {
    id: "jalnan", label: "여기어때 잘난체", family: "'Jalnan', sans-serif", cssFamily: "Jalnan", category: "디스플레이",
    source: { kind: "faces", faces: [{ url: "https://cdn.jsdelivr.net/gh/projectnoonnu/noonfonts_four@1.2/JalnanOTF00.woff", format: "woff", weight: 400 }] },
    license: "개인·기업 무료 사용, 파일 판매 금지", licenseUrl: noonnuLicense(115),
  },
  {
    id: "jalnan-gothic", label: "여기어때 잘난체 고딕", family: "'JalnanGothic', sans-serif", cssFamily: "JalnanGothic", category: "고딕",
    source: { kind: "faces", faces: [{ url: "https://cdn.jsdelivr.net/gh/projectnoonnu/noonfonts_231029@1.1/JalnanGothic.woff", format: "woff", weight: 400 }] },
    license: "개인·기업 무료 사용, 파일 판매 금지", licenseUrl: noonnuLicense(1254),
  },
  {
    id: "s-core-dream", label: "에스코어 드림", family: "'S-Core Dream', sans-serif", cssFamily: "S-Core Dream", category: "고딕",
    source: { kind: "faces", faces: [
      { url: "https://cdn.jsdelivr.net/gh/projectnoonnu/noonfonts_six@1.2/S-CoreDream-4Regular.woff", format: "woff", weight: 400 },
      { url: "https://cdn.jsdelivr.net/gh/projectnoonnu/noonfonts_six@1.2/S-CoreDream-6Bold.woff", format: "woff", weight: 700 },
      { url: "https://cdn.jsdelivr.net/gh/projectnoonnu/noonfonts_six@1.2/S-CoreDream-9Black.woff", format: "woff", weight: 900 },
    ] },
    license: "개인·기업 무료 사용, 재배포 가능(수정·판매 금지)", licenseUrl: noonnuLicense(223),
  },
  {
    id: "gmarket-sans", label: "G마켓 산스", family: "'Gmarket Sans', sans-serif", cssFamily: "Gmarket Sans", category: "고딕",
    source: { kind: "faces", faces: [
      { url: "https://cdn.jsdelivr.net/gh/projectnoonnu/noonfonts_2001@1.1/GmarketSansLight.woff", format: "woff", weight: 300 },
      { url: "https://cdn.jsdelivr.net/gh/projectnoonnu/noonfonts_2001@1.1/GmarketSansMedium.woff", format: "woff", weight: 500 },
      { url: "https://cdn.jsdelivr.net/gh/projectnoonnu/noonfonts_2001@1.1/GmarketSansBold.woff", format: "woff", weight: 700 },
    ] },
    license: "무료 사용(제약 없음)", licenseUrl: noonnuLicense(366),
  },
  {
    id: "kyobo-hand", label: "교보손글씨 2019", family: "'KyoboHand', cursive", cssFamily: "KyoboHand", category: "손글씨",
    source: { kind: "faces", faces: [{ url: "https://cdn.jsdelivr.net/gh/projectnoonnu/noonfonts_20-04@1.0/KyoboHand.woff", format: "woff", weight: 400 }] },
    license: "개인·기업 무료 사용, 수정·재배포·재판매 금지", licenseUrl: noonnuLicense(419),
  },
  {
    id: "ridi-batang", label: "리디바탕", family: "'RIDIBatang', serif", cssFamily: "RIDIBatang", category: "명조",
    source: { kind: "faces", faces: [{ url: "https://cdn.jsdelivr.net/gh/projectnoonnu/noonfonts_twelve@1.0/RIDIBatang.woff", format: "woff", weight: 400 }] },
    license: "개인·기업 무료 사용, 수정·재배포 가능(파일 판매 금지)", licenseUrl: noonnuLicense(324),
  },
  {
    id: "chosunilbo-myeongjo", label: "조선일보명조", family: "'Chosunilbo Myungjo', serif", cssFamily: "Chosunilbo Myungjo", category: "명조",
    source: { kind: "faces", faces: [{ url: "https://cdn.jsdelivr.net/gh/projectnoonnu/noonfonts_one@1.0/Chosunilbo_myungjo.woff", format: "woff", weight: 400 }] },
    license: "개인·기업 무료 사용, 재배포 가능(수정·판매 금지)", licenseUrl: noonnuLicense(63),
  },
  {
    id: "miwon", label: "미원체", family: "'Miwon', sans-serif", cssFamily: "Miwon", category: "디스플레이",
    source: { kind: "faces", faces: [{ url: "https://cdn.jsdelivr.net/gh/projectnoonnu/noonfonts_miwon@1.0/Miwon.woff2", format: "woff2", weight: 400 }] },
    license: "개인·기업 무료 사용(파일 판매·BI/CI 금지)", licenseUrl: noonnuLicense(980),
  },
  {
    id: "suseong-batang", label: "수성바탕", family: "'Suseong Batang', serif", cssFamily: "Suseong Batang", category: "명조",
    source: { kind: "faces", faces: [{ url: "https://cdn.jsdelivr.net/gh/projectnoonnu/noonfonts_2205@1.0/SuseongBatang.woff2", format: "woff2", weight: 400 }] },
    license: "무료 사용(영상·인쇄·웹), 재판매 금지", licenseUrl: noonnuLicense(905),
  },
  {
    id: "gabia-cheongyeon", label: "가비아 청연체", family: "'Gabia Cheongyeon', serif", cssFamily: "Gabia Cheongyeon", category: "명조",
    source: { kind: "faces", faces: [{ url: "https://cdn.jsdelivr.net/gh/projectnoonnu/noonfonts_2205@1.0/GabiaCheongyeon.woff2", format: "woff2", weight: 400 }] },
    license: "개인·기업 무료 사용(상업 목적 포함)", licenseUrl: noonnuLicense(888),
  },
  {
    id: "cafe24-ssurround", label: "카페24 써라운드", family: "'Cafe24 Ssurround', sans-serif", cssFamily: "Cafe24 Ssurround", category: "고딕",
    source: { kind: "faces", faces: [{ url: "https://cdn.jsdelivr.net/gh/projectnoonnu/noonfonts_2105_2@1.0/Cafe24Ssurround.woff", format: "woff", weight: 400 }] },
    license: "개인·기업 무료 사용(상업적 사용 가능, 파일 판매 금지)", licenseUrl: noonnuLicense(669),
  },
];

export const FONT_FAMILY_BY_ID: Readonly<Record<string, string>> = Object.fromEntries(FONT_CATALOG.map((font) => [font.id, font.family]));

/** 드롭다운 그룹 순서. */
export const FONT_CATEGORIES: readonly FontCategory[] = ["고딕", "명조", "손글씨", "디스플레이", "고정폭"];

/** 카테고리별 카탈로그. 선택기·미리보기가 같은 순서를 쓴다. */
export const FONT_GROUPS: readonly { readonly category: FontCategory; readonly fonts: readonly FontDefinition[] }[] =
  FONT_CATEGORIES.map((category) => ({ category, fonts: FONT_CATALOG.filter((font) => font.category === category) }))
    .filter((group) => group.fonts.length > 0);

export function fontById(id: string): FontDefinition {
  const font = FONT_CATALOG.find((item) => item.id === id);
  if (!font) throw new Error(`알 수 없는 글꼴입니다: ${id}`);
  return font;
}

/** 카탈로그 id로 캔버스에 저장할 font stack을 만든다. 양식 정의가 같은 출처를 쓰게 한다. */
export function fontStack(id: string): string {
  return fontById(id).family;
}

/** 캔버스에 저장된 font stack을 카탈로그 항목으로 되돌린다. 모르는 글꼴은 null. */
export function fontForFamilyStack(stack: string): FontDefinition | null {
  const trimmed = stack.trim();
  const exact = FONT_CATALOG.find((font) => font.family === trimmed);
  if (exact) return exact;
  // 부분 글자에 fontFamily만 바뀐 스타일도 있어 패밀리 이름 포함 여부로 되짚는다.
  // 'Nanum Gothic Coding'처럼 더 긴 이름이 짧은 이름에 먼저 걸리지 않도록 긴 것부터 본다.
  const byLength = [...FONT_CATALOG].sort((a, b) => b.cssFamily.length - a.cssFamily.length);
  return byLength.find((font) => trimmed.includes(font.cssFamily)) ?? null;
}
