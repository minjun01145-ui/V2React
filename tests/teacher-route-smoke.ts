import assert from "node:assert/strict";
import { getTeacherView, TEACHER_VIEW, teacherHref } from "../src/apps/teacher/teacherRoute.ts";

assert.equal(getTeacherView(""), TEACHER_VIEW.DASHBOARD);
assert.equal(getTeacherView("#/lobby"), TEACHER_VIEW.LOBBY);
assert.equal(getTeacherView("#/settings"), TEACHER_VIEW.SETTINGS);
assert.equal(getTeacherView("#/students"), TEACHER_VIEW.STUDENTS);
assert.equal(getTeacherView("#/unknown"), TEACHER_VIEW.DASHBOARD);
assert.equal(teacherHref(TEACHER_VIEW.LOBBY), "#/lobby");
assert.equal(teacherHref(TEACHER_VIEW.STUDENTS), "#/students");

console.log("teacher route smoke tests passed");
