import { deleteUser, onAuthStateChanged, signInAnonymously, signOut, type Unsubscribe, type User } from "firebase/auth";
import { doc, getDoc, onSnapshot, type DocumentData, type DocumentSnapshot } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { auth, db, functions } from "../firebase/firebaseClient.ts";
import type { StudentCredentials, StudentIdentity, StudentLoginChallenge, StudentPinCredentials } from "./types.ts";
import { validateStudentCredentials, validateStudentPin } from "./validation.ts";

const studentIdentityRef = (uid: string) => doc(db, "studentProfiles", uid);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseStudentIdentity(snapshot: DocumentSnapshot<DocumentData>): StudentIdentity | null {
  if (!snapshot.exists()) return null;
  const raw: unknown = snapshot.data();
  if (!isRecord(raw)) return null;
  const uid = typeof raw.uid === "string" ? raw.uid : snapshot.id;
  const studentNumber = typeof raw.studentNumber === "string" ? raw.studentNumber : "";
  const displayName = typeof raw.displayName === "string" ? raw.displayName : "";
  if (!uid || !studentNumber || !displayName) return null;
  return { uid, studentNumber, displayName };
}

async function anonymousUser(): Promise<User> {
  const current = auth.currentUser;
  if (current?.isAnonymous) return current;
  if (current) await signOut(auth);
  const credential = await signInAnonymously(auth);
  return credential.user;
}

export async function prepareStudentLogin(credentials: StudentCredentials): Promise<StudentLoginChallenge> {
  const validated = validateStudentCredentials(credentials.studentNumber, credentials.name);
  await anonymousUser();
  const callable = httpsCallable<typeof validated, {
    readonly mode: "pin_setup" | "pin_required";
    readonly studentNumber: string;
    readonly displayName: string;
  }>(functions, "prepareStudentLogin");
  const response = await callable(validated);
  return {
    studentNumber: response.data.studentNumber,
    name: validated.name,
    displayName: response.data.displayName,
    mode: response.data.mode,
  };
}

export async function completeStudentLogin(credentials: StudentPinCredentials): Promise<StudentIdentity> {
  const validated = validateStudentCredentials(credentials.studentNumber, credentials.name);
  const pin = validateStudentPin(credentials.pin);
  const user = await anonymousUser();
  const callable = httpsCallable<typeof validated & { readonly pin: string }, {
    readonly studentNumber: string;
    readonly displayName: string;
    readonly pinWasCreated: boolean;
  }>(functions, "completeStudentLogin");
  const response = await callable({ ...validated, pin });
  await user.getIdToken(true);
  return {
    uid: user.uid,
    studentNumber: response.data.studentNumber,
    displayName: response.data.displayName,
  };
}

export async function loadStudentIdentity(uid: string): Promise<StudentIdentity | null> {
  return parseStudentIdentity(await getDoc(studentIdentityRef(uid)));
}

export function subscribeStudentIdentity(uid: string, onValue: (identity: StudentIdentity | null) => void, onError: (error: Error) => void): Unsubscribe {
  return onSnapshot(studentIdentityRef(uid), (snapshot) => onValue(parseStudentIdentity(snapshot)), onError);
}

export function subscribeStudentAuth(onValue: (user: User | null) => void): Unsubscribe {
  return onAuthStateChanged(auth, onValue);
}

export async function clearStudentLogin(): Promise<void> {
  const current = auth.currentUser;
  if (!current) return;
  if (current.isAnonymous) {
    try {
      const release = httpsCallable<Record<string, never>, { readonly ok: boolean }>(functions, "releaseStudentIdentity");
      await release({});
      await deleteUser(current);
      return;
    } catch {
      // A network/auth failure should not trap a student in a local session.
    }
  }
  await signOut(auth);
}
