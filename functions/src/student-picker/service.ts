import { randomUUID } from "node:crypto";
import { generateAiReply } from "../ai/service.js";
import { db } from "../shared/firebase.js";
import { isRecord } from "../shared/validation.js";
import { activePickCandidates, getPickDate, parseDateCalculation, resolveDatePick, StudentPickError } from "./model.js";

async function readCandidates(roomId: string) {
  const room = db.collection("multiplayerSessions").doc(roomId);
  const [session, players] = await Promise.all([room.get(), room.collection("players").get()]);
  const raw: unknown = session.data();
  if (!isRecord(raw) || !isRecord(raw.slideShow) || typeof raw.slideShow.runId !== "string" || !raw.slideShow.runId || (raw.status !== "playing" && raw.status !== "preparing")) throw new StudentPickError("진행 중인 슬라이드쇼에서 뽑아 주세요.");
  const candidates = activePickCandidates(players.docs.map((player) => ({ id: player.id, data: player.data() as unknown })), Date.now());
  if (candidates.length === 0) throw new StudentPickError("접속한 학생이 없습니다.");
  return { candidates, runId: raw.slideShow.runId };
}

export async function generateDateStudentPick(roomId: string) {
  const initial = await readCandidates(roomId);
  const date = getPickDate();
  const reply = await generateAiReply([
    { role: "system", content: [
      "너는 교실에서 날짜로 어이없고 재미있는 학생 뽑기 계산을 만드는 진행자다. 학생을 놀리거나 비하하지 마라.",
      "매번 다른 엉뚱한 사물/상황을 상상하여 한국어 제목과 계산별 짧은 이유를 만들어라. 정답을 직접 고르지 마라.",
      "시작값은 오늘의 월(month)이다. 2~6개 연산을 순서대로 수행하며 operand에 day를 반드시 한 번 이상 사용해라.",
      "operator는 add, subtract, multiply, divide, remainder만 허용한다. operand는 month, day 또는 -1000~1000 정수다. 0으로 나누지 말고 중간 결과의 절댓값을 10억 이하로 유지해라.",
      "서버가 최종값의 절댓값에서 정수 부분을 취해 접속 인원수로 나눈 나머지로 실제 접속 학생을 고른다.",
      'JSON만 응답: {"title":"우주 감자의 출근길","steps":[{"operator":"multiply","operand":"day","reason":"감자가 오늘 날짜만큼 구른다"},{"operator":"add","operand":7,"reason":"양말 일곱 짝이 합류한다"}]}',
      "title은 100자 이하, reason은 각 100자 이하.",
    ].join("\n") },
    { role: "user", content: `오늘은 ${date.date}, month=${date.month}, day=${date.day}. 접속 인원 ${initial.candidates.length}명. 이번 뽑기 구분값 ${randomUUID()}. 새로운 계산을 만들어라.` },
  ], { minimumOutputTokens: 1024 });
  const calculation = parseDateCalculation(reply.reply, date);
  // AI can take a while: use the live roster again rather than selecting a disconnected student.
  const latest = await readCandidates(roomId);
  if (latest.runId !== initial.runId) throw new StudentPickError("슬라이드쇼가 바뀌었습니다. 다시 뽑아 주세요.");
  return resolveDatePick(calculation, latest.candidates, date);
}
