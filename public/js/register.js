// register.js
import { auth, db } from "./config/firebase-config.js";
import { createUserWithEmailAndPassword, signOut} from "https://www.gstatic.com/firebasejs/10.11.0/firebase-auth.js";
import { runTransaction, doc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js";

// SANITIZE INPUTS
function sanitizeName(name) {
  return name.replace(/[^a-zA-Z\s-]/g, '');
}
function sanitizePhone(phone) {
  return phone.replace(/[^\d+]/g, '');
}

// VALIDATE PHONE NUMBER
function isValidPhoneSG(phone) {
  return /^\+65[689]\d{7}$/.test(phone);
}

// PASSWORD STRENGTH CHECK
function isPasswordValid(password) {
  const regex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{8,}$/;
  return regex.test(password);
}

// REGISTER HANDLER
document.getElementById("registerForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  const role = document.getElementById("role").value;
  const email = document.getElementById("email").value.trim().toLowerCase();
  const password = document.getElementById("password").value;
  const confirmPassword = document.getElementById("confirmPassword").value;
  const firstNameRaw = document.getElementById("firstName").value.trim();
  const lastNameRaw = document.getElementById("lastName").value.trim();
  const dob = document.getElementById("dob").value;
  const phoneRaw = document.getElementById("phone").value.trim();
  const gender = document.getElementById("gender").value;

  if (!role || !email || !password || !confirmPassword || !firstNameRaw || !lastNameRaw || !dob || !phoneRaw || !gender) {
    alert("Please fill in all fields.");
    return;
  }

  const firstName = sanitizeName(firstNameRaw);
  const lastName = sanitizeName(lastNameRaw);
  const phone = sanitizePhone(phoneRaw);

  if (!isValidPhoneSG(phone)) {
    alert("Please enter a valid Singapore phone number starting with +65 and beginning with 6, 8, or 9.");
    return;
  }

  if (!firstName || !lastName) {
    alert("Please enter valid names (letters, spaces, and hyphens only).");
    return;
  }

  if (password !== confirmPassword) {
    alert("Passwords do not match.");
    return;
  }

  if (!isPasswordValid(password)) {
    alert("Password must be at least 8 characters long and include uppercase, lowercase, number, and special character.");
    return;
  }

  try {
    // Step 1: Create user in Firebase Auth
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const uid = userCredential.user.uid;

    // Step 2: Initialize variables for custom IDs
    let newCount = 1;
    let patientCount = 0;
    let podCount = 0;

    // Step 3: Run a transaction to update counters and get current values
    await runTransaction(db, async (transaction) => {
      const counterRef = doc(db, "MetaData", "user_count");
      const patientRef = doc(db, "MetaData", "patient_count");
      const podiatristRef = doc(db, "MetaData", "podiatrist_count");

      const counterSnap = await transaction.get(counterRef);
      const patientSnap = await transaction.get(patientRef);
      const podSnap = await transaction.get(podiatristRef);

      // User counter
      newCount = counterSnap.exists() ? counterSnap.data().count + 1 : 1;
      transaction.set(counterRef, { count: newCount });

      // Role-specific counters
      if (role === "patient") {
        patientCount = patientSnap.exists() ? patientSnap.data().count + 1 : 1;
        transaction.set(patientRef, { count: patientCount });
      } else {
        podCount = podSnap.exists() ? podSnap.data().count + 1 : 1;
        transaction.set(podiatristRef, { count: podCount });
      }
    });

    // Step 4: Create role-specific profiles
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

    // Step 5: Create user in Users collection with custom document ID
    const userDocId = `user_${newCount}`;
    const userId = role === "patient" ? `patient_${patientCount}` : `pod_${podCount}`;

    await setDoc(doc(db, "Users", userDocId), {
      email,
      role,
      createdAt: new Date(),
      firstName,
      lastName,
      dob,
      phone,
      gender,
      authId: uid,
      userId
    });

    // Step 6: Done
    alert("✅ Account created. Please log in.");
    window.location.href = "login.html";

  } catch (err) {
    console.error("Registration error:", err);
    alert("❌ Registration failed. Email may already be in use.");
  }
});
