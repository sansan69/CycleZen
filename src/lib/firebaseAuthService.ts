
import type { User } from "firebase/auth";
import {
  GoogleAuthProvider,
  signInWithPopup,
  signOut as firebaseSignOut, 
  onAuthStateChanged as firebaseOnAuthStateChanged, 
} from "firebase/auth";
import { auth as firebaseAuth } from "@/lib/firebase"; 
import { logger } from "@/shared/services/logger";

// Log immediately upon module import to see what `firebaseAuth` is.
logger.info(
    "authService",
    "MODULE LEVEL: Importing `auth` as `firebaseAuth` from '@/lib/firebase'.",
    "Imported firebaseAuth value:", firebaseAuth,
    "typeof firebaseAuth:", typeof firebaseAuth,
);

if (firebaseAuth) {
    logger.info(
        "authService",
        "MODULE LEVEL: Details of imported firebaseAuth:",
        "firebaseAuth.app exists:", !!firebaseAuth.app,
        "firebaseAuth.name:", firebaseAuth.name
    );
} else {
    logger.warn(
        "authService",
        "MODULE LEVEL: Imported firebaseAuth is undefined or null. Auth functions will likely fail."
    );
}


const provider = new GoogleAuthProvider();

export async function signInWithGoogle(): Promise<User | null> {
  const currentAuthInstance = firebaseAuth; 
  logger.info("authService", "signInWithGoogle: Using firebaseAuth instance:", currentAuthInstance);
  
  if (currentAuthInstance) {
    // Example of logging properties that should exist on a valid Auth instance
    logger.info("authService", "signInWithGoogle: currentAuthInstance.app exists:", !!currentAuthInstance.app);
    logger.info("authService", "signInWithGoogle: currentAuthInstance.name:", currentAuthInstance.name);
  }

  if (!currentAuthInstance) {
    logger.error(
        "authService",
        "signInWithGoogle: ERROR - currentAuthInstance is not available (undefined or null). currentAuthInstance:",
        currentAuthInstance
    );
    throw new Error("Firebase Auth (signInWithGoogle) not available. Check console for details from firebase.ts and firebaseAuthService.ts.");
  }
  try {
    const result = await signInWithPopup(currentAuthInstance, provider);
    return result.user;
  } catch (error: any) {
    if (error.code === 'auth/unauthorized-domain') {
      logger.error(
        "authService",
        "Error signing in with Google (auth/unauthorized-domain):", 
        error.message, 
        "This is a Firebase project configuration issue. Ensure your app's domain (e.g., 'localhost') is added to 'Authorized domains' in Firebase Console > Authentication > Settings, and that NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN in your .env file is correct. Restart your server after .env changes.",
        error // Log the full error object for more details
      );
    } else {
      logger.error("authService", "Error signing in with Google:", error.code, error.message, error);
    }
    throw error;
  }
}

export async function signOutUser(): Promise<void> {
  const currentAuthInstance = firebaseAuth;
  logger.info("authService", "signOutUser: Using firebaseAuth instance:", currentAuthInstance);

  if (!currentAuthInstance) {
    logger.error(
        "authService",
        "signOutUser: ERROR - currentAuthInstance is not available. currentAuthInstance:",
        currentAuthInstance
    );
    throw new Error("Firebase Auth (signOutUser) not available. Check console for details.");
  }
  try {
    await firebaseSignOut(currentAuthInstance);
  } catch (error: any) {
    logger.error("authService", "Error signing out:", error.code, error.message, error);
    throw error;
  }
}

export function onAuthUserChanged(callback: (user: User | null) => void): () => void {
  const currentAuthInstance = firebaseAuth;
  logger.info("authService", "onAuthUserChanged: Using firebaseAuth instance:", currentAuthInstance);
  
  if (currentAuthInstance) {
    logger.info("authService", "onAuthUserChanged: currentAuthInstance.app exists:", !!currentAuthInstance.app);
  }

  if (!currentAuthInstance) {
    logger.error(
        "authService",
        "onAuthUserChanged: ERROR - currentAuthInstance is not available. currentAuthInstance:",
        currentAuthInstance
    );
    callback(null); 
    return () => {}; 
  }
  return firebaseOnAuthStateChanged(currentAuthInstance, callback);
}
