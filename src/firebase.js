import { initializeApp } from "firebase/app";
import { getFirestore, connectFirestoreEmulator } from "firebase/firestore";
import { getAuth, connectAuthEmulator } from "firebase/auth";

// ─── Firebase Config ───────────────────────────────────────────────────────────
// Pastikan semua variabel ini ada di .env (lokal) dan Environment Variables (Vercel)
const firebaseConfig = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId:             import.meta.env.VITE_FIREBASE_APP_ID,
};

// ─── Validasi config ───────────────────────────────────────────────────────────
const missingKeys = Object.entries(firebaseConfig)
  .filter(([, v]) => !v)
  .map(([k]) => k);

if (missingKeys.length > 0) {
  console.error(
    `[Firebase] ❌ Konfigurasi tidak lengkap! Key yang hilang:\n  ${missingKeys.join('\n  ')}\n` +
    `Pastikan file .env sudah ada dan Vercel Environment Variables sudah diset.`
  );
}

// ─── Init App ─────────────────────────────────────────────────────────────────
const app = initializeApp(firebaseConfig);

// ─── App Check (opsional, tidak memblokir jika gagal) ────────────────────────
// App Check hanya diaktifkan jika VITE_RECAPTCHA tersedia
// PENTING: Di Firebase Console → App Check, pastikan enforcement TIDAK aktif
// atau tambahkan domain Vercel kamu di daftar authorized domains
if (typeof window !== "undefined") {
  const siteKey = import.meta.env.VITE_RECAPTCHA;

  if (siteKey) {
    // Lazy import agar tidak crash jika library tidak ada
    import("firebase/app-check")
      .then(({ initializeAppCheck, ReCaptchaV3Provider }) => {
        try {
          // Mode debug untuk localhost
          if (window.location.hostname === "localhost") {
            // @ts-ignore
            self.FIREBASE_APPCHECK_DEBUG_TOKEN = true;
          }

          initializeAppCheck(app, {
            provider: new ReCaptchaV3Provider(siteKey),
            isTokenAutoRefreshEnabled: true,
          });

          console.log("[Firebase] ✅ App Check aktif");
        } catch (e) {
          // App Check gagal → app tetap jalan, hanya tanpa proteksi
          console.warn("[Firebase] ⚠️ App Check gagal diinisialisasi:", e.message);
        }
      })
      .catch(() => {
        console.warn("[Firebase] ⚠️ Modul app-check tidak tersedia");
      });
  } else {
    console.info(
      "[Firebase] ℹ️ App Check tidak aktif (VITE_RECAPTCHA tidak ditemukan).\n" +
      "Ini aman untuk development. Untuk production, pertimbangkan mengaktifkan App Check."
    );
  }
}

// ─── Export ───────────────────────────────────────────────────────────────────
export const db   = getFirestore(app);
export const auth = getAuth(app);