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
  console.error("Firebase initialization error:", e.message);
  throw e; // Re-throw to prevent the app from running with a misconfigured Firebase
}

const db: Firestore = getFirestore(app);
let auth: Auth;

if (process.env.NEXT_PUBLIC_FIREBASE_API_KEY) {
  auth = getAuth(app);
} else {
  console.warn("Firebase API key is missing. Authentication will not be available.");
  // Provide a fallback or dummy object if auth is not initialized.
  auth = {} as Auth;
}

export { app, db, auth };
