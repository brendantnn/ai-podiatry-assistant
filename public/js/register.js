// register.js
import { auth, db } from "./config/firebase-config.js";
import { createUserWithEmailAndPassword, signOut} from "https://www.gstatic.com/firebasejs/10.11.0/firebase-auth.js";
import { runTransaction, doc, setDoc, getDoc, query, collection, where, getDocs } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js";

// SANITIZE INPUTS
function sanitizeName(name) {
  return name.replace(/[^a-zA-Z\s-]/g, '');
}

function formatPhoneNumber(phone) {
  // Remove all spaces and non-digit characters except +
  let cleaned = phone.replace(/[^\d+]/g, '');
  
  // If no country code provided, default to Singapore +65
  if (!cleaned.startsWith('+')) {
    cleaned = '+65' + cleaned;
  }
  
  return cleaned;
}

// VALIDATE PHONE NUMBER (flexible for different countries but default Singapore)
function isValidPhone(phone) {
  // Singapore: +65 followed by 8 digits starting with 6, 8, or 9
  const sgPattern = /^\+65[689]\d{7}$/;
  
  // Other common patterns (you can expand this)
  const generalPattern = /^\+\d{1,4}\d{7,10}$/; // Country code + 7-10 digits
  
  return sgPattern.test(phone) || generalPattern.test(phone);
}

// PASSWORD STRENGTH CHECK - Updated requirements
function isPasswordValid(password) {
  // At least 8 characters, one uppercase, one symbol, alphanumeric
  const hasMinLength = password.length >= 8;
  const hasUppercase = /[A-Z]/.test(password);
  const hasSymbol = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password);
  const hasAlphanumeric = /^(?=.*[a-zA-Z])(?=.*\d)/.test(password);
  
  return hasMinLength && hasUppercase && hasSymbol && hasAlphanumeric;
}

// CHECK IF EMAIL EXISTS IN FIREBASE
async function checkEmailExists(email) {
  try {
    const usersRef = collection(db, "Users");
    const q = query(usersRef, where("email", "==", email.toLowerCase()));
    const querySnapshot = await getDocs(q);
    return !querySnapshot.empty;
  } catch (error) {
    console.error("Error checking email:", error);
    return false;
  }
}

// PHONE INPUT HANDLER - Auto-format while typing
document.getElementById("phone").addEventListener("input", function(e) {
  let value = e.target.value;
  const phoneWarning = document.getElementById("phoneWarning");
  
  // If user starts typing without +, add +65
  if (value.length === 1 && value !== '+') {
    value = '+65' + value;
    e.target.value = value;
  }
  
  // If user types +65, ensure it's formatted correctly
  if (value.startsWith('+65') && value.length > 3) {
    const digits = value.substring(3).replace(/\D/g, '');
    if (digits.length <= 8) {
      e.target.value = '+65' + digits;
    } else {
      e.target.value = '+65' + digits.substring(0, 8);
    }
  }
  
  // Hide warning when user is typing correctly
  if (phoneWarning.style.display === 'block') {
    phoneWarning.style.display = 'none';
  }
});

// PASSWORD INPUT HANDLER - Hide warning when user types
document.getElementById("password").addEventListener("input", function(e) {
  const passwordWarning = document.getElementById("passwordWarning");
  if (passwordWarning.style.display === 'block') {
    passwordWarning.style.display = 'none';
  }
});

document.getElementById("confirmPassword").addEventListener("input", function(e) {
  const passwordWarning = document.getElementById("passwordWarning");
  if (passwordWarning.style.display === 'block') {
    passwordWarning.style.display = 'none';
  }
});

// MODAL CONTROL FUNCTIONS
function showVerificationModal(phone) {
  document.getElementById('phoneVerify').textContent = phone;
  document.getElementById('phoneVerificationModal').style.display = 'flex';
}

function hideVerificationModal() {
  document.getElementById('phoneVerificationModal').style.display = 'none';
  document.getElementById('verificationError').style.display = 'none';
  document.getElementById('verificationCode').value = '';
}

