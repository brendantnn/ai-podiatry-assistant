// ========================================
// SIMPLE PAGE PROTECTION SCRIPT
// File: js/utils/pageProtection.js
// Include this at the top of patient.html and podiatrist.html
// ========================================

(function() {
  'use strict';
  
  console.log("🛡️ Simple page protection initialized");
  
  // ========================================
  // BASIC SESSION CHECK
  // ========================================
  
  function checkLogin() {
    const uid = sessionStorage.getItem('uid');
    const role = sessionStorage.getItem('role');
    
    if (!uid || !role) {
      console.log("🔐 No valid session found - redirecting to login");
      alert("Please log in to access this page.");
      window.location.href = 'login.html';
      return false;
    }
    
    return true;
  }
  
  // ========================================
  // ROLE-BASED ACCESS CONTROL
  // ========================================
  
  function checkPageAccess() {
    const currentPage = window.location.pathname.split('/').pop();
    const userRole = sessionStorage.getItem('role');
    
    // Define page access rules
    const pageRoles = {
      'patient.html': 'patient',
      'podiatrist.html': 'podiatrist'
    };
    
    const requiredRole = pageRoles[currentPage];
    
    if (requiredRole && userRole !== requiredRole) {
      console.log(`🔐 Access denied: ${currentPage} requires ${requiredRole} role, but user has ${userRole}`);
      
      // Redirect to correct dashboard
      const correctPage = userRole === 'patient' ? 'patient.html' : 'podiatrist.html';
      alert(`Access denied. Redirecting to your ${userRole} dashboard.`);
      window.location.href = correctPage;
      return false;
    }
    
    return true;
  }
  
  // ========================================
  // USER INFO DISPLAY
  // ========================================
  
  function updateUserInfo() {
    const firstName = sessionStorage.getItem('firstName') || 'User';
    const lastName = sessionStorage.getItem('lastName') || '';
    const userId = sessionStorage.getItem('userId') || 'Unknown';
    const role = sessionStorage.getItem('role') || 'User';
    
    // Update patient name if element exists
    const patientNameEl = document.getElementById('patient-name');
    if (patientNameEl) {
      patientNameEl.textContent = `${firstName} ${lastName}`.trim();
    }
    
    // Update patient ID if element exists
    const patientIdEl = document.getElementById('patient-id');
    if (patientIdEl) {
      patientIdEl.textContent = userId;
    }
    
    // Update podiatrist name placeholders
    const podiatristNameEls = document.querySelectorAll('[data-user-name]');
    podiatristNameEls.forEach(el => {
      el.textContent = `${firstName} ${lastName}`.trim();
    });
    
    // Replace role placeholders
    const roleEls = document.querySelectorAll('[data-user-role]');
    roleEls.forEach(el => {
      el.textContent = role.charAt(0).toUpperCase() + role.slice(1);
    });
    
    // Update current date placeholders
    const today = new Date().toLocaleDateString('en-SG', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    
    const dateEls = document.querySelectorAll('[data-current-date]');
    dateEls.forEach(el => {
      el.textContent = today;
    });
    
    console.log(`✅ User info updated for ${role}: ${firstName} ${lastName}`);
  }
  
  // ========================================
  // SIMPLE LOGOUT FUNCTIONALITY
  // ========================================
  
  function setupLogout() {
    // Find all logout buttons
    const logoutButtons = document.querySelectorAll('button[onclick*="logout"], .logout-btn, [data-action="logout"]');
    
    logoutButtons.forEach(button => {
      button.addEventListener('click', function(e) {
        e.preventDefault();
        
        if (confirm('Are you sure you want to logout?')) {
          console.log("🚪 Logging out user");
          
          // Clear session storage
          sessionStorage.clear();
          
          // Show logout message
          const message = document.createElement('div');
          message.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: #3b82f6;
            color: white;
            padding: 1rem 2rem;
            border-radius: 8px;
            z-index: 9999;
            text-align: center;
          `;
          message.innerHTML = '👋 Logging out...';
          document.body.appendChild(message);
          
          // Redirect after short delay
          setTimeout(() => {
            window.location.href = 'login.html';
          }, 1500);
        }
      });
    });
  }
  
  // ========================================
  // INITIALIZATION
  // ========================================
  
  function init() {
    // Immediate session and access checks
    if (!checkLogin()) return;
    if (!checkPageAccess()) return;
    
    // Update user info when DOM is ready
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        updateUserInfo();
        setupLogout();
      });
    } else {
      updateUserInfo();
      setupLogout();
    }
    
    console.log("✅ Simple page protection initialized");
  }
  
  // ========================================
  // PREVENT BACK BUTTON AFTER LOGOUT
  // ========================================
  
  function preventBackAfterLogout() {
    window.addEventListener('pageshow', function(event) {
      if (event.persisted) {
        // Page was loaded from cache - check session
        if (!checkLogin()) {
          return;
        }
      }
    });
  }
  
  // Start initialization
  init();
  preventBackAfterLogout();
  
})();

// ========================================
// GLOBAL UTILITY FUNCTIONS
// ========================================

// Check if user is logged in (can be called from other scripts)
window.isLoggedIn = function() {
  const uid = sessionStorage.getItem('uid');
  const role = sessionStorage.getItem('role');
  return !!(uid && role);
};

// Get current user info (can be called from other scripts)
window.getCurrentUser = function() {
  if (!window.isLoggedIn()) {
    return null;
  }
  
  return {
    uid: sessionStorage.getItem('uid'),
    email: sessionStorage.getItem('email'),
    role: sessionStorage.getItem('role'),
    userId: sessionStorage.getItem('userId'),
    firstName: sessionStorage.getItem('firstName'),
    lastName: sessionStorage.getItem('lastName'),
    fullName: `${sessionStorage.getItem('firstName')} ${sessionStorage.getItem('lastName')}`.trim()
  };
};

// Simple logout (can be called from other scripts)
window.logout = function() {
  if (confirm('Are you sure you want to logout?')) {
    sessionStorage.clear();
    window.location.href = 'login.html';
  }
};

console.log("🛡️ Simple page protection script loaded");