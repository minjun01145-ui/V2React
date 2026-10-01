import {
  onChildAdded,
  ref,
  runTransaction,
  serverTimestamp,
  type DataSnapshot,
  type Database,
  type Unsubscribe,
} from "firebase/database";
import type { TenantId } from "../tenant/scope.ts";
import type { LiveWorldScope } from "./core/types.ts";
import { liveChannelPath, livePathSegment } from "./paths.ts";

/**
 * First-come claims on shared, deterministic objects (e.g. items every client
 * spawns from the same seed). The database transaction plus rules guarantee a
 * claim id is taken exactly once.
 */
export interface LiveClaim {
  readonly id: string;
  readonly by: string;
  readonly atMs: number;
}

export interface LiveClaims {
  /** Resolves true when this player won the claim. */
  claim(id: string): Promise<boolean>;
  close(): void;
}

function parseClaim(snapshot: DataSnapshot): LiveClaim | null {
  const id = snapshot.key;
  const raw: unknown = snapshot.val();
  if (!id || typeof raw !== "object" || raw === null) return null;
  const { by, t } = raw as Record<string, unknown>;
  return typeof by === "string" && by && typeof t === "number" && Number.isFinite(t) ? { id, by, atMs: t } : null;
}

export function connectLiveClaims(
  database: Database,
  tenantId: TenantId,
  scope: LiveWorldScope,
  playerId: string | null,
  onClaim: (claim: LiveClaim) => void,
  onError: (error: Error) => void,
): LiveClaims {
  const claimsPath = `${liveChannelPath(tenantId, scope)}/claims`;
  let closed = false;
  const unsubscribe: Unsubscribe = onChildAdded(ref(database, claimsPath), (snapshot) => {
    const claim = parseClaim(snapshot);
    if (claim && !closed) onClaim(claim);
  }, (error) => { if (!closed) onError(error); });

  return {
    async claim(id: string): Promise<boolean> {
      if (closed || !playerId) return false;
      const claimRef = ref(database, `${claimsPath}/${livePathSegment(id, "claimId")}`);
      try {
        const result = await runTransaction(claimRef, (current: unknown) => current === null
          ? { by: playerId, t: serverTimestamp() }
          : undefined, { applyLocally: false });
        const value: unknown = result.snapshot.val();
        return result.committed && typeof value === "object" && value !== null && (value as Record<string, unknown>).by === playerId;
      } catch {
        // Losing a race can surface as a permission error because the slot already exists.
        return false;
      }
    },
    close(): void {
      closed = true;
      unsubscribe();
    },
  };
}
