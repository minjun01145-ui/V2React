import assert from "node:assert/strict";
import { getTeacherView, TEACHER_VIEW, teacherHref } from "../src/apps/teacher/teacherRoute.ts";

assert.equal(getTeacherView(""), TEACHER_VIEW.DASHBOARD);
assert.equal(getTeacherView("#/lobby"), TEACHER_VIEW.LOBBY);
assert.equal(getTeacherView("#/settings"), TEACHER_VIEW.SETTINGS);
assert.equal(getTeacherView("#/students"), TEACHER_VIEW.STUDENTS);
assert.equal(getTeacherView("#/sets"), TEACHER_VIEW.SETS);
assert.equal(getTeacherView("#/ai"), TEACHER_VIEW.AI);
assert.equal(getTeacherView("#/test-tool"), TEACHER_VIEW.TEST_TOOL);
assert.equal(getTeacherView("#/unknown"), TEACHER_VIEW.DASHBOARD);
assert.equal(teacherHref(TEACHER_VIEW.LOBBY), "#/lobby");
assert.equal(teacherHref(TEACHER_VIEW.STUDENTS), "#/students");
assert.equal(teacherHref(TEACHER_VIEW.SETS), "#/sets");
assert.equal(teacherHref(TEACHER_VIEW.AI), "#/ai");
assert.equal(teacherHref(TEACHER_VIEW.TEST_TOOL), "#/test-tool");

console.log("teacher route smoke tests passed");
