// ========================================
// LOGOUT FUNCTIONALITY MODULE
// File: js/logout.js
// ========================================

// Import Firebase functions
import { auth } from "./config/firebase-config.js";
import { signOut } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-auth.js";

// ========================================
// LOGOUT IMPLEMENTATION
// ========================================

// Show logout confirmation modal
function handleLogout() {
  const modal = document.getElementById('logoutModal');
  if (!modal) {
    console.error('Logout modal not found');
    // Fallback to simple confirmation
    if (confirm('Are you sure you want to logout?')) {
      confirmLogout();
    }
    return;
  }
  
  modal.classList.remove('hidden');
  modal.style.animation = 'fadeIn 0.3s ease-out';
}

// Cancel logout and hide modal
function cancelLogout() {
  const modal = document.getElementById('logoutModal');
  if (modal) {
    modal.classList.add('hidden');
  }
}

// Confirm logout and execute
async function confirmLogout() {
  const modal = document.getElementById('logoutModal');
  
  if (modal) {
    // Show loading state
    modal.innerHTML = `
      <div style="
        background: white;
        padding: 2rem;
        border-radius: 12px;
        max-width: 400px;
        text-align: center;
        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
      ">
        <div style="
          width: 40px;
          height: 40px;
          border: 4px solid #f3f4f6;
          border-top: 4px solid #ef4444;
          border-radius: 50%;
          animation: spin 1s linear infinite;
          margin: 0 auto 1rem;
        "></div>
        <h3 style="color: #374151; margin-bottom: 0.5rem;">Logging out...</h3>
        <p style="color: #6b7280; margin: 0;">Please wait while we sign you out securely.</p>
      </div>
    `;
  }

  try {
    console.log("🚪 Starting logout process...");

    // Sign out from Firebase
    if (auth && signOut) {
      await signOut(auth);
      console.log("🔥 Firebase sign out successful");
    } else {
      console.warn("⚠️ Firebase auth not available, proceeding with session clear");
    }

    // Clear all session data
    sessionStorage.clear();
    localStorage.clear();
    
    console.log("🗑️ Session data cleared successfully");

    if (modal) {
      // Show success message briefly
      modal.innerHTML = `
        <div style="
          background: white;
          padding: 2rem;
          border-radius: 12px;
          max-width: 400px;
          text-align: center;
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
        ">
          <div style="font-size: 3rem; margin-bottom: 1rem;">✅</div>
          <h3 style="color: #059669; margin-bottom: 0.5rem;">Logged out successfully!</h3>
          <p style="color: #6b7280; margin: 0;">Redirecting to login page...</p>
        </div>
      `;
    }

    // Redirect to login page after short delay
    setTimeout(() => {
      window.location.href = 'login.html';
    }, 1500);

  } catch (error) {
    console.error('❌ Logout error:', error);
    
    if (modal) {
      // Show error but still redirect
      modal.innerHTML = `
        <div style="
          background: white;
          padding: 2rem;
          border-radius: 12px;
          max-width: 400px;
          text-align: center;
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
        ">
          <div style="font-size: 3rem; margin-bottom: 1rem;">⚠️</div>
          <h3 style="color: #f59e0b; margin-bottom: 0.5rem;">Logout Warning</h3>
          <p style="color: #6b7280; margin: 0;">There was an issue, but you're being logged out for security.</p>
        </div>
      `;
    }

    // Force logout even if there's an error
    sessionStorage.clear();
    localStorage.clear();
    
    setTimeout(() => {
      window.location.href = 'login.html';
    }, 2000);
  }
}

// ========================================
// QUICK LOGOUT (NO CONFIRMATION)
// ========================================

// Quick logout function for emergency or programmatic use
async function quickLogout(message = 'Logging out...') {
  try {
    console.log("🚨 Quick logout initiated:", message);
    
    // Sign out from Firebase
    if (auth && signOut) {
      await signOut(auth);
    }
    
    // Clear session data
    sessionStorage.clear();
    localStorage.clear();
    
    // Show brief message
    showLogoutMessage(message, 'info');
    
    // Redirect immediately
    setTimeout(() => {
      window.location.href = 'login.html';
    }, 1000);
    
  } catch (error) {
    console.error('Quick logout error:', error);
    // Force logout even with error
    sessionStorage.clear();
    localStorage.clear();
    window.location.href = 'login.html';
  }
}

// ========================================
// UTILITY FUNCTIONS
// ========================================

