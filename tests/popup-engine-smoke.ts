import assert from "node:assert/strict";
import fs from "node:fs";
import { createPopupInputValues, validatePopupInputValues } from "../src/shared/popup/inputModel.ts";
import type { PopupInputField } from "../src/shared/popup/types.ts";

const fields: readonly PopupInputField[] = [
  { name: "pin", label: "비밀번호", type: "password", pattern: "[0-9０-９]{4}", maxLength: 4 },
  { name: "pinConfirmation", label: "비밀번호 확인", type: "password", pattern: "[0-9０-９]{4}", maxLength: 4 },
];
const initial = createPopupInputValues(fields);
assert.deepEqual(initial, { pin: "", pinConfirmation: "" });
assert.match(validatePopupInputValues(fields, initial) ?? "", /비밀번호/);
assert.equal(validatePopupInputValues(fields, { pin: "１２３４", pinConfirmation: "１２３４" }), null);
assert.match(validatePopupInputValues(fields, { pin: "123", pinConfirmation: "1234" }) ?? "", /형식/);
assert.match(validatePopupInputValues([{ ...fields[0]!, name: "same" }, { ...fields[1]!, name: "same" }], { same: "1234" }) ?? "", /구성/);

const frameSource = fs.readFileSync(new URL("../src/shared/popup/PopupFrame.tsx", import.meta.url), "utf8");
const hostSource = fs.readFileSync(new URL("../src/shared/popup/PopupHost.tsx", import.meta.url), "utf8");
assert.ok(frameSource.includes('role="dialog"') && frameSource.includes('aria-modal="true"'));
assert.ok(frameSource.includes("FOCUSABLE") && frameSource.includes('"Tab"') && frameSource.includes('"Escape"'));
assert.ok(hostSource.includes("createPortal") && hostSource.includes("MessagePopup") && hostSource.includes("ConfirmPopup") && hostSource.includes("InputPopup"));

const sourceFiles = [
  "../src/features/teacher/students/TeacherStudentsPage.tsx",
  "../src/features/teacher/sets/TeacherSetsPage.tsx",
  "../src/features/teacher/lobby/TeacherLobbyPage.tsx",
  "../src/games/sentence-builder/StudentSentenceBuilder.tsx",
].map((path) => fs.readFileSync(new URL(path, import.meta.url), "utf8"));
assert.ok(sourceFiles.every((source) => !/window\.(alert|confirm|prompt)\s*\(/.test(source)));

console.log("popup engine tests passed");
