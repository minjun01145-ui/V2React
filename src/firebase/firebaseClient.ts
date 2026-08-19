import { getApps, initializeApp, type FirebaseApp, type FirebaseOptions } from "firebase/app";
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from "firebase/app-check";
import { browserLocalPersistence, browserSessionPersistence, getAuth, initializeAuth, type Auth } from "firebase/auth";
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

function currentRole(): "student" | "teacher" {
  if (typeof window !== "undefined" && /(^|\/)teacher(\/|$)/.test(window.location.pathname)) return "teacher";
  return "student";
}

const role = currentRole();
const appName = `jurye-${role}`;
const existing = getApps().find((app) => app.name === appName);
export const firebaseApp: FirebaseApp = existing ?? initializeApp(firebaseConfig, appName);

function createAuth(): Auth {
  try {
    return initializeAuth(firebaseApp, { persistence: role === "teacher" ? browserSessionPersistence : browserLocalPersistence });
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
