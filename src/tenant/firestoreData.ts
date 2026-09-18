import { collection, doc, type CollectionReference, type DocumentReference } from "firebase/firestore";
import { db } from "../firebase/firebaseClient.ts";
import { PRIMARY_TENANT_ID, type TenantId } from "./scope.ts";

export function tenantLearningSetsCollection(tenantId: TenantId): CollectionReference {
  return tenantId === PRIMARY_TENANT_ID
    ? collection(db, "learningSets")
    : collection(db, "tenants", tenantId, "learningSets");
}

export function tenantLearningSetRef(tenantId: TenantId, setId: string): DocumentReference {
  return doc(tenantLearningSetsCollection(tenantId), setId);
}

export function tenantQuizPlansCollection(tenantId: TenantId): CollectionReference {
  return tenantId === PRIMARY_TENANT_ID
    ? collection(db, "quizGamePlans")
    : collection(db, "tenants", tenantId, "quizGamePlans");
}

export function tenantQuizPlanRef(tenantId: TenantId, planId: string): DocumentReference {
  return doc(tenantQuizPlansCollection(tenantId), planId);
}
