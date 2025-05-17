
import type { User } from "firebase/auth";
import {
  GoogleAuthProvider,
  signInWithPopup,
  signOut as firebaseSignOut, // Renamed to avoid conflict
  onAuthStateChanged as firebaseOnAuthStateChanged, // Renamed
} from "firebase/auth";
import { auth as firebaseAuth } from "@/lib/firebase"; // Ensure this is the initialized auth object

// Log immediately upon module import to see what `firebaseAuth` is.
console.log(
    "[firebaseAuthService] MODULE LEVEL: Imported firebaseAuth:", firebaseAuth,
    "typeof firebaseAuth:", typeof firebaseAuth,
    "typeof firebaseAuth.signInWithPopup:", typeof firebaseAuth?.signInWithPopup,
    "typeof firebaseAuth.onAuthStateChanged:", typeof firebaseAuth?.onAuthStateChanged
);

const provider = new GoogleAuthProvider();

export async function signInWithGoogle(): Promise<User | null> {
  const currentAuthInstance = firebaseAuth; // Use a local const for clarity in logs for this call
  console.log("[firebaseAuthService] signInWithGoogle: Using firebaseAuth instance:", currentAuthInstance);
  if (currentAuthInstance) {
    console.log("[firebaseAuthService] signInWithGoogle: typeof currentAuthInstance.signInWithPopup:", typeof currentAuthInstance.signInWithPopup);
    console.log("[firebaseAuthService] signInWithGoogle: currentAuthInstance.hasOwnProperty('signInWithPopup'):", currentAuthInstance.hasOwnProperty('signInWithPopup'));
    console.log("[firebaseAuthService] signInWithGoogle: 'signInWithPopup' in currentAuthInstance:", 'signInWithPopup' in currentAuthInstance);
    console.log("[firebaseAuthService] signInWithGoogle: typeof currentAuthInstance.onAuthStateChanged:", typeof currentAuthInstance.onAuthStateChanged);
  }


  if (!currentAuthInstance || typeof currentAuthInstance.signInWithPopup !== 'function') {
    console.error(
        "[firebaseAuthService] signInWithGoogle: ERROR - currentAuthInstance is not properly initialized or signInWithPopup is not a function. currentAuthInstance:",
        currentAuthInstance,
        "typeof signInWithPopup:",
        typeof currentAuthInstance?.signInWithPopup
    );
    throw new Error("Firebase Auth (signInWithGoogle) not properly initialized. Check console for details.");
  }
  try {
    const result = await signInWithPopup(currentAuthInstance, provider);
    return result.user;
  } catch (error: any) {
    console.error("[firebaseAuthService] Error signing in with Google:", error.code, error.message, error);
    throw error;
  }
}

export async function signOutUser(): Promise<void> {
  const currentAuthInstance = firebaseAuth;
  console.log("[firebaseAuthService] signOutUser: Using firebaseAuth instance:", currentAuthInstance);
  if (currentAuthInstance) {
      console.log("[firebaseAuthService] signOutUser: typeof currentAuthInstance.signOut:", typeof currentAuthInstance.signOut);
  }

  if (!currentAuthInstance || typeof currentAuthInstance.signOut !== 'function') {
    console.error(
        "[firebaseAuthService] signOutUser: ERROR - currentAuthInstance not properly initialized or signOut is not a function. currentAuthInstance:",
        currentAuthInstance,
        "typeof signOut:",
        typeof currentAuthInstance?.signOut
    );
    throw new Error("Firebase Auth (signOutUser) not properly initialized. Check console for details.");
  }
  try {
    await firebaseSignOut(currentAuthInstance);
  } catch (error: any) {
    console.error("[firebaseAuthService] Error signing out:", error.code, error.message, error);
    throw error;
  }
}

export function onAuthUserChanged(callback: (user: User | null) => void): () => void {
  const currentAuthInstance = firebaseAuth;
  console.log("[firebaseAuthService] onAuthUserChanged: Using firebaseAuth instance:", currentAuthInstance);
  if (currentAuthInstance) {
    console.log("[firebaseAuthService] onAuthUserChanged: typeof currentAuthInstance.onAuthStateChanged:", typeof currentAuthInstance.onAuthStateChanged);
    console.log("[firebaseAuthService] onAuthUserChanged: currentAuthInstance.app exists:", !!currentAuthInstance.app);
  }

  if (!currentAuthInstance || typeof currentAuthInstance.onAuthStateChanged !== 'function' || !currentAuthInstance.app) {
    console.error(
        "[firebaseAuthService] onAuthUserChanged: ERROR - currentAuthInstance not properly initialized or onAuthStateChanged is not a function / app is missing. currentAuthInstance:",
        currentAuthInstance,
        "typeof onAuthStateChanged:",
        typeof currentAuthInstance?.onAuthStateChanged,
        "app exists:",
        !!currentAuthInstance?.app
    );
    callback(null);
    return () => {}; // No-op unsubscribe
  }
  return firebaseOnAuthStateChanged(currentAuthInstance, callback);
}
