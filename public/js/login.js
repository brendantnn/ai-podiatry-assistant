// ========================================
// ENHANCED LOGIN SYSTEM WITH SESSION MANAGEMENT
// File: js/login.js (replace existing content)
// ========================================

import { auth, db } from "./config/firebase-config.js";
import { 
  signInWithEmailAndPassword, 
  signOut, 
  sendPasswordResetEmail,
  onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/10.11.0/firebase-auth.js";
import { 
  collection, 
  query, 
  where, 
  updateDoc, 
  doc, 
  getDocs 
} from "https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js";

// ========================================
// LOGIN SECURITY & RATE LIMITING
// ========================================

let loginAttempts = 0;
let isLocked = false;
const maxAttempts = 5;
const lockoutTime = 60 * 1000; // 1 minute

// ========================================
// INITIALIZATION
// ========================================

document.addEventListener('DOMContentLoaded', function() {
  console.log('🔐 Enhanced login system initializing...');
  
  // Check for existing session
  checkExistingSession();
  
  console.log('✅ Enhanced login system ready');
});

// ========================================
// SESSION MANAGEMENT INTEGRATION
// ========================================

function checkExistingSession() {
  const uid = sessionStorage.getItem('uid');
  const role = sessionStorage.getItem('role');
  const lastActivity = parseInt(sessionStorage.getItem('lastActivity')) || 0;
  
  if (uid && role) {
    const timeSinceActivity = Date.now() - lastActivity;
    const sessionTimeout = 30 * 60 * 1000; // 30 minutes
    
    if (timeSinceActivity < sessionTimeout) {
      console.log("🔍 Valid existing session found, redirecting...");
      showMessage("Welcome back! Redirecting...", 'success');
      
      setTimeout(() => {
        const redirectUrl = role === "patient" ? "patient.html" : "podiatrist.html";
        window.location.href = redirectUrl;
      }, 1000);
    } else {
      console.log("🕐 Existing session expired, clearing...");
      sessionStorage.clear();
    }
  }
}

// ========================================
// UI HELPER FUNCTIONS
// ========================================

function showLoading(show = true) {
  const submitBtn = document.querySelector('#loginForm button[type="submit"]');
  
  if (show) {
    submitBtn.disabled = true;
    submitBtn.innerHTML = `
      <div style="display: flex; align-items: center; gap: 8px;">
        <div style="width: 16px; height: 16px; border: 2px solid #ffffff40; border-top: 2px solid #ffffff; border-radius: 50%; animation: spin 1s linear infinite;"></div>
        Logging in...
      </div>
    `;
  } else {
    submitBtn.disabled = false;
    submitBtn.innerHTML = '✨ Login to System';
  }
}

function showMessage(message, type = 'error') {
  // Remove existing message
  const existingMessage = document.getElementById('loginMessage');
  if (existingMessage) {
    existingMessage.remove();
  }

  // Create new message
  const messageDiv = document.createElement('div');
  messageDiv.id = 'loginMessage';
  messageDiv.style.cssText = `
    padding: 12px 16px;
    border-radius: 8px;
    margin-bottom: 16px;
    font-size: 0.9rem;
    font-weight: 500;
    animation: fadeIn 0.3s ease-out;
  `;

  if (type === 'error') {
    messageDiv.style.background = '#fef2f2';
    messageDiv.style.color = '#dc2626';
    messageDiv.style.border = '1px solid #fecaca';
    messageDiv.innerHTML = `❌ ${message}`;
  } else if (type === 'success') {
    messageDiv.style.background = '#f0fdf4';
    messageDiv.style.color = '#16a34a';
    messageDiv.style.border = '1px solid #bbf7d0';
    messageDiv.innerHTML = `✅ ${message}`;
  } else if (type === 'warning') {
    messageDiv.style.background = '#fffbeb';
    messageDiv.style.color = '#d97706';
    messageDiv.style.border = '1px solid #fed7aa';
    messageDiv.innerHTML = `⚠️ ${message}`;
  }

  // Insert before the form
  const form = document.getElementById('loginForm');
  form.parentNode.insertBefore(messageDiv, form);

  // Auto-remove after 5 seconds
  setTimeout(() => {
    if (messageDiv.parentNode) {
      messageDiv.remove();
    }
  }, 5000);
}

function validateForm(role, email, password) {
  if (!role) {
    showMessage('Please select your user type.');
    return false;
  }

  if (!email) {
    showMessage('Please enter your email address.');
    return false;
  }

  // Email format validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    showMessage('Please enter a valid email address.');
    return false;
  }

  if (!password) {
    showMessage('Please enter your password.');
    return false;
  }

  return true;
}

// ========================================
// LOCKOUT FUNCTIONALITY
// ========================================

