import assert from "node:assert/strict";
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

console.log("popup engine tests passed");
