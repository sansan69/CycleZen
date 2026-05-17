
import { initializeApp, getApps, FirebaseApp } from "firebase/app";
import { getFirestore, Firestore } from "firebase/firestore";
import { getAuth, Auth } from "firebase/auth";
import { logger } from "@/shared/services/logger";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

let app: FirebaseApp | undefined = undefined;
let db: Firestore | undefined = undefined;
let auth: Auth | undefined = undefined;

logger.info("firebase", "Top level: Initializing Firebase config check.");

const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;

if (!apiKey || apiKey.trim() === '' || !projectId || projectId.trim() === '') {
  logger.warn(
    "firebase",
    "CRITICAL: Firebase API Key or Project ID is missing or empty. " +
    "Firebase will not initialize properly. Check .env file and restart server. " +
    `API Key available: ${!!apiKey}, Project ID available: ${!!projectId}`
  );
  // auth remains undefined here
} else {
  logger.info("firebase", "API Key and Project ID seem present. Proceeding with initialization attempt.");
  try {
    if (getApps().length === 0) {
      app = initializeApp(firebaseConfig);
      logger.info("firebase", "Firebase app initialized. Project ID:", app.options.projectId);
    } else {
      app = getApps()[0];
      logger.info("firebase", "Firebase app re-used. Project ID:", app.options.projectId);
    }

    if (app) {
      db = getFirestore(app);
      logger.info("firebase", "Firestore instance obtained.");

      logger.info("firebase", "PRE-getAuth: Current `auth` variable is:", auth);
      try {
        const tempAuth = getAuth(app); // Assign to temp variable first
        logger.info("firebase", "POST-getAuth: `getAuth(app)` returned:", tempAuth);
        logger.info("firebase", "POST-getAuth: typeof tempAuth:", typeof tempAuth);

        // Revised validation for v9+ modular SDK compatibility:
        // Check if it's an object and has the .app property (core to an Auth instance).
        // Specific methods like signInWithPopup are top-level functions in v9.
        if (tempAuth && typeof tempAuth === 'object' && tempAuth !== null && tempAuth.app) {
          auth = tempAuth; // Assign to the module-level variable if basic validation passes
          logger.info("firebase", "VALIDATION PASSED: Firebase auth instance from getAuth(app) appears to be a valid object associated with the app. Further checks will occur in service layer.");
          logger.info("firebase", "For diagnostics - typeof auth.onAuthStateChanged:", typeof auth.onAuthStateChanged);
          logger.info("firebase", "For diagnostics - typeof auth.signInWithPopup (instance method, may not exist in v9):", typeof (auth as any).signInWithPopup);
          logger.info("firebase", "For diagnostics - typeof auth.signOut (instance method, may not exist in v9):", typeof (auth as any).signOut);
        } else {
          logger.error(
            "firebase",
            "CRITICAL: `getAuth(app)` did NOT return a valid Auth object or it's not associated with an app. " +
            "Auth object after getAuth:", tempAuth,
            "typeof auth:", typeof tempAuth
          );
          auth = undefined; // Explicitly set to undefined if not valid
          logger.info("firebase", "VALIDATION FAILED: `auth` has been set to undefined.");
        }
      } catch (e: any) {
        logger.error(
          "firebase",
          "CRITICAL: Error during getAuth(app) or its validation:", e.message,
          "Firebase App Project ID from app object:", app?.options?.projectId,
          "Stack:", e.stack
        );
        auth = undefined; // Ensure auth is undefined on error
        logger.info("firebase", "Auth set to undefined due to exception in getAuth(app) or validation.");
      }
    } else {
      logger.error("firebase", "CRITICAL: Firebase app object is undefined after initialization/getApps attempt. Auth cannot be initialized.");
      // auth remains undefined here as db would also be.
    }

  } catch (e: any) {
    logger.error(
      "firebase",
      "CRITICAL: Firebase core initialization error (initializeApp or getFirestore):", e.message,
      "Config used (API Key Redacted):", JSON.stringify({...firebaseConfig, apiKey: firebaseConfig.apiKey ? '***REDACTED***' : undefined }),
      "Stack:", e.stack
    );
    app = undefined;
    db = undefined;
    auth = undefined; // Ensure auth is undefined on core initialization error
    logger.info("firebase", "Auth set to undefined due to core initialization exception.");
  }
}

logger.info(
  "firebase",
  "EXPORTING: App defined:", !!app,
  "DB defined:", !!db,
  "Auth defined:", !!auth,
  "Auth value (first 50 chars if object):", typeof auth === 'object' && auth !== null ? JSON.stringify(auth).substring(0,100) + '...' : auth,
  "typeof auth (at export):", typeof auth,
  "typeof (auth as any)?.signInWithPopup (instance method, at export):", typeof (auth as any)?.signInWithPopup
);

export { app, db, auth };