// Show logout message
function showLogoutMessage(message, type = 'info') {
  const messageDiv = document.createElement('div');
  messageDiv.style.cssText = `
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: ${type === 'error' ? '#ef4444' : '#3b82f6'};
    color: white;
    padding: 1rem 2rem;
    border-radius: 8px;
    z-index: 10001;
    text-align: center;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    animation: fadeIn 0.3s ease-out;
  `;
  messageDiv.innerHTML = message;
  document.body.appendChild(messageDiv);
  
  // Auto-remove after delay
  setTimeout(() => {
    if (messageDiv.parentNode) {
      messageDiv.remove();
    }
  }, 3000);
}

// Update user info on page load
function updateUserInfo() {
  try {
    // Get user data from session storage
    const firstName = sessionStorage.getItem('firstName') || 'Unknown';
    const lastName = sessionStorage.getItem('lastName') || 'User';
    const userId = sessionStorage.getItem('userId') || 'Unknown';
    const role = sessionStorage.getItem('role') || 'User';
    
    console.log(`📝 Updating user info: ${firstName} ${lastName} (${role})`);
    
    // Update podiatrist name
    const podiatristNameEl = document.getElementById('podiatrist-name');
    if (podiatristNameEl) {
      podiatristNameEl.textContent = `${firstName} ${lastName}`.trim();
    }
    
    // Update patient name
    const patientNameEl = document.getElementById('patient-name');
    if (patientNameEl) {
      patientNameEl.textContent = `${firstName} ${lastName}`.trim();
    }
    
    // Update patient ID
    const patientIdEl = document.getElementById('patient-id');
    if (patientIdEl) {
      patientIdEl.textContent = userId;
    }
    
    // Update current date
    const currentDateEl = document.getElementById('current-date');
    if (currentDateEl) {
      const today = new Date().toLocaleDateString('en-SG', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
      currentDateEl.textContent = today;
    }
    
    console.log(`✅ User info updated successfully`);
    
  } catch (error) {
    console.error('❌ Error updating user info:', error);
  }
}

// ========================================
// SESSION VALIDATION
// ========================================

// Check if user is properly logged in
function validateSession() {
  const uid = sessionStorage.getItem('uid');
  const role = sessionStorage.getItem('role');
  const email = sessionStorage.getItem('email');
  
  if (!uid || !role || !email) {
    console.warn('⚠️ Invalid session detected');
    showLogoutMessage('Invalid session. Please log in again.', 'error');
    setTimeout(() => {
      window.location.href = 'login.html';
    }, 2000);
    return false;
  }
  
  return true;
}

// ========================================
// AUTO-LOGOUT FUNCTIONALITY
// ========================================

// Auto logout after period of inactivity (optional)
let inactivityTimer;
const INACTIVITY_TIMEOUT = 30 * 60 * 1000; // 30 minutes

function resetInactivityTimer() {
  clearTimeout(inactivityTimer);
  inactivityTimer = setTimeout(() => {
    console.log('🕐 Session timeout due to inactivity');
    quickLogout('Session expired due to inactivity');
  }, INACTIVITY_TIMEOUT);
}

function startInactivityMonitoring() {
  const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];
  
  events.forEach(event => {
    document.addEventListener(event, resetInactivityTimer, true);
  });
  
  // Start the timer
  resetInactivityTimer();
  console.log('⏱️ Inactivity monitoring started (30 min timeout)');
}

// ========================================
// INITIALIZATION
// ========================================

// Initialize logout functionality when DOM is ready
function initLogout() {
  console.log('🔧 Initializing logout functionality...');
  
  // Validate session
  if (!validateSession()) {
    return;
  }
  
  // Update user info
  updateUserInfo();
  
  // Start inactivity monitoring (optional - uncomment to enable)
  // startInactivityMonitoring();
  
  console.log('✅ Logout functionality initialized');
}

// ========================================
// EXPORT FUNCTIONS
// ========================================

// Make functions globally available
window.handleLogout = handleLogout;
window.cancelLogout = cancelLogout;
window.confirmLogout = confirmLogout;
window.quickLogout = quickLogout;
window.updateUserInfo = updateUserInfo;
window.validateSession = validateSession;

// ========================================
// AUTO-INITIALIZATION
// ========================================

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initLogout);
} else {
  initLogout();
}

// Add required CSS for animations
const style = document.createElement('style');
style.textContent = `
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
  
  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }
  
  .hidden {
    display: none !important;
  }
`;
document.head.appendChild(style);

console.log("✅ Logout module loaded successfully");