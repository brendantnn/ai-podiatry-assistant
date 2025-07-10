// ========================================
// SESSION INITIALIZATION FOR PROTECTED PAGES
// File: js/utils/sessionInit.js
// Add this to podiatrist.html and patient.html
// ========================================

// FIXED: Correct import path (remove extra "utils/")
import { initSessionManager, protectPage, getSessionInfo } from "./sessionManager.js";

// ========================================
// PAGE SESSION INITIALIZATION
// ========================================

class PageSessionInit {
  constructor() {
    this.sessionManager = null;
    this.userRole = null;
    this.init();
  }

  async init() {
    console.log('🛡️ Initializing page session...');
    
    try {
      // Initialize session manager
      this.sessionManager = initSessionManager();
      
      // Get current page role requirement
      this.userRole = this.determineRequiredRole();
      
      // Protect the page
      if (!protectPage(this.userRole)) {
        console.error('❌ Page protection failed');
        return;
      }
      
      // Set up session monitoring
      this.setupSessionMonitoring();
      
      // Update UI with user info
      this.updateUserInterface();
      
      // Set up logout handlers
      this.setupLogoutHandlers();
      
      console.log('✅ Page session initialized successfully');
      
    } catch (error) {
      console.error('❌ Session initialization failed:', error);
      this.handleInitError(error);
    }
  }

  // ========================================
  // ROLE DETERMINATION
  // ========================================
  
  determineRequiredRole() {
    const currentPage = window.location.pathname.split('/').pop();
    
    const roleMap = {
      'podiatrist.html': 'podiatrist',
      'patient.html': 'patient'
    };
    
    return roleMap[currentPage] || null;
  }

  // ========================================
  // SESSION MONITORING
  // ========================================
  
