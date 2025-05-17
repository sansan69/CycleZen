
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

let app: FirebaseApp;
try {
  if (getApps().length === 0) {
    app = initializeApp(firebaseConfig);
  } else {
    app = getApps()[0];
  }
} catch (e: any) {
  console.error("Firebase initialization error (initializeApp):", e.message, "Config used:", firebaseConfig);
  // It's critical to throw here if initializeApp fails, as db and auth depend on it.
  throw new Error(`Firebase failed to initialize. Please check your Firebase config and ensure all NEXT_PUBLIC_FIREBASE_ environment variables are set correctly. Original error: ${e.message}`);
}

const db: Firestore = getFirestore(app);
let auth: Auth | undefined = undefined; // Initialize as undefined

// Only attempt to initialize auth if the API key is present and valid.
const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
if (typeof apiKey === 'string' && apiKey.trim() !== '') {
  try {
    auth = getAuth(app);
  } catch (e: any) {
    // This catch block might be hit if getAuth(app) fails for reasons other than a missing key,
    // e.g., if 'app' is somehow invalid or there are other config issues not caught by initializeApp.
    console.error(
      "Firebase getAuth(app) failed unexpectedly. API key was present but an error occurred:",
      e.message,
      "Firebase App Project ID:", app?.options?.projectId
    );
    // auth remains undefined
  }
} else {
  console.warn(
    "Firebase API key (NEXT_PUBLIC_FIREBASE_API_KEY) is missing or empty in environment variables. " +
    "Firebase Authentication will not be available. Ensure the .env file is correctly set up with NEXT_PUBLIC_FIREBASE_API_KEY and the server was restarted."
  );
  // auth remains undefined
}

export { app, db, auth };
