
import type { User } from "firebase/auth";
import {
  GoogleAuthProvider,
  signInWithPopup,
  signOut as firebaseSignOut, // Renamed to avoid conflict
  onAuthStateChanged as firebaseOnAuthStateChanged, // Renamed
} from "firebase/auth";
import { auth as firebaseAuth } from "@/lib/firebase"; // Ensure this is the initialized auth object

const provider = new GoogleAuthProvider();

export async function signInWithGoogle(): Promise<User | null> {
  if (!firebaseAuth || typeof firebaseAuth.signInWithPopup !== 'function') {
    console.error("[firebaseAuthService] signInWithGoogle: firebaseAuth not properly initialized or signInWithPopup is not a function. firebaseAuth:", firebaseAuth, "typeof signInWithPopup:", typeof firebaseAuth?.signInWithPopup);
    throw new Error("Firebase Auth not properly initialized for sign-in.");
  }
  try {
    const result = await signInWithPopup(firebaseAuth, provider);
    return result.user;
  } catch (error: any) {
    console.error("[firebaseAuthService] Error signing in with Google:", error);
    // Rethrow or handle as appropriate for your app, e.g., return null or a custom error object
    throw error; 
  }
}

export async function signOutUser(): Promise<void> {
  if (!firebaseAuth || typeof firebaseAuth.signOut !== 'function') {
    console.error("[firebaseAuthService] signOutUser: firebaseAuth not properly initialized or signOut is not a function. firebaseAuth:", firebaseAuth, "typeof signOut:", typeof firebaseAuth?.signOut);
    throw new Error("Firebase Auth not properly initialized for sign-out.");
  }
  try {
    await firebaseSignOut(firebaseAuth);
  } catch (error: any) {
    console.error("[firebaseAuthService] Error signing out:", error);
    throw error;
  }
}

export function onAuthUserChanged(callback: (user: User | null) => void): () => void {
  if (!firebaseAuth || typeof firebaseAuth.onAuthStateChanged !== 'function' || !firebaseAuth.app) {
    console.error("[firebaseAuthService] onAuthUserChanged: firebaseAuth not properly initialized or onAuthStateChanged is not a function / app is missing. firebaseAuth:", firebaseAuth, "typeof onAuthStateChanged:", typeof firebaseAuth?.onAuthStateChanged, "app:", firebaseAuth?.app);
    // Immediately call callback with null and return a no-op unsubscribe 
    // to prevent further errors if auth is not set up.
    callback(null);
    return () => {}; // No-op unsubscribe
  }
  return firebaseOnAuthStateChanged(firebaseAuth, callback);
}
