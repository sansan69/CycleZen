
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

const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;

if (!apiKey || apiKey.trim() === '' || !projectId || projectId.trim() === '') {
  console.error(
    "CRITICAL from firebase.ts: Firebase API Key or Project ID is missing or empty. " +
    "Firebase will not initialize properly. Check .env file and restart server. " +
    `API Key: '${apiKey}', Project ID: '${projectId}'`
  );
} else {
  try {
    if (getApps().length === 0) {
      app = initializeApp(firebaseConfig);
      console.log("firebase.ts: Firebase app initialized. Project ID:", app.options.projectId);
    } else {
      app = getApps()[0];
      console.log("firebase.ts: Firebase app re-used. Project ID:", app.options.projectId);
    }

    if (app) {
      db = getFirestore(app);

      try {
        auth = getAuth(app);
        // console.log("firebase.ts: Attempted getAuth(app). Raw auth object:", JSON.stringify(auth)); // Potentially too verbose

        if (auth && typeof auth.onAuthStateChanged === 'function' && auth.app) {
          console.log("firebase.ts: Firebase auth instance appears valid. Type:", typeof auth);
        } else {
          console.error(
            "CRITICAL from firebase.ts: getAuth(app) did NOT return a valid Auth instance. ",
            "Type:", typeof auth, "Value:", auth, "Does it have onAuthStateChanged?", typeof auth?.onAuthStateChanged, "Does it have .app?", !!auth?.app
            );
          auth = undefined; // Explicitly set to undefined if not valid
        }
      } catch (e: any) {
        console.error(
          "CRITICAL from firebase.ts: Error calling getAuth(app):", e.message,
          "Firebase App Project ID from app object:", app?.options?.projectId
        );
        auth = undefined; // Ensure auth is undefined on error
      }
    } else {
      console.error("CRITICAL from firebase.ts: Firebase app object is undefined after initialization/getApps attempt.");
    }

  } catch (e: any) {
    console.error(
      "CRITICAL from firebase.ts: Firebase core initialization error (initializeApp or getFirestore):", e.message,
      "Config used:", firebaseConfig
    );
    app = undefined;
    db = undefined;
    auth = undefined;
  }
}

console.log("firebase.ts: Exporting... App type:", typeof app, "DB type:", typeof db, "Auth type:", typeof auth, "Auth value:", auth);

export { app, db, auth };
