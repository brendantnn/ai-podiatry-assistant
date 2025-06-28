// login.js
import { auth, db } from "./config/firebase-config.js";
import { signInWithEmailAndPassword, signOut,  setPersistence, browserSessionPersistence } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-auth.js";
import { collection, query, where, updateDoc, doc, getDocs } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js";
import { sendPasswordResetEmail } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-auth.js";

// LOGIN ATTEMPTS TRACKING
let loginAttempts = 0;
let isLocked = false;
const maxAttempts = 5;
const lockoutTime = 60 * 1000; // 1 minute


// HANDLE PASSWORD RESET
window.openModal = () => document.getElementById("forgotModal").classList.remove("hidden");
window.closeModal = () => document.getElementById("forgotModal").classList.add("hidden");

window.sendReset = async () => {
  const email = document.getElementById("resetEmail").value.trim().toLowerCase();
  try {
    await sendPasswordResetEmail(auth, email);
    alert("📨 Password reset link sent to your email.");
    closeModal();
  } catch (err) {
    alert("❌ " + err.message);
  }
};

// LOCK DURATION (1 MINUTE)
function lockLoginTemporarily() {
  isLocked = true;
  alert(`Too many failed attempts. Please try again in ${lockoutTime / 1000} seconds.`);
  setTimeout(() => {
    isLocked = false;
    loginAttempts = 0;
  }, lockoutTime);
}

// LOGIN HANDLER
document.getElementById("loginForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const role = document.getElementById("userType").value;
  const email = document.getElementById("email").value.trim().toLowerCase();
  const password = document.getElementById("password").value;

   
  if (!role || !email || !password) {
    alert("Please fill in all fields.");
    return;
  }

  // Check if login attempts exceed max allowed
    if (isLocked) {
    alert("Too many failed attempts. Please try again later.");
    return;
  }
  
  try {
    // 0. Set session persistence to browser session
    await setPersistence(auth, browserSessionPersistence);

    // 1. Sign in with Firebase Authentication
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const uid = userCredential.user.uid;

    loginAttempts = 0; // reset on success
    isLocked = false;

    // 2. Query Firestore for user document by `authId` field (not by doc ID)
    const usersRef = collection(db, "Users");
    const userQuery = query(usersRef, where("authId", "==", uid));
    const querySnapshot = await getDocs(userQuery);

    if (querySnapshot.empty) {
      alert("User account not found. Please register first.");
      return;
    }

    if (querySnapshot.size > 1) {
      console.error("Multiple user accounts found for the same UID. This should not happen.");
      alert("Multiple accounts found. Please contact support.");
      return;
    }

    const userDoc = querySnapshot.docs[0];
    const userData = userDoc.data();

    // 3. Check role matches
    if (userData.role !== role) {
      alert(`This account is registered as a '${userData.role}', not '${role}'.`);
      return;
    }

    // 4. Update lastLogin and isActive fields in Firestore
    await updateDoc(userDoc.ref, {
      lastLogin: new Date(),
      isActive: true
    });

    // 5. Store session data
    sessionStorage.setItem("uid", uid);
    sessionStorage.setItem("email", email);
    sessionStorage.setItem("role", role);

    // 6. Redirect user to role-based dashboard
    window.location.href = role === "patient" ? "patient.html" : "podiatrist.html";

  } catch (err) {
    loginAttempts++;
    console.error("Login failed:", err);
    if (loginAttempts >= maxAttempts) {
      lockLoginTemporarily();
    } else {
      alert(`Login failed. Attempt ${loginAttempts}/${maxAttempts}`);
    }
    alert("Login failed: Invalid email or password.");
  }
});

