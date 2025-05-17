
import { initializeApp, getApps, FirebaseApp } from "firebase/app";
import { getFirestore, Firestore } from "firebase/firestore";
import { getAuth, Auth } from "firebase/auth";

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

console.log("[firebase.ts] Top level: Initializing Firebase config check.");

const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;

if (!apiKey || apiKey.trim() === '' || !projectId || projectId.trim() === '') {
  console.error(
    "CRITICAL from firebase.ts: Firebase API Key or Project ID is missing or empty. " +
    "Firebase will not initialize properly. Check .env file and restart server. " +
    `API Key available: ${!!apiKey}, Project ID available: ${!!projectId}`
  );
} else {
  console.log("[firebase.ts] API Key and Project ID seem present. Proceeding with initialization.");
  try {
    if (getApps().length === 0) {
      app = initializeApp(firebaseConfig);
      console.log("[firebase.ts] Firebase app initialized. Project ID:", app.options.projectId);
    } else {
      app = getApps()[0];
      console.log("[firebase.ts] Firebase app re-used. Project ID:", app.options.projectId);
    }

    if (app) {
      db = getFirestore(app);
      console.log("[firebase.ts] Firestore instance obtained.");

      try {
        console.log("[firebase.ts] Attempting getAuth(app)...");
        auth = getAuth(app);
        console.log("[firebase.ts] After getAuth(app): auth object is:", auth);
        console.log("[firebase.ts] After getAuth(app): typeof auth:", typeof auth);
        if (auth) {
            console.log("[firebase.ts] After getAuth(app): typeof auth.onAuthStateChanged:", typeof auth.onAuthStateChanged);
            console.log("[firebase.ts] After getAuth(app): typeof auth.signInWithPopup:", typeof auth.signInWithPopup);
            console.log("[firebase.ts] After getAuth(app): auth.app exists:", !!auth.app);
        }


        if (auth && typeof auth.onAuthStateChanged === 'function' && typeof auth.signInWithPopup === 'function' && auth.app) {
          console.log("[firebase.ts] Firebase auth instance appears VALID and COMPLETE.");
        } else {
          console.error(
            "CRITICAL from firebase.ts: getAuth(app) did NOT return a valid or complete Auth instance. " +
            "Auth object:", auth,
            "typeof auth:", typeof auth,
            "Has onAuthStateChanged function?", typeof auth?.onAuthStateChanged === 'function',
            "Has signInWithPopup function?", typeof auth?.signInWithPopup === 'function',
            "Has .app property?", !!auth?.app
          );
          auth = undefined; // Explicitly set to undefined if not valid or complete
          console.log("[firebase.ts] Auth set to undefined due to failed validation.");
        }
      } catch (e: any) {
        console.error(
          "CRITICAL from firebase.ts: Error calling getAuth(app):", e.message,
          "Firebase App Project ID from app object:", app?.options?.projectId,
          "Stack:", e.stack
        );
        auth = undefined; // Ensure auth is undefined on error
        console.log("[firebase.ts] Auth set to undefined due to exception in getAuth(app).");
      }
    } else {
      console.error("CRITICAL from firebase.ts: Firebase app object is undefined after initialization/getApps attempt.");
      // auth remains undefined here
    }

  } catch (e: any) {
    console.error(
      "CRITICAL from firebase.ts: Firebase core initialization error (initializeApp or getFirestore):", e.message,
      "Config used:", firebaseConfig,
      "Stack:", e.stack
    );
    app = undefined;
    db = undefined;
    auth = undefined; // Ensure auth is undefined on error
    console.log("[firebase.ts] Auth set to undefined due to core initialization exception.");
  }
}

console.log(
  "[firebase.ts] EXPORTING: App type:", typeof app,
  "DB type:", typeof db,
  "Auth type:", typeof auth,
  "Auth value:", auth,
  "typeof auth.signInWithPopup (at export):", typeof auth?.signInWithPopup
);

export { app, db, auth };
