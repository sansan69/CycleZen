
import type { User } from "firebase/auth";
import {
  GoogleAuthProvider,
  signInWithPopup,
  signOut as firebaseSignOut, 
  onAuthStateChanged as firebaseOnAuthStateChanged, 
} from "firebase/auth";
import { auth as firebaseAuth } from "@/lib/firebase"; 

// Log immediately upon module import to see what `firebaseAuth` is.
console.log(
    "[firebaseAuthService] MODULE LEVEL: Importing `auth` as `firebaseAuth` from '@/lib/firebase'.",
    "Imported firebaseAuth value:", firebaseAuth,
    "typeof firebaseAuth:", typeof firebaseAuth,
);

if (firebaseAuth) {
    console.log(
        "[firebaseAuthService] MODULE LEVEL: Details of imported firebaseAuth:",
        "firebaseAuth.app exists:", !!firebaseAuth.app,
        "firebaseAuth.name:", firebaseAuth.name
    );
} else {
    console.warn(
        "[firebaseAuthService] MODULE LEVEL: Imported firebaseAuth is undefined or null. Auth functions will likely fail."
    );
}


const provider = new GoogleAuthProvider();

export async function signInWithGoogle(): Promise<User | null> {
  const currentAuthInstance = firebaseAuth; 
  console.log("[firebaseAuthService] signInWithGoogle: Using firebaseAuth instance:", currentAuthInstance);
  
  if (currentAuthInstance) {
    // Example of logging properties that should exist on a valid Auth instance
    console.log("[firebaseAuthService] signInWithGoogle: currentAuthInstance.app exists:", !!currentAuthInstance.app);
    console.log("[firebaseAuthService] signInWithGoogle: currentAuthInstance.name:", currentAuthInstance.name);
  }

  if (!currentAuthInstance) {
    console.error(
        "[firebaseAuthService] signInWithGoogle: ERROR - currentAuthInstance is not available (undefined or null). currentAuthInstance:",
        currentAuthInstance
    );
    throw new Error("Firebase Auth (signInWithGoogle) not available. Check console for details from firebase.ts and firebaseAuthService.ts.");
  }
  try {
    const result = await signInWithPopup(currentAuthInstance, provider);
    return result.user;
  } catch (error: any) {
    if (error.code === 'auth/unauthorized-domain') {
      console.error(
        "[firebaseAuthService] Error signing in with Google (auth/unauthorized-domain):", 
        error.message, 
        "This is a Firebase project configuration issue. Ensure your app's domain (e.g., 'localhost') is added to 'Authorized domains' in Firebase Console > Authentication > Settings, and that NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN in your .env file is correct. Restart your server after .env changes.",
        error // Log the full error object for more details
      );
    } else {
      console.error("[firebaseAuthService] Error signing in with Google:", error.code, error.message, error);
    }
    throw error;
  }
}

export async function signOutUser(): Promise<void> {
  const currentAuthInstance = firebaseAuth;
  console.log("[firebaseAuthService] signOutUser: Using firebaseAuth instance:", currentAuthInstance);

  if (!currentAuthInstance) {
    console.error(
        "[firebaseAuthService] signOutUser: ERROR - currentAuthInstance is not available. currentAuthInstance:",
        currentAuthInstance
    );
    throw new Error("Firebase Auth (signOutUser) not available. Check console for details.");
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
    console.log("[firebaseAuthService] onAuthUserChanged: currentAuthInstance.app exists:", !!currentAuthInstance.app);
  }

  if (!currentAuthInstance) {
    console.error(
        "[firebaseAuthService] onAuthUserChanged: ERROR - currentAuthInstance is not available. currentAuthInstance:",
        currentAuthInstance
    );
    callback(null); 
    return () => {}; 
  }
  return firebaseOnAuthStateChanged(currentAuthInstance, callback);
}
