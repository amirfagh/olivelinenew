import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
const firebaseConfig = {
  apiKey: "AIzaSyBq0t75QRmZ_Z0cVrDvFH79IXgpNsg-tOg",
  authDomain: "olive-line.firebaseapp.com",
  projectId: "olive-line",
  storageBucket: "olive-line.firebasestorage.app",
  messagingSenderId: "687030099286",
  appId: "1:687030099286:web:34e05c50cefe8bf96d4af7",
  measurementId: "G-8X05R46RP4"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Export services
export const auth = getAuth(app);
export const provider = new GoogleAuthProvider();
export const db = getFirestore(app);
export const storage = getStorage(app);