// SOLVE ISSUE WHERE MODAL APPEARS ON PAGE LOAD 
window.addEventListener('DOMContentLoaded', function() {
  hideVerificationModal();
});

// CLOSE MODAL HANDLER
document.querySelector('#phoneVerificationModal .edit-modal-close').addEventListener('click', function() {
  hideVerificationModal();
});

// // SMS ROUTE TO SEND VERIFICATION CODE
// async function sendVerificationCode(phone, submitButton, originalText) {
//   try {
//     const response = await fetch('/sms/send-verification-code', {
//       method: 'POST',
//       headers: {
//         'Content-Type': 'application/json'
//       },
//       body: JSON.stringify({ phoneNumber: phone })
//     });

//     const data = await response.json();

//     if (!data.success) {
//       alert("❌ Failed to send verification code. Please try again.");
//       if (submitButton) {
//         submitButton.textContent = originalText;
//         submitButton.disabled = false;
//       }
//       return;
//     }

//     console.log("✅ Verification code sent:", data.details);
//     alert("✅ Verification code sent successfully! Please check your phone.");

//   } catch (error) {
//     console.error("❌ Error sending verification code:", error);
//     alert("❌ An error occurred. Please try again.");
//   } finally {
//     if (submitButton) {
//       submitButton.textContent = originalText;
//       submitButton.disabled = false;
//     }
//   }
// }

// // SMS ROUTE TO CHECK VERIFICATION STATUS
// async function checkVerificationStatus(phone, code, submitButton, originalText) {
//   try {
//     const response = await fetch('/sms/check-verification-status', {
//       method: 'POST',
//       headers: {
//         'Content-Type': 'application/json'
//       },
//       body: JSON.stringify({
//         phoneNumber: phone,
//         code: code
//       })
//     });

//     const data = await response.json();

//     if (!data.success) {
//       alert("❌ Verification failed. Please check the code and try again.");
//       if (submitButton) {
//         submitButton.textContent = originalText;
//         submitButton.disabled = false;
//       }
//       return;
//     }

//     console.log("✅ Verification successful:", data.details);
//     alert("✅ Phone number verified successfully!");

//     hideVerificationModal();
//     completeRegistration(phone);

//   } catch (error) {
//     console.error("❌ Error verifying code:", error);
//     alert("❌ An error occurred during verification. Please try again.");
//   } finally {
//     if (submitButton) {
//       submitButton.textContent = originalText;
//       submitButton.disabled = false;
//     }
//   }
// }

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
  const language = document.getElementById("language").value;

  // Check if all fields are filled
  if (!role || !email || !password || !confirmPassword || !firstNameRaw || !lastNameRaw || !dob || !phoneRaw || !gender || !language) {
    alert("❌ Please fill in all fields.");
    return;
  }

  // Sanitize inputs
  const firstName = sanitizeName(firstNameRaw);
  const lastName = sanitizeName(lastNameRaw);
  const phone = formatPhoneNumber(phoneRaw);

  // Validate names
  if (!firstName || !lastName) {
    alert("❌ Please enter valid names (letters, spaces, and hyphens only).");
    return;
  }

  // Validate phone
  if (!isValidPhone(phone)) {
    document.getElementById("phoneWarning").style.display = 'block';
    alert("❌ Please enter a valid phone number. Singapore numbers should start with +65 followed by 8 digits (6, 8, or 9).");
    return;
  }

  // Check if phone is Singapore number and has correct format
  if (phone.startsWith('+65')) {
    if (phone.length !== 11) {
      document.getElementById("phoneWarning").style.display = 'block';
      alert("❌ Singapore phone number must be exactly 8 digits after +65.");
      return;
    }
  }

  // Validate password match
  if (password !== confirmPassword) {
    document.getElementById("passwordWarning").style.display = 'block';
    alert("❌ Passwords do not match.");
    return;
  }

  // Validate password strength
  if (!isPasswordValid(password)) {
    document.getElementById("passwordWarning").style.display = 'block';
    alert("❌ Password must be at least 8 characters long and include:\n• At least one uppercase letter\n• At least one symbol (!@#$%^&*)\n• Letters and numbers (alphanumeric)");
    return;
  }

  // Show loading state
  const submitButton = document.querySelector('button[type="submit"]');
  const originalText = submitButton.textContent;
  submitButton.textContent = '⏳ Checking...';
  submitButton.disabled = true;

  try {
    // Check if email already exists
    const emailExists = await checkEmailExists(email);
    if (emailExists) {
      alert("❌ An account with this email already exists. Please use a different email or try logging in.");
      submitButton.textContent = originalText;
      submitButton.disabled = false;
      return;
    }

    // // Send Verification Code
    // await sendVerificationCode(phone, submitButton, originalText);

    // // Show verification modal instead of proceeding with registration
    // showVerificationModal(phone);

    
  } catch (error) {
    console.error("Error during registration:", error);
    alert("❌ An error occurred. Please try again.");
  } finally {
    submitButton.textContent = originalText;
    submitButton.disabled = false;
  }

    completeRegistration();
    
});

