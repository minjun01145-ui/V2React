import test from "node:test";
import assert from "node:assert/strict";
import { parseSettings, paneBounds, GRID } from "../settings.mjs";

test("teacher and regular students use the same site, room, and tenant", () => {
  const settings = parseSettings({ siteUrl: "http://localhost:5173/?room=practice&tenant=hana" });
  const teacher = new URL(settings.teacherUrl);
  const student = new URL(settings.studentUrl);
  assert.equal(student.pathname, "/");
  assert.equal(teacher.pathname, "/teacher/");
  assert.equal(teacher.hash, "#/lobby");
  assert.equal(student.origin, teacher.origin);
  assert.equal(student.search, teacher.search);
});

test("invalid settings cannot select the old test-student entry or privileged URL schemes", () => {
  for (const siteUrl of ["", "not a URL", "file:///C:/game/index.html", "javascript:alert(1)", "https://name:pin@example.com/", "https://example.com/test-student/", "https://example.com/teacher/"]) {
    assert.throws(() => parseSettings({ siteUrl }));
  }
  for (const value of [null, [], {}, { siteUrl: 123 }]) assert.throws(() => parseSettings(value));
});

test("four browser areas fit the window without covering headers or borders", () => {
  for (const [width, height] of [[1000, 700], [1600, 1000], [1537, 919]]) {
    const panes = [0, 1, 2, 3].map((index) => paneBounds(width, height, index));
    for (const { outer, content } of panes) {
      assert.ok(outer.y >= GRID.toolbar + GRID.margin);
      assert.equal(content.x, outer.x + GRID.border);
      assert.equal(content.y, outer.y + GRID.border + GRID.header);
      assert.equal(content.x + content.width, outer.x + outer.width - GRID.border);
      assert.equal(content.y + content.height, outer.y + outer.height - GRID.border);
      assert.ok(content.width > 0 && content.height > 0);
    }
    assert.equal(panes[0].outer.x, panes[2].outer.x);
    assert.equal(panes[1].outer.x, panes[3].outer.x);
    assert.equal(panes[0].outer.y, panes[1].outer.y);
    assert.equal(panes[2].outer.y, panes[3].outer.y);
    assert.equal(panes[1].outer.x - panes[0].outer.x - panes[0].outer.width, GRID.gap);
    assert.equal(panes[2].outer.y - panes[0].outer.y - panes[0].outer.height, GRID.gap);
    assert.equal(panes[3].outer.x + panes[3].outer.width, width - GRID.margin);
    assert.equal(panes[3].outer.y + panes[3].outer.height, height - GRID.margin);
  }
});

test("each single-screen mode fills the window below the view menu", () => {
  for (const [width, height] of [[1000, 700], [1600, 1000], [1537, 919]]) {
    for (const mode of [0, 1, 2, 3]) {
      const { outer, content } = paneBounds(width, height, mode, mode);
      assert.deepEqual(outer, { x: GRID.margin, y: GRID.toolbar + GRID.margin, width: width - GRID.margin * 2, height: height - GRID.toolbar - GRID.margin * 2 });
      assert.equal(content.y, outer.y + GRID.border + GRID.header);
      assert.equal(content.y + content.height, height - GRID.margin - GRID.border);
    }
  }
});
