// register.js
import { auth, db } from "./config/firebase-config.js";
import { createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-auth.js";
import { doc, setDoc } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js";

document.getElementById("registerForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  const role = document.getElementById("role").value;
  const email = document.getElementById("email").value.trim().toLowerCase();
  const password = document.getElementById("password").value;
  const confirmPassword = document.getElementById("confirmPassword").value;

  if (!role || !email || !password || !confirmPassword) {
    alert("Please fill in all fields.");
    return;
  }

  if (password !== confirmPassword) {
    alert("Passwords do not match.");
    return;
  }

  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const uid = userCredential.user.uid;

    // Step 1: Store in Users
    await setDoc(doc(db, "Users", uid), {
      email,
      role,
      createdAt: new Date()
    });

    // Step 2: Role-specific profile
    if (role === "patient") {
      await setDoc(doc(db, "PatientProfiles", uid), {
        riskLevel: "low",
        assignedPodId: "",
        preferredLanguage: "en"
      });
    } else {
      await setDoc(doc(db, "PodiatristProfiles", uid), {
        staffId: "",
        maxPatientsPerDay: 10,
        specializations: []
      });
    }

    alert("✅ Account created. Please log in.");
    window.location.href = "login.html";
  } catch (err) {
    console.error("Registration error:", err);
    alert("❌ Registration failed. Email may already be in use.");
  }
});
