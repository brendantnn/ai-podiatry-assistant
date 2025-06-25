// login.js (Updated for email + password auth)
import { auth, db } from "./config/firebase-config.js";
import { signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js";

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

  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const uid = userCredential.user.uid;

    const userSnap = await getDoc(doc(db, "Users", uid));
    if (!userSnap.exists()) {
      alert("Account not found in Firestore. Please register.");
      return;
    }

    const userData = userSnap.data();
    if (userData.role !== role) {
      alert(`This account is registered as a '${userData.role}', not '${role}'.`);
      return;
    }

    sessionStorage.setItem("uid", uid);
    sessionStorage.setItem("email", email);
    sessionStorage.setItem("role", role);

    window.location.href = role === "patient" ? "patient.html" : "podiatrist.html";

  } catch (err) {
    console.error("Login failed:", err);
    alert("Login failed. Please check your credentials.");
  }
});