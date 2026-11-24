import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import {
  getAuth,
  GoogleAuthProvider,
  OAuthProvider,
  type Auth,
} from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyDg43B_SJrLNcBKsZQVckEjmQWhkYuTgyo",
  authDomain: "promarkets-81539.firebaseapp.com",
  projectId: "promarkets-81539",
  storageBucket: "promarkets-81539.firebasestorage.app",
  messagingSenderId: "23959867098",
  appId: "1:23959867098:web:45d3adeaeb6c2062649fe3",
  measurementId: "G-RD19N5BWG2"
};

export const isFirebaseConfigured = Boolean(
  firebaseConfig.apiKey && firebaseConfig.authDomain && firebaseConfig.projectId
);

let app: FirebaseApp | null = null;
let auth: Auth | null = null;

if (isFirebaseConfigured) {
  app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
  auth = getAuth(app);
}

export const googleProvider = new GoogleAuthProvider();
googleProvider.addScope("email");
googleProvider.addScope("profile");
googleProvider.setCustomParameters({ prompt: "select_account" });

export const appleProvider = new OAuthProvider("apple.com");
appleProvider.addScope("email");
appleProvider.addScope("name");

export { auth };