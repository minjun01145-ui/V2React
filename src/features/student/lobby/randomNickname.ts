import type { NicknameGrade } from "../../../multiplayer/types.ts";

export interface RandomNickname {
  readonly nickname: string;
  readonly grade: NicknameGrade;
}

const C_NAMES = `김밥 떡볶이 라면 짜장면 짬뽕 우동 국수 냉면 만두 순대 어묵 튀김 돈까스 카레 볶음밥 비빔밥 김치 깍두기 계란 감자 고구마 양파 대파 마늘 당근 오이 배추 무우 상추 깻잎 버섯 두부 콩알 콩나물 숙주 애호박 가지 옥수수 토마토 사과 배조각 귤주스 바나나 포도 수박 딸기 복숭아 체리 레몬 라임 우유 치즈 버터 모닝빵 식빵 크루아상 쿠키 초콜릿 사탕 젤리 아이스크림 케이크 피자 햄버거 핫도그 샌드위치 토스트 감자튀김 치킨 닭가슴살 소고기 돼지고기 삼겹살 목살 갈비 불고기 제육볶음 김치찌개 된장찌개 미역국 떡국 잡채 계란말이 계란찜 김치볶음밥 주먹밥 유부초밥 참치 연어 고등어 새우 오징어 문어 꽃게 조개 김자반 미역 다시마 소금 설탕 후추 간장 고추장 된장 식초 참기름 들기름 벌꿀 딸기잼 시리얼 요구르트 두유 커피 코코아 녹차 보리차 현미 보리 쌀밥 밀가루 찹쌀 참깨 멸치 슬라이스햄 완자 가래떡 꿀떡 호떡 붕어빵 군밤 약과 식혜 수정과`.split(" ");

const B_NAMES = `타코 부리토 퀘사디아 나초 파스타 라자냐 리조또 뇨키 라비올리 바게트 베이글 프레첼 와플 팬케이크 마카롱 도넛 브라우니 머핀 푸딩 티라미수 카스텔라 츄러스 팝콘 살라미 베이컨 소시지 페퍼로니 모짜렐라 체다치즈 파마산 크림치즈 요거트 아보카도 블루베리 라즈베리 망고 파인애플 키위 자몽 석류 무화과 멜론 코코넛 파프리카 브로콜리 셀러리 아스파라거스 완두콩 렌틸콩 병아리콩 강낭콩 케일 바질 로즈마리 타임 오레가노 민트 계피 생강 고수 월계수잎 메이플시럽 올리브 올리브유 발사믹 머스터드 마요네즈 케첩 핫소스 살사 후무스 피클 할라피뇨 또띠아 쿠스쿠스 오트밀 그래놀라 아몬드 호두 캐슈넛 피스타치오 땅콩버터 코울슬로 과카몰리 타코야키 오코노미야키 야키소바 돈부리 오니기리 소바 라멘 카츠동 규동 텐동 사시미 초밥 월남쌈 쌀국수 팟타이 똠얌꿍 카오팟 커리우동`.split(" ");

const A_NAMES = `부라타치즈 리코타치즈 고르곤졸라 까망베르 브리치즈 프로슈토 판체타 초리조 푸아그라 캐비아 트러플 샤프란 바닐라빈 스타아니스 주니퍼베리 딜허브 타라곤 루콜라 아티초크 엔다이브 펜넬 방울양배추 비트 콜라비 라디키오 차요테 오크라 얌감자 타피오카 퀴노아 치아시드 아마씨 마카다미아 피칸 헤이즐넛 잣죽 대추야자 패션프루트 리치 람부탄 망고스틴 구아바 파파야 두리안 용과 스타프루트 잭프루트 카다멈 강황 큐민 코리앤더씨드 넛맥 정향 타히니 미소 낫토 템페 에다마메 폴렌타 파로 불구르 세몰리나 사워도우 포카치아 치아바타 브리오슈 에클레어 밀푀유 판나코타 젤라토 크렘브륄레 바클라바 카놀리 프랄린 가나슈 마지팬 소르베 콩피 페스토 뵈르블랑 홀랜다이즈 라타투이 부야베스 빠에야 가스파초`.split(" ");

const S_NAMES = `콜리플라워 로마네스코 화이트아스파라거스 블랙트러플 화이트트러플 사프란꽃 불수감 살락 아키 체리모야 사포딜라 핑거라임 모렐버섯 포르치니 마쓰타케 송로버섯 트러플소금 유자후추 성게알 보타르가 가쓰오부시 가람마살라 산초 화자오 통카빈 아마레나체리 마라스키노체리 페피타 프리케 테프 아마란스 스펠트 카무트 우메보시 유바 곤약 나메코 쿠로마메 금귤 카카오닙스 몰돈소금 죽순꽃송이 노루궁뎅이버섯 송이버섯 흑마늘 홍화씨 캐롭 파바빈 사차인치`.split(" ");

const gradeGroups: ReadonlyArray<{
  readonly grade: NicknameGrade;
  readonly weight: number;
  readonly names: readonly string[];
}> = [
  { grade: "C", weight: 60, names: C_NAMES },
  { grade: "B", weight: 25, names: B_NAMES },
  { grade: "A", weight: 12, names: A_NAMES },
  { grade: "S", weight: 3, names: S_NAMES },
];

export const RANDOM_NICKNAME_POOL: readonly RandomNickname[] = gradeGroups.flatMap(({ grade, names }) =>
  names.map((nickname) => ({ nickname, grade })),
);

function chooseIndex(length: number, random: () => number): number {
  return Math.min(length - 1, Math.floor(Math.max(0, Math.min(0.999999999, random())) * length));
}

export function pickRandomNickname(
  usedNicknames: ReadonlySet<string>,
  random: () => number = Math.random,
): RandomNickname {
  const availableGroups = gradeGroups
    .map((group) => ({ ...group, names: group.names.filter((name) => !usedNicknames.has(name)) }))
    .filter((group) => group.names.length > 0);
  if (availableGroups.length === 0) throw new Error("사용할 수 있는 랜덤 닉네임이 없습니다.");

  const totalWeight = availableGroups.reduce((sum, group) => sum + group.weight, 0);
  let roll = random() * totalWeight;
  const fallbackGroup = availableGroups.at(-1);
  if (!fallbackGroup) throw new Error("사용할 수 있는 랜덤 닉네임이 없습니다.");
  const group = availableGroups.find((item) => {
    roll -= item.weight;
    return roll < 0;
  }) ?? fallbackGroup;
  const nickname = group.names[chooseIndex(group.names.length, random)];
  if (!nickname) throw new Error("랜덤 닉네임을 선택하지 못했습니다.");
  return { nickname, grade: group.grade };
}
