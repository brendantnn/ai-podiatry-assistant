// ========================================
// FIREBASE CONFIGURATION
// File: js/config/firebase-config.js
// ========================================

// Import the functions you need from the SDKs
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-analytics.js";
import { 
  getAuth, 
  connectAuthEmulator 
} from "https://www.gstatic.com/firebasejs/10.11.0/firebase-auth.js";
import { 
  getFirestore, 
  connectFirestoreEmulator 
} from "https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDk0L-LZn8B3UZOUnzH26QFFVtpadrd4js",
  authDomain: "itp-grp21.firebaseapp.com",
  projectId: "itp-grp21",
  storageBucket: "itp-grp21.firebasestorage.app",
  messagingSenderId: "1050091792638",
  appId: "1:1050091792638:web:2cdc82bbd6608844105daf",
  measurementId: "G-VCTS5QNC64"
};

// Initialize Firebase
console.log("🔥 Initializing Firebase...");
const app = initializeApp(firebaseConfig);

// Initialize Analytics (optional)
let analytics;
try {
  analytics = getAnalytics(app);
  console.log("📊 Firebase Analytics initialized");
} catch (error) {
  console.warn("⚠️ Analytics not available:", error.message);
}

// Initialize Authentication
const auth = getAuth(app);
console.log("🔐 Firebase Auth initialized");

// Initialize Firestore
const db = getFirestore(app);
console.log("🗄️ Firestore initialized");

// Development mode emulator connection (optional)
if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
  console.log("🛠️ Development mode detected");
  
  // Uncomment these lines if you're using Firebase emulators in development
  /*
  try {
    connectAuthEmulator(auth, "http://localhost:9099", { disableWarnings: true });
    connectFirestoreEmulator(db, 'localhost', 8080);
    console.log("🔧 Connected to Firebase emulators");
  } catch (error) {
    console.log("⚠️ Emulators not available or already connected:", error.message);
  }
  */
}

// Export the initialized services
export { app, auth, db, analytics };

// Global error handler for Firebase
window.addEventListener('unhandledrejection', (event) => {
  if (event.reason && event.reason.code && event.reason.code.startsWith('auth/')) {
    console.error('🔥 Firebase Auth Error:', event.reason);
  }
});

console.log("✅ Firebase configuration loaded successfully");