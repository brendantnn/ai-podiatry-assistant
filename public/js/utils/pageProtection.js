// ========================================
// PAGE PROTECTION UTILITY
// File: js/utils/pageProtection.js
// ========================================

// This script should be loaded FIRST on protected pages
// It provides immediate protection before other scripts load

(function () {
  'use strict';

  console.log('🛡️ Page Protection initializing...');

  // ========================================
  // IMMEDIATE PROTECTION CHECK
  // ========================================

  function checkSessionImmediate() {
    const uid = sessionStorage.getItem('uid');
    const role = sessionStorage.getItem('role');
    const email = sessionStorage.getItem('email');
    const isActive = sessionStorage.getItem('isActive');
    const lastActivity = parseInt(sessionStorage.getItem('lastActivity')) || 0;

    // Check if session data exists
    if (!uid || !role || !email) {
      console.warn('⚠️ No valid session found - redirecting to login');
      redirectToLogin('No session data');
      return false;
    }

    // Check if session is marked as active
    if (isActive === 'false') {
      console.warn('⚠️ Session marked inactive - redirecting to login');
      redirectToLogin('Session inactive');
      return false;
    }

    // Check activity timeout (30 minutes)
    const sessionTimeout = 30 * 60 * 1000; // 30 minutes
    const timeSinceActivity = Date.now() - lastActivity;

    if (timeSinceActivity > sessionTimeout) {
      console.warn('⚠️ Session expired due to inactivity - redirecting to login');
      redirectToLogin('Session timeout');
      return false;
    }

    return true;
  }

  // ========================================
  // ROLE-BASED PAGE ACCESS
  // ========================================

  function checkPageAccess() {
    const currentPage = window.location.pathname.split('/').pop();
    const userRole = sessionStorage.getItem('role');

    // Define page access rules
    const pageAccess = {
      'patient.html': ['patient'],
      'podiatrist.html': ['podiatrist'],
      'login.html': ['*'], // Anyone can access
      'register.html': ['*'], // Anyone can access
      'index.html': ['*'] // Anyone can access
    };

    const allowedRoles = pageAccess[currentPage];

    if (!allowedRoles) {
      console.warn('⚠️ Unknown page - allowing access');
      return true;
    }

    if (allowedRoles.includes('*')) {
      // Public page - anyone can access
      return true;
    }

    if (!allowedRoles.includes(userRole)) {
      console.warn(`⚠️ Access denied - ${userRole} cannot access ${currentPage}`);
      redirectToLogin(`Access denied for role: ${userRole}`);
      return false;
    }

    return true;
  }

  // ========================================
  // REDIRECT HANDLER
  // ========================================

  function redirectToLogin(reason) {
    console.log(`🚪 Redirecting to login: ${reason}`);

    // Clear potentially corrupted session data
    try {
      sessionStorage.clear();
    } catch (e) {
      console.error('Error clearing session:', e);
    }

    // Show brief message before redirect
    showRedirectMessage(reason);

    // Redirect after short delay
    setTimeout(() => {
      window.location.href = 'login.html';
    }, 1500);
  }

  function showRedirectMessage(reason) {
    // Create overlay
    const overlay = document.createElement('div');
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.8);
      color: white;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      z-index: 999999;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    `;

    overlay.innerHTML = `
      <div style="text-align: center; max-width: 400px; padding: 2rem;">
        <div style="font-size: 4rem; margin-bottom: 1rem;">🔒</div>
        <h2 style="margin-bottom: 1rem; color: #fbbf24;">Session Required</h2>
        <p style="margin-bottom: 1.5rem; opacity: 0.9; line-height: 1.5;">
          ${reason}. Please log in to continue.
        </p>
        <div style="display: flex; align-items: center; justify-content: center; gap: 0.5rem;">
          <div style="
            width: 20px;
            height: 20px;
            border: 2px solid #ffffff40;
            border-top: 2px solid #ffffff;
            border-radius: 50%;
            animation: spin 1s linear infinite;
          "></div>
          <span>Redirecting to login...</span>
        </div>
      </div>
    `;

    // Add to page immediately
    document.documentElement.appendChild(overlay);
  }

  // ========================================
  // PREVENT BACK BUTTON BYPASS
  // ========================================

  function preventBackButtonBypass() {
    // Add state to history to prevent back button bypass
    if (window.history && window.history.pushState) {
      window.history.pushState(null, null, window.location.href);

      window.addEventListener('popstate', function () {
        // If user tries to go back and session is invalid, redirect to login
        if (!checkSessionImmediate()) {
          window.history.pushState(null, null, window.location.href);
          redirectToLogin('Back button security check failed');
        }
      });
    }
  }

  // ========================================
  // CONTENT PROTECTION
  // ========================================

  function protectPageContent() {
    // Hide page content initially
    const style = document.createElement('style');
    style.id = 'pageProtectionStyle';
    style.textContent = `
      body { 
        visibility: hidden !important; 
        opacity: 0 !important;
      }
      
      @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
    `;
    document.head.appendChild(style);

    // Show content only after validation
    function showContent() {
      const protectionStyle = document.getElementById('pageProtectionStyle');
      if (protectionStyle) {
        protectionStyle.remove();
      }

      // Fade in content
      document.body.style.visibility = 'visible';
      document.body.style.opacity = '0';
      document.body.style.transition = 'opacity 0.3s ease-in';

      setTimeout(() => {
        document.body.style.opacity = '1';
      }, 50);
    }

    return showContent;
  }

  // ========================================
  // DEVELOPER CONSOLE WARNING
  // ========================================

  function showConsoleWarning() {
    console.log('%c⚠️ SECURITY WARNING', 'color: red; font-size: 20px; font-weight: bold;');
    console.log('%cThis is a browser feature intended for developers. Do not paste any code here that you don\'t understand. Malicious scripts could compromise your account security.', 'color: red; font-size: 14px;');
    console.log('%cIf someone told you to copy-paste something here, it\'s likely a scam.', 'color: red; font-size: 14px; font-weight: bold;');
  }

  // ========================================
  // MAIN PROTECTION EXECUTION
  // ========================================

  function initPageProtection() {
    const currentPage = window.location.pathname.split('/').pop();

    // Skip protection for public pages
    if (['login.html', 'register.html', 'index.html', ''].includes(currentPage)) {
      console.log('📖 Public page - skipping protection');
      return;
    }

    console.log('🛡️ Initializing page protection for:', currentPage);

    // Set up content protection
    const showContent = protectPageContent();

    // Perform immediate checks
    const hasValidSession = checkSessionImmediate();
    const hasPageAccess = hasValidSession ? checkPageAccess() : false;

    if (hasValidSession && hasPageAccess) {
      console.log('✅ Session valid - allowing page access');

      // Show content after brief delay to prevent flash
      setTimeout(showContent, 100);

      // Set up additional protections
      preventBackButtonBypass();
      showConsoleWarning();

      // Update last activity
      sessionStorage.setItem('lastActivity', Date.now().toString());

    } else {
      console.log('❌ Protection check failed');
      // redirectToLogin will be called by the check functions
    }
  }

  // ========================================
  // ENHANCED SESSION VALIDATION
  // ========================================

  function validateSessionFormat() {
    try {
      const uid = sessionStorage.getItem('uid');
      const email = sessionStorage.getItem('email');
      const role = sessionStorage.getItem('role');

      // Basic format validation
      if (uid && uid.length < 10) {
        console.warn('⚠️ UID format invalid');
        return false;
      }

      if (email && !email.includes('@')) {
        console.warn('⚠️ Email format invalid');
        return false;
      }

      if (role && !['patient', 'podiatrist'].includes(role)) {
        console.warn('⚠️ Role format invalid');
        return false;
      }

      return true;
    } catch (error) {
      console.error('❌ Session validation error:', error);
      return false;
    }
  }

  // ========================================
  // GLOBAL FUNCTIONS
  // ========================================

  // Make some functions globally available
  window.pageProtection = {
    checkSession: checkSessionImmediate,
    validateFormat: validateSessionFormat,
    forceRecheck: initPageProtection
  };

  // ========================================
  // AUTO-INITIALIZATION
  // ========================================

  // Run protection immediately
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initPageProtection);
  } else {
    initPageProtection();
  }

  console.log('✅ Page Protection utility loaded');

})();