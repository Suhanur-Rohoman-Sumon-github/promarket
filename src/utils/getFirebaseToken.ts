import { onAuthStateChanged } from "firebase/auth";
import { auth } from "../firebase";

export async function getFirebaseToken(): Promise<string | null> {
  if (!auth) return null;
  const firebaseAuth = auth;

  // Wait until Firebase finishes restoring the user session after refresh
  if (typeof firebaseAuth.authStateReady === "function") {
    await firebaseAuth.authStateReady();
    return firebaseAuth.currentUser ? await firebaseAuth.currentUser.getIdToken() : null;
  }

  // Fallback for older Firebase v9 SDKs
  return new Promise((resolve) => {
    const unsub = onAuthStateChanged(firebaseAuth, async (user) => {
      unsub();
      resolve(user ? await user.getIdToken() : null);
    });
  });
}