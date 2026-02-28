import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { initializeAppCheck, ReCaptchaV3Provider } from "firebase/app-check"; 

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

const app = initializeApp(firebaseConfig);

if (typeof window !== "undefined") {
  const siteKey = import.meta.env.VITE_RECAPTCHA;

  if (siteKey) {
    if (window.location.hostname === "localhost") {
      self.FIREBASE_APPCHECK_DEBUG_TOKEN = true;
      console.log("Firebase: Debug Token Aktif (Mode Localhost)");
    }

    initializeAppCheck(app, {
      provider: new ReCaptchaV3Provider(siteKey),
      isTokenAutoRefreshEnabled: true,
    });
    console.log("Firebase: App Check Protected");
  } else {
    console.warn("Firebase Warning: VITE_RECAPTCHA tidak ditemukan di .env");
  }
}

export const db = getFirestore(app);
export const auth = getAuth(app);