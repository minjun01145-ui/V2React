import assert from "node:assert/strict";
import { firebaseAppName } from "../src/firebase/appScope.ts";
import {
  effectiveTenantId,
  PRIMARY_TENANT_ID,
  scopeRoomId,
  SECONDARY_TENANT_ID,
  tenantAccountId,
  tenantStudentKey,
} from "../src/tenant/scope.ts";

assert.equal(effectiveTenantId(undefined), PRIMARY_TENANT_ID, "legacy data without tenantId stays in the primary tenant");
assert.equal(effectiveTenantId(SECONDARY_TENANT_ID), SECONDARY_TENANT_ID);
assert.throws(() => effectiveTenantId("typo-tenant"), /등록되지 않은 사용자/);

assert.equal(tenantStudentKey(PRIMARY_TENANT_ID, "30101"), "30101", "primary roster IDs stay backward compatible");
assert.equal(tenantStudentKey(SECONDARY_TENANT_ID, "30101"), "hana--30101");
assert.equal(tenantAccountId(PRIMARY_TENANT_ID, "30101"), "30101", "primary game-data IDs stay backward compatible");
assert.equal(tenantAccountId(SECONDARY_TENANT_ID, "30101"), "hana--30101");

assert.equal(scopeRoomId(PRIMARY_TENANT_ID, "main-class"), "main-class", "primary room IDs stay backward compatible");
assert.equal(scopeRoomId(SECONDARY_TENANT_ID, "main-class"), "hana--main-class");
assert.equal(scopeRoomId(SECONDARY_TENANT_ID, "hana--main-class"), "hana--main-class", "room scoping is idempotent");
assert.ok(scopeRoomId(SECONDARY_TENANT_ID, "x".repeat(128)).length <= 64);

for (const role of ["student", "teacher"] as const) {
  assert.equal(firebaseAppName(role, PRIMARY_TENANT_ID), `jurye-${role}`, "기존 민준쌤 로그인 저장소를 유지합니다.");
  assert.notEqual(firebaseAppName(role, SECONDARY_TENANT_ID), firebaseAppName(role, PRIMARY_TENANT_ID), "tenant 사이에 로그인 상태를 공유하지 않습니다.");
}
assert.notEqual(firebaseAppName("student", SECONDARY_TENANT_ID), firebaseAppName("teacher", SECONDARY_TENANT_ID), "하나쌤 교사와 학생 로그인도 분리합니다.");

console.log("tenant scope tests passed");
