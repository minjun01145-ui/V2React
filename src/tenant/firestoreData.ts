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

export function tenantSlideShowsCollection(tenantId: TenantId): CollectionReference {
  return tenantId === PRIMARY_TENANT_ID
    ? collection(db, "slideShows")
    : collection(db, "tenants", tenantId, "slideShows");
}

export function tenantSlideShowRef(tenantId: TenantId, showId: string): DocumentReference {
  return doc(tenantSlideShowsCollection(tenantId), showId);
}

export function tenantSlideShowSlidesCollection(tenantId: TenantId, showId: string): CollectionReference {
  return collection(tenantSlideShowRef(tenantId, showId), "slides");
}
