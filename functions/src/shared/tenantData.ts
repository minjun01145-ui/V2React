import type { CollectionReference } from "firebase-admin/firestore";
import { db } from "./firebase.js";
import { PRIMARY_TENANT_ID, type TenantId } from "./tenant.js";

export function tenantLearningSetsCollection(tenantId: TenantId): CollectionReference {
  return tenantId === PRIMARY_TENANT_ID
    ? db.collection("learningSets")
    : db.collection("tenants").doc(tenantId).collection("learningSets");
}
