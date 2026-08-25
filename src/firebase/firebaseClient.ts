import { getApps, initializeApp, type FirebaseApp, type FirebaseOptions } from "firebase/app";
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from "firebase/app-check";
import { browserLocalPersistence, browserSessionPersistence, getAuth, inMemoryPersistence, initializeAuth, type Auth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getFunctions } from "firebase/functions";

function required(value: unknown, label: string): string {
  const normalized = String(value ?? "").trim();
  if (!normalized) throw new Error(`Missing Firebase configuration: ${label}. Copy .env.example to .env.local and fill it in.`);
  return normalized;
}

const firebaseConfig: FirebaseOptions = {
  apiKey: required(import.meta.env.VITE_FIREBASE_API_KEY, "VITE_FIREBASE_API_KEY"),
  authDomain: required(import.meta.env.VITE_FIREBASE_AUTH_DOMAIN, "VITE_FIREBASE_AUTH_DOMAIN"),
  projectId: required(import.meta.env.VITE_FIREBASE_PROJECT_ID, "VITE_FIREBASE_PROJECT_ID"),
  storageBucket: required(import.meta.env.VITE_FIREBASE_STORAGE_BUCKET, "VITE_FIREBASE_STORAGE_BUCKET"),
  messagingSenderId: required(import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID, "VITE_FIREBASE_MESSAGING_SENDER_ID"),
  appId: required(import.meta.env.VITE_FIREBASE_APP_ID, "VITE_FIREBASE_APP_ID"),
};

type AppRole = "student" | "teacher" | "test-student";

function currentRole(): AppRole {
  if (typeof window !== "undefined" && /(^|\/)teacher(\/|$)/.test(window.location.pathname)) return "teacher";
  if (typeof window !== "undefined" && /(^|\/)test-student(\/|$)/.test(window.location.pathname)) return "test-student";
  return "student";
}

function testStudentSlot(): string {
  if (typeof window === "undefined") return "0";
  const slot = new URLSearchParams(window.location.search).get("slot") ?? "0";
  return /^[1-3]$/.test(slot) ? slot : "0";
}

const role = currentRole();
const appName = role === "test-student" ? `jurye-test-student-${testStudentSlot()}` : `jurye-${role}`;
const existing = getApps().find((app) => app.name === appName);
export const firebaseApp: FirebaseApp = existing ?? initializeApp(firebaseConfig, appName);

function createAuth(): Auth {
  try {
    const persistence = role === "teacher"
      ? browserSessionPersistence
      : role === "test-student" ? inMemoryPersistence : browserLocalPersistence;
    return initializeAuth(firebaseApp, { persistence });
  } catch {
    return getAuth(firebaseApp);
  }
}

export const auth = createAuth();
export const db = getFirestore(firebaseApp);
export const functions = getFunctions(firebaseApp, import.meta.env.VITE_FIREBASE_FUNCTIONS_REGION || "asia-northeast3");

const appCheckSiteKey = String(import.meta.env.VITE_FIREBASE_APP_CHECK_SITE_KEY || "").trim();
if (appCheckSiteKey && typeof window !== "undefined") {
  try {
    initializeAppCheck(firebaseApp, {
      provider: new ReCaptchaEnterpriseProvider(appCheckSiteKey),
      isTokenAutoRefreshEnabled: true,
    });
  } catch (error: unknown) {
    if (import.meta.env.DEV) console.warn("App Check is already initialized or unavailable.", error);
  }
}