  setupSessionMonitoring() {
    // Monitor session every 30 seconds
    setInterval(() => {
      this.checkSessionHealth();
    }, 30000);
    
    // Monitor storage changes (detect logout in other tabs)
    window.addEventListener('storage', (e) => {
      if (e.key === 'isActive' && e.newValue === 'false') {
        this.handleSessionTerminated('Logout detected in another tab');
      }
    });
    
    // Monitor page visibility changes
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) {
        // Page became visible, check session
        this.checkSessionHealth();
      }
    });
    
    console.log('👂 Session monitoring active');
  }

  checkSessionHealth() {
    const sessionInfo = getSessionInfo();
    
    if (!sessionInfo || !sessionInfo.isValid) {
      console.warn('⚠️ Session health check failed');
      this.handleSessionTerminated('Session validation failed');
      return;
    }
    
    // Check if session is about to expire (5 minutes warning)
    const timeUntilExpiry = sessionInfo.timeUntilExpiry;
    if (timeUntilExpiry < 5 * 60 * 1000 && timeUntilExpiry > 4 * 60 * 1000) {
      this.showExpiryWarning(Math.floor(timeUntilExpiry / 60000));
    }
  }

  // ========================================
  // UI UPDATES
  // ========================================
  
  updateUserInterface() {
    const sessionInfo = getSessionInfo();
    if (!sessionInfo) return;
    
    try {
      // Update user name displays
      const nameElements = document.querySelectorAll('[id*="name"], [class*="name"]');
      const fullName = `${sessionInfo.firstName}`.trim();
      
      nameElements.forEach(el => {
        if (el.id.includes('patient-name') || el.id.includes('podiatrist-name')) {
          el.textContent = fullName;
        }
      });
      
      // Update user ID displays
      const idElements = document.querySelectorAll('[id*="patient-id"]');
      idElements.forEach(el => {
        el.textContent = sessionInfo.userId;
      });
      
      // Update current date
      const dateElements = document.querySelectorAll('[id*="current-date"]');
      const today = new Date().toLocaleDateString('en-SG', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
      
      dateElements.forEach(el => {
        el.textContent = today;
      });
      
      console.log('✅ User interface updated');
      
    } catch (error) {
      console.warn('⚠️ UI update error:', error);
    }
  }

  // ========================================
  // LOGOUT HANDLING
  // ========================================
  
  setupLogoutHandlers() {
    // Enhanced logout function
    window.handleLogout = () => {
      this.showLogoutConfirmation();
    };
    
    // Quick logout for emergencies
    window.quickLogout = () => {
      this.performLogout('Quick logout requested');
    };
    
    // Logout on window close (cleanup)
    window.addEventListener('beforeunload', () => {
      sessionStorage.setItem('lastActivity', Date.now().toString());
    });
  }

  showLogoutConfirmation() {
    // Check if modal exists, create if not
    let modal = document.getElementById('logoutModal');
    
    if (!modal) {
      modal = this.createLogoutModal();
    }
    
    modal.classList.remove('hidden');
    modal.style.display = 'flex';
    
    // Set up modal handlers
    const confirmBtn = document.getElementById('confirmLogoutBtn');
    const cancelBtn = document.getElementById('cancelLogoutBtn');
    
    if (confirmBtn) {
      confirmBtn.onclick = () => {
        this.performLogout('User confirmed logout');
      };
    }
    
    if (cancelBtn) {
      cancelBtn.onclick = () => {
        modal.classList.add('hidden');
        modal.style.display = 'none';
      };
    }
  }

  createLogoutModal() {
    const modal = document.createElement('div');
    modal.id = 'logoutModal';
    modal.className = 'hidden';
    modal.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.6);
      display: none;
      justify-content: center;
      align-items: center;
      z-index: 10000;
    `;
    
    modal.innerHTML = `
      <div style="
        background: white;
        padding: 2rem;
        border-radius: 12px;
        max-width: 400px;
        text-align: center;
        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
      ">
        <div style="font-size: 3rem; margin-bottom: 1rem;">🚪</div>
        <h3 style="color: #374151; margin-bottom: 1rem;">Confirm Logout</h3>
        <p style="margin-bottom: 1.5rem; color: #6b7280;">
          Are you sure you want to logout? Your session will be securely terminated.
        </p>
        <div style="display: flex; gap: 1rem; justify-content: center;">
          <button id="cancelLogoutBtn" style="
            background: #6b7280;
            color: white;
            border: none;
            padding: 0.75rem 1.5rem;
            border-radius: 6px;
            cursor: pointer;
            font-weight: 600;
          ">
            Cancel
          </button>
          <button id="confirmLogoutBtn" style="
            background: #ef4444;
            color: white;
            border: none;
            padding: 0.75rem 1.5rem;
            border-radius: 6px;
            cursor: pointer;
            font-weight: 600;
          ">
            Logout
          </button>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
    return modal;
  }

  async performLogout(reason = 'User logout') {
    console.log('🚪 Performing logout:', reason);
    
    try {
      // Show loading state
      this.showLogoutProgress('Logging out securely...');
      
      // Use session manager logout
      if (this.sessionManager) {
        await this.sessionManager.forceLogout();
      } else {
        // Fallback logout
        sessionStorage.clear();
        window.location.href = 'login.html';
      }
      
    } catch (error) {
      console.error('❌ Logout error:', error);
      // Force logout even if there's an error
      sessionStorage.clear();
      window.location.href = 'login.html';
    }
  }

  showLogoutProgress(message) {
    const modal = document.getElementById('logoutModal');
    if (modal) {
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
          <h3 style="color: #374151; margin-bottom: 0.5rem;">${message}</h3>
          <p style="color: #6b7280; margin: 0;">Please wait...</p>
        </div>
      `;
    }
  }

  // ========================================
  // ERROR HANDLING
  // ========================================
  
  handleInitError(error) {
    console.error('❌ Session initialization error:', error);
    
    this.showErrorMessage('Session initialization failed. Redirecting to login...');
    
    setTimeout(() => {
      window.location.href = 'login.html';
    }, 3000);
  }

  handleSessionTerminated(reason) {
    console.log('🚨 Session terminated:', reason);
    
    this.showSessionTerminatedMessage(reason);
    
    // Clear any remaining session data
    sessionStorage.clear();
    
    setTimeout(() => {
      window.location.href = 'login.html';
    }, 3000);
  }

  // ========================================
  // USER NOTIFICATIONS
  // ========================================
  
  showExpiryWarning(minutesLeft) {
    this.showNotification(`⏰ Session expires in ${minutesLeft} minutes. Click to extend.`, 'warning', () => {
      if (this.sessionManager) {
        this.sessionManager.extendSession();
      }
    });
  }

  showErrorMessage(message) {
    this.showNotification(`❌ ${message}`, 'error');
  }

  showSessionTerminatedMessage(reason) {
    this.showNotification(`🚨 Session ended: ${reason}`, 'error');
  }

  showNotification(message, type = 'info', clickHandler = null) {
    const notification = document.createElement('div');
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: ${this.getNotificationColor(type)};
      color: white;
      padding: 12px 20px;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      z-index: 10000;
      cursor: ${clickHandler ? 'pointer' : 'default'};
      animation: slideInRight 0.3s ease-out;
      max-width: 350px;
      word-wrap: break-word;
    `;
    notification.textContent = message;
    
    if (clickHandler) {
      notification.onclick = clickHandler;
    }
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
      if (notification.parentNode) {
        notification.remove();
      }
    }, 5000);
  }

  getNotificationColor(type) {
    const colors = {
      success: '#10b981',
      warning: '#f59e0b',
      error: '#ef4444',
      info: '#3b82f6'
    };
    return colors[type] || colors.info;
  }

  // ========================================
  // PUBLIC METHODS
  // ========================================
  
  getSessionStatus() {
    return {
      isInitialized: !!this.sessionManager,
      sessionInfo: getSessionInfo(),
      requiredRole: this.userRole
    };
  }
}

// ========================================
// AUTO-INITIALIZATION
// ========================================

let pageSession = null;

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    pageSession = new PageSessionInit();
  });
} else {
  pageSession = new PageSessionInit();
}

// Make session status globally available
window.getPageSessionStatus = () => {
  return pageSession ? pageSession.getSessionStatus() : null;
};

// Export for module use
export { PageSessionInit };

// Add required CSS animations
const style = document.createElement('style');
style.textContent = `
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
  
  @keyframes slideInRight {
    from { transform: translateX(100%); opacity: 0; }
    to { transform: translateX(0); opacity: 1; }
  }
  
  .hidden {
    display: none !important;
  }
`;
document.head.appendChild(style);

console.log('✅ Session initialization module loaded');