function lockLoginTemporarily() {
  isLocked = true;
  const seconds = lockoutTime / 1000;
  showMessage(`Too many failed attempts. Please try again in ${seconds} seconds.`, 'warning');
  
  // Show countdown
  let remaining = seconds;
  const countdown = setInterval(() => {
    remaining--;
    if (remaining > 0) {
      showMessage(`Too many failed attempts. Please try again in ${remaining} seconds.`, 'warning');
    } else {
      clearInterval(countdown);
      isLocked = false;
      loginAttempts = 0;
      showMessage('You can now try logging in again.', 'success');
    }
  }, 1000);
}

// ========================================
// PASSWORD RESET FUNCTIONALITY
// ========================================

window.openModal = () => {
  const modal = document.getElementById("forgotModal");
  modal.classList.remove("hidden");
  modal.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 1000;
    animation: fadeIn 0.3s ease-out;
  `;
  
  // Focus on email input
  setTimeout(() => {
    document.getElementById("resetEmail").focus();
  }, 100);
};

window.closeModal = () => {
  const modal = document.getElementById("forgotModal");
  modal.classList.add("hidden");
  modal.style.display = "none";
  
  // Clear the reset email field
  document.getElementById("resetEmail").value = "";
};

window.sendReset = async () => {
  const email = document.getElementById("resetEmail").value.trim().toLowerCase();
  
  if (!email) {
    alert("Please enter your email address.");
    return;
  }

  // Email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    alert("Please enter a valid email address.");
    return;
  }

  try {
    await sendPasswordResetEmail(auth, email);
    alert("📨 Password reset link sent to your email. Please check your inbox and spam folder.");
    closeModal();
  } catch (err) {
    console.error("Password reset error:", err);
    
    let errorMessage = "Failed to send password reset email.";
    switch (err.code) {
      case 'auth/user-not-found':
        errorMessage = "No account found with this email address.";
        break;
      case 'auth/invalid-email':
        errorMessage = "Invalid email address format.";
        break;
      case 'auth/too-many-requests':
        errorMessage = "Too many reset attempts. Please try again later.";
        break;
    }
    
    alert(`❌ ${errorMessage}`);
  }
};

// ========================================
// ENHANCED SESSION CREATION
// ========================================

async function createSecureSession(userData, userCredential) {
  console.log("🔐 Creating secure session...");
  
  const sessionData = {
    // Basic user info
    uid: userCredential.user.uid,
    email: userData.email,
    role: userData.role,
    userId: userData.userId,
    firstName: userData.firstName,
    lastName: userData.lastName,
    
    // Session metadata
    sessionStart: Date.now(),
    lastActivity: Date.now(),
    isActive: true,
    
    // Security info
    loginTime: new Date().toISOString(),
    userAgent: navigator.userAgent,
    ipAddress: await getUserIP(),
    
    // User preferences
    preferredLanguage: userData.preferredLanguage || 'en',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
  };

  // Store in sessionStorage (more secure than localStorage)
  Object.keys(sessionData).forEach(key => {
    sessionStorage.setItem(key, sessionData[key]);
  });

   // Store currentPodId separately for easy access
  sessionStorage.setItem('currentPodId', userData.podId || userData.userId);

  // Store complete user object as JSON
  sessionStorage.setItem('currentUser', JSON.stringify({
    uid: userCredential.user.uid,
    email: userData.email,
    role: userData.role,
    userId: userData.userId,
    firstName: userData.firstName,
    lastName: userData.lastName,
    podId: userData.podId || userData.userId
  }));

  console.log("✅ Secure session created successfully");
  return sessionData;

}

async function getUserIP() {
  try {
    const response = await fetch('https://api.ipify.org?format=json');
    const data = await response.json();
    return data.ip;
  } catch (error) {
    console.warn('Could not get IP address:', error);
    return 'unknown';
  }
}

// ========================================
// MAIN LOGIN HANDLER WITH SESSION MANAGEMENT
// ========================================

document.getElementById("loginForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  
  console.log("🔐 Enhanced login attempt started");
  
  // Get form values
  const role = document.getElementById("userType").value;
  const email = document.getElementById("email").value.trim().toLowerCase();
  const password = document.getElementById("password").value;

  // Validation
  if (!validateForm(role, email, password)) {
    return;
  }

  // Check lockout
  if (isLocked) {
    showMessage("Too many failed attempts. Please try again later.", 'warning');
    return;
  }

  // Show loading state
  showLoading(true);

  try {
    console.log("🔐 Attempting Firebase authentication...");
    
    // Authenticate with Firebase Auth
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const uid = userCredential.user.uid;
    
    console.log("✅ Firebase authentication successful, UID:", uid);

    // Reset login attempts on successful auth
    loginAttempts = 0;
    isLocked = false;

    // Query Firestore for user document by EMAIL
    console.log("🔍 Querying Firestore for user data...");
    const usersRef = collection(db, "Users");
    const userQuery = query(usersRef, where("email", "==", email));
    const querySnapshot = await getDocs(userQuery);

    if (querySnapshot.empty) {
      console.error("❌ User account not found in Firestore");
      showMessage("User account not found in database. Please contact support.");
      await signOut(auth);
      return;
    }

    if (querySnapshot.size > 1) {
      console.error("❌ Multiple user accounts found for email:", email);
      showMessage("Multiple accounts detected. Please contact support.");
      await signOut(auth);
      return;
    }

    const userDoc = querySnapshot.docs[0];
    const userData = userDoc.data();
    
    console.log("✅ Found user data:", {
      role: userData.role,
      email: userData.email,
      name: `${userData.firstName} ${userData.lastName}`
    });

    // Verify role matches
    if (userData.role !== role) {
      console.error("❌ Role mismatch:", { selected: role, actual: userData.role });
      showMessage(`This account is registered as a '${userData.role}', not '${role}'. Please select the correct user type.`);
      await signOut(auth);
      return;
    }

    // Update user activity in Firestore
    console.log("📝 Updating user activity...");
    await updateDoc(userDoc.ref, {
      lastLoginAt: new Date(),
      isActive: true,
      lastLoginIP: await getUserIP(),
      loginCount: (userData.loginCount || 0) + 1
    });

    // Create secure session
    const sessionData = await createSecureSession(userData, userCredential);

    // Show success message
    showMessage("Login successful! Setting up your session...", 'success');

    // Add security delay to prevent rapid login attempts
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Redirect after session setup
    setTimeout(() => {
      const redirectUrl = role === "patient" ? "patient.html" : "podiatrist.html";
      console.log(`🚀 Redirecting to: ${redirectUrl}`);
      window.location.href = redirectUrl;
    }, 1500);

    // Log successful login
    console.log("✅ Enhanced login completed successfully");

  } catch (err) {
    console.error("❌ Enhanced login failed:", err);
    
    loginAttempts++;
    
    // Handle specific Firebase auth errors
    let errorMessage = "Login failed. Please try again.";
    
    switch (err.code) {
      case 'auth/user-not-found':
        errorMessage = "No account found with this email address.";
        break;
      case 'auth/wrong-password':
        errorMessage = "Incorrect password. Please try again.";
        break;
      case 'auth/invalid-email':
        errorMessage = "Invalid email address format.";
        break;
      case 'auth/user-disabled':
        errorMessage = "This account has been disabled. Please contact support.";
        break;
      case 'auth/too-many-requests':
        errorMessage = "Too many failed attempts. Please try again later or reset your password.";
        break;
      case 'auth/invalid-credential':
        errorMessage = "Invalid email or password. Please check your credentials.";
        break;
      case 'auth/network-request-failed':
        errorMessage = "Network error. Please check your internet connection.";
        break;
      default:
        errorMessage = `Login failed: ${err.message}`;
    }

    showMessage(`${errorMessage} (Attempt ${loginAttempts}/${maxAttempts})`);

    // Check if we should lock the account
    if (loginAttempts >= maxAttempts) {
      lockLoginTemporarily();
    }

    // Log failed attempt with security info
    console.warn("🚨 Failed login attempt:", {
      email: email,
      role: role,
      attempt: loginAttempts,
      error: err.code,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent
    });

  } finally {
    showLoading(false);
  }
});

// ========================================
// SECURITY ENHANCEMENTS
// ========================================

// Prevent multiple login tabs
window.addEventListener('storage', function(e) {
  if (e.key === 'isActive' && e.newValue === 'true' && e.oldValue === 'false') {
    // Another tab logged in
    showMessage('Login detected in another tab', 'warning');
  }
});

// Clear any existing auth state on page load
window.addEventListener('load', async () => {
  try {
    // Only sign out if we're on login page and have no valid session
    if (auth.currentUser && !sessionStorage.getItem('uid')) {
      await signOut(auth);
      console.log('🧹 Cleared existing auth state');
    }
  } catch (error) {
    console.warn('Error clearing auth state:', error);
  }
});

// ========================================
// BASIC LOGOUT FUNCTIONALITY
// ========================================

window.logout = async function() {
  try {
    await signOut(auth);
    sessionStorage.clear();
    console.log("🚪 User logged out");
    window.location.href = 'login.html';
  } catch (error) {
    console.error('Logout error:', error);
    // Force redirect even if there's an error
    sessionStorage.clear();
    window.location.href = 'login.html';
  }
};

// Add CSS for loading spinner animation
const style = document.createElement('style');
style.textContent = `
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
  
  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(-10px); }
    to { opacity: 1; transform: translateY(0); }
  }
`;
document.head.appendChild(style);

console.log("🔐 Enhanced login system with session management loaded successfully");