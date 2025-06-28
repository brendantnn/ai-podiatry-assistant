// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getAuth, signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-auth.js";
import { getFirestore, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
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
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const auth = getAuth(app);
const db = getFirestore(app);