export const GRID = Object.freeze({ margin: 8, gap: 8, border: 3, header: 36, toolbar: 52 });

export function parseSettings(raw) {
  if (!raw || typeof raw !== "object" || typeof raw.siteUrl !== "string") {
    throw new Error("config.json의 siteUrl에 학생 사이트 주소를 입력해 주세요.");
  }
  let student;
  try {
    student = new URL(raw.siteUrl.trim());
  } catch {
    throw new Error("siteUrl은 http:// 또는 https://로 시작하는 주소여야 합니다.");
  }
  if (!["http:", "https:"].includes(student.protocol) || student.username || student.password) {
    throw new Error("siteUrl에는 로그인 정보가 없는 HTTP/HTTPS 주소를 입력해 주세요.");
  }
  if (!["/", "/index.html"].includes(student.pathname)) {
    throw new Error("siteUrl에는 /teacher/나 /test-student/가 아닌 일반 학생 사이트 주소를 입력해 주세요.");
  }
  student.pathname = "/";
  student.hash = "";
  const teacher = new URL(student);
  teacher.pathname = "/teacher/";
  teacher.hash = "/lobby";
  return { studentUrl: student.href, teacherUrl: teacher.href };
}

export function paneBounds(width, height, index, mode = "grid") {
  const { margin, gap, border, header, toolbar } = GRID;
  const availableWidth = width - margin * 2 - gap;
  const availableHeight = height - toolbar - margin * 2 - gap;
  const leftWidth = Math.floor(availableWidth / 2);
  const topHeight = Math.floor(availableHeight / 2);
  const right = index % 2 === 1;
  const bottom = index >= 2;
  const outer = mode === "grid" ? {
    x: margin + (right ? leftWidth + gap : 0),
    y: toolbar + margin + (bottom ? topHeight + gap : 0),
    width: right ? availableWidth - leftWidth : leftWidth,
    height: bottom ? availableHeight - topHeight : topHeight,
  } : { x: margin, y: toolbar + margin, width: width - margin * 2, height: height - toolbar - margin * 2 };
  return {
    outer,
    content: {
      x: outer.x + border,
      y: outer.y + border + header,
      width: Math.max(1, outer.width - border * 2),
      height: Math.max(1, outer.height - border * 2 - header),
    },
  };
}
