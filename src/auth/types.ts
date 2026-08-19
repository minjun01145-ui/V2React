export interface StudentCredentials {
  readonly studentNumber: string;
  readonly name: string;
}

/** Authentication identity only. Do not add badges, stats, inventory, or game progress here. */
export interface StudentIdentity {
  readonly uid: string;
  readonly studentNumber: string;
  readonly displayName: string;
}

export interface AdminSession {
  readonly uid: string;
  readonly email: string;
}

export interface AuthState<T> {
  readonly value: T | null;
  readonly loading: boolean;
  readonly error: Error | null;
}