// // VERIFICATION BUTTON HANDLERS
// document.getElementById("verifyCodeBtn").addEventListener("click", async function() {
//   const phone = document.getElementById('phoneVerify').textContent;
//   const code = document.getElementById('verificationCode').value;
//   const submitButton = document.getElementById('verifyCodeBtn');
//   const originalText = submitButton.textContent;
  
//   if (!code) {
//     alert("❌ Please enter the verification code.");
//     return;
//   }

//   submitButton.textContent = '⏳ Verifying...';
//   submitButton.disabled = true;
  
//   await checkVerificationStatus(phone, code, submitButton, originalText);
// });

// document.getElementById("resendCodeBtn").addEventListener("click", async function() {
//   const phone = document.getElementById('phoneVerify').textContent;
//   const submitButton = document.getElementById('resendCodeBtn');
//   const originalText = submitButton.textContent;
  
//   submitButton.textContent = '⏳ Sending...';
//   submitButton.disabled = true;
  
//   // await sendVerificationCode(phone, submitButton, originalText);
// });

// CONTINUE WITH REGISTRATION AFTER VERIFICATION
async function completeRegistration() {
  const role = document.getElementById("role").value;
  const email = document.getElementById("email").value.trim().toLowerCase();
  const password = document.getElementById("password").value;
  const firstName = sanitizeName(document.getElementById("firstName").value.trim());
  const lastName = sanitizeName(document.getElementById("lastName").value.trim());
  const dob = document.getElementById("dob").value;
  const gender = document.getElementById("gender").value;
  const language = document.getElementById("language").value;

  const submitButton = document.querySelector('button[type="submit"]');
  const originalText = submitButton.textContent;
  submitButton.textContent = '⏳ Creating account...';
  submitButton.disabled = true;

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
      language,
      authId: uid,
      userId
    });

    // Step 6: Success - redirect to login
    alert("✅ Account created successfully! Please log in with your credentials.");
    
    // Sign out the user immediately after registration
    await signOut(auth);
    
    window.location.href = "login.html";

  } catch (err) {
    console.error("Registration error:", err);
    
    // Handle specific Firebase Auth errors
    let errorMessage = "❌ Registration failed. ";
    
    if (err.code === 'auth/email-already-in-use') {
      errorMessage += "This email is already registered. Please use a different email.";
    } else if (err.code === 'auth/invalid-email') {
      errorMessage += "Please enter a valid email address.";
    } else if (err.code === 'auth/weak-password') {
      errorMessage += "Password is too weak. Please choose a stronger password.";
    } else if (err.code === 'auth/network-request-failed') {
      errorMessage += "Network error. Please check your internet connection.";
    } else {
      errorMessage += "Please try again or contact support.";
    }
    
    alert(errorMessage);
    
    // Restore button state
    submitButton.textContent = originalText;
    submitButton.disabled = false;
  }
}