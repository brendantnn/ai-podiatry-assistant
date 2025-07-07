// ========================================
// SESSION MANAGEMENT SYSTEM
// File: js/utils/sessionManager.js
// ========================================

import { auth } from "../config/firebase-config.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-auth.js";

class SessionManager {
    constructor() {
        this.sessionTimeout = 30 * 60 * 1000; // 30 minutes
        this.warningTime = 5 * 60 * 1000; // 5 minutes before timeout
        this.checkInterval = 60 * 1000; // Check every minute

        this.inactivityTimer = null;
        this.warningTimer = null;
        this.checkTimer = null;
        this.warningShown = false;

        this.activityEvents = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];

        this.init();
    }

    // ========================================
    // INITIALIZATION
    // ========================================

    init() {
        console.log('🔧 Initializing Session Manager...');

        // Set up Firebase auth state listener
        this.setupAuthStateListener();

        // Set up activity monitoring
        this.setupActivityMonitoring();

        // Set up periodic session validation
        this.setupPeriodicValidation();

        // Set up page visibility handling
        this.setupVisibilityHandling();

        console.log('✅ Session Manager initialized');
    }

    // ========================================
    // FIREBASE AUTH STATE MANAGEMENT
    // ========================================

    setupAuthStateListener() {
        onAuthStateChanged(auth, (user) => {
            if (user) {
                console.log('🔐 User authenticated:', user.uid);
                this.updateSessionData(user);
                this.startSession();
            } else {
                console.log('🚪 User not authenticated');
                this.handleSessionExpired('Authentication lost');
            }
        });
    }

    // ========================================
    // SESSION DATA MANAGEMENT
    // ========================================

    updateSessionData(user) {
        const sessionData = {
            uid: user.uid,
            email: user.email,
            lastActivity: Date.now(),
            sessionStart: Date.now(),
            isActive: true
        };

        // Store in sessionStorage (cleared when browser/tab closes)
        Object.keys(sessionData).forEach(key => {
            sessionStorage.setItem(key, sessionData[key]);
        });

        console.log('💾 Session data updated');
    }

    getSessionData() {
        return {
            uid: sessionStorage.getItem('uid'),
            email: sessionStorage.getItem('email'),
            role: sessionStorage.getItem('role'),
            userId: sessionStorage.getItem('userId'),
            firstName: sessionStorage.getItem('firstName'),
            lastName: sessionStorage.getItem('lastName'),
            lastActivity: parseInt(sessionStorage.getItem('lastActivity')) || 0,
            sessionStart: parseInt(sessionStorage.getItem('sessionStart')) || 0,
            isActive: sessionStorage.getItem('isActive') === 'true'
        };
    }

    // ========================================
    // SESSION VALIDATION
    // ========================================

    validateSession() {
        const session = this.getSessionData();

        // Check if all required session data exists
        if (!session.uid || !session.email || !session.role) {
            console.warn('⚠️ Invalid session - missing required data');
            return false;
        }

        // Check if session is still active
        if (!session.isActive) {
            console.warn('⚠️ Session marked as inactive');
            return false;
        }

        // Check session age (max 8 hours)
        const maxSessionAge = 8 * 60 * 60 * 1000; // 8 hours
        const sessionAge = Date.now() - session.sessionStart;

        if (sessionAge > maxSessionAge) {
            console.warn('⚠️ Session expired - maximum age exceeded');
            this.handleSessionExpired('Session too old');
            return false;
        }

        // Check last activity
        const timeSinceActivity = Date.now() - session.lastActivity;

        if (timeSinceActivity > this.sessionTimeout) {
            console.warn('⚠️ Session expired - inactivity timeout');
            this.handleSessionExpired('Inactivity timeout');
            return false;
        }

        return true;
    }

    // ========================================
    // ACTIVITY MONITORING
    // ========================================

    setupActivityMonitoring() {
        this.activityEvents.forEach(event => {
            document.addEventListener(event, () => this.recordActivity(), true);
        });

        console.log('👂 Activity monitoring set up');
    }

    recordActivity() {
        const now = Date.now();
        sessionStorage.setItem('lastActivity', now.toString());

        // Reset inactivity timer
        this.resetInactivityTimer();

        // Hide warning if shown
        if (this.warningShown) {
            this.hideSessionWarning();
        }
    }

    resetInactivityTimer() {
        // Clear existing timers
        if (this.inactivityTimer) {
            clearTimeout(this.inactivityTimer);
        }
        if (this.warningTimer) {
            clearTimeout(this.warningTimer);
        }

        // Set warning timer (5 minutes before timeout)
        this.warningTimer = setTimeout(() => {
            this.showSessionWarning();
        }, this.sessionTimeout - this.warningTime);

        // Set logout timer
        this.inactivityTimer = setTimeout(() => {
            this.handleSessionExpired('Inactivity timeout');
        }, this.sessionTimeout);
    }

    // ========================================
    // SESSION WARNING SYSTEM
    // ========================================

    showSessionWarning() {
        if (this.warningShown) return;

        this.warningShown = true;
        const warningTime = Math.floor(this.warningTime / 1000 / 60); // Convert to minutes

        const warningModal = document.createElement('div');
        warningModal.id = 'sessionWarningModal';
        warningModal.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.7);
      display: flex;
      justify-content: center;
      align-items: center;
      z-index: 10001;
      animation: fadeIn 0.3s ease-out;
    `;

        warningModal.innerHTML = `
      <div style="
        background: white;
        padding: 2rem;
        border-radius: 12px;
        max-width: 500px;
        text-align: center;
        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
      ">
        <div style="font-size: 3rem; margin-bottom: 1rem;">⏰</div>
        <h3 style="color: #f59e0b; margin-bottom: 1rem;">Session Expiring Soon</h3>
        <p style="margin-bottom: 1.5rem; color: #6b7280; line-height: 1.5;">
          Your session will expire in <strong>${warningTime} minutes</strong> due to inactivity.<br>
          Click "Stay Logged In" to continue your session.
        </p>
        <div style="display: flex; gap: 1rem; justify-content: center;">
          <button id="extendSession" style="
            background: #10b981;
            color: white;
            border: none;
            padding: 0.75rem 1.5rem;
            border-radius: 6px;
            cursor: pointer;
            font-weight: 600;
          ">
            Stay Logged In
          </button>
          <button id="logoutNow" style="
            background: #ef4444;
            color: white;
            border: none;
            padding: 0.75rem 1.5rem;
            border-radius: 6px;
            cursor: pointer;
            font-weight: 600;
          ">
            Logout Now
          </button>
        </div>
        <div style="margin-top: 1rem;">
          <small style="color: #6b7280;">
            Time remaining: <span id="countdown">${warningTime}:00</span>
          </small>
        </div>
      </div>
    `;

        document.body.appendChild(warningModal);

        // Set up countdown
        this.startCountdown();

        // Set up button handlers
        document.getElementById('extendSession').onclick = () => {
            this.extendSession();
        };

        document.getElementById('logoutNow').onclick = () => {
            this.forceLogout();
        };

        console.log('⚠️ Session warning displayed');
    }

    startCountdown() {
        const countdownElement = document.getElementById('countdown');
        let timeLeft = this.warningTime / 1000; // Convert to seconds

        const countdownTimer = setInterval(() => {
            timeLeft--;

            if (timeLeft <= 0) {
                clearInterval(countdownTimer);
                return;
            }

            const minutes = Math.floor(timeLeft / 60);
            const seconds = timeLeft % 60;

            if (countdownElement) {
                countdownElement.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
            }
        }, 1000);
    }

    hideSessionWarning() {
        const modal = document.getElementById('sessionWarningModal');
        if (modal) {
            modal.remove();
        }
        this.warningShown = false;
    }

    extendSession() {
        console.log('🔄 Session extended by user');
        this.recordActivity();
        this.hideSessionWarning();
        this.showNotification('Session extended successfully', 'success');
    }

    // ========================================
    // SESSION TERMINATION
    // ========================================

    async handleSessionExpired(reason) {
        console.log('🚨 Session expired:', reason);

        // Clear all timers
        this.clearAllTimers();

        // Show expiration message
        this.showSessionExpiredMessage(reason);

        // Clear session data
        await this.clearSession();

        // Redirect after delay
        setTimeout(() => {
            window.location.href = 'login.html';
        }, 3000);
    }

    async forceLogout() {
        console.log('🚪 Force logout initiated');
        await this.clearSession();
        window.location.href = 'login.html';
    }

    async clearSession() {
        try {
            // Sign out from Firebase
            if (auth.currentUser) {
                await signOut(auth);
            }
        } catch (error) {
            console.error('Error signing out:', error);
        }

        // Clear all storage
        sessionStorage.clear();
        localStorage.clear();

        // Mark session as inactive
        sessionStorage.setItem('isActive', 'false');

        console.log('🗑️ Session data cleared');
    }

    // ========================================
    // PERIODIC VALIDATION
    // ========================================

    setupPeriodicValidation() {
        this.checkTimer = setInterval(() => {
            if (!this.validateSession()) {
                this.handleSessionExpired('Periodic validation failed');
            }
        }, this.checkInterval);

        console.log('⏰ Periodic session validation set up');
    }

    // ========================================
    // PAGE VISIBILITY HANDLING
    // ========================================

    setupVisibilityHandling() {
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                // Page is hidden (user switched tabs/minimized)
                console.log('👁️ Page hidden - pausing timers');
                this.pauseTimers();
            } else {
                // Page is visible again
                console.log('👁️ Page visible - resuming timers');
                this.resumeTimers();
                // Validate session when user returns
                if (!this.validateSession()) {
                    this.handleSessionExpired('Session expired while away');
                }
            }
        });
    }

    pauseTimers() {
        // Store remaining time
        this.pausedTime = Date.now();
    }

    resumeTimers() {
        if (this.pausedTime) {
            const awayTime = Date.now() - this.pausedTime;
            console.log(`🕐 User was away for ${Math.floor(awayTime / 1000)} seconds`);

            // If away for too long, trigger timeout
            if (awayTime > this.sessionTimeout) {
                this.handleSessionExpired('Away too long');
                return;
            }

            // Otherwise, adjust timers
            this.recordActivity();
        }
    }

    // ========================================
    // UTILITY FUNCTIONS
    // ========================================

    clearAllTimers() {
        if (this.inactivityTimer) clearTimeout(this.inactivityTimer);
        if (this.warningTimer) clearTimeout(this.warningTimer);
        if (this.checkTimer) clearInterval(this.checkTimer);
    }

    showSessionExpiredMessage(reason) {
        const messageDiv = document.createElement('div');
        messageDiv.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: #ef4444;
      color: white;
      padding: 2rem;
      border-radius: 12px;
      text-align: center;
      z-index: 10002;
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
      animation: fadeIn 0.3s ease-out;
    `;

        messageDiv.innerHTML = `
      <div style="font-size: 3rem; margin-bottom: 1rem;">🚨</div>
      <h3 style="margin-bottom: 1rem;">Session Expired</h3>
      <p style="margin-bottom: 1rem;">${reason}</p>
      <p style="font-size: 0.875rem;">Redirecting to login page...</p>
    `;

        document.body.appendChild(messageDiv);
    }

    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: ${type === 'success' ? '#10b981' : '#3b82f6'};
      color: white;
      padding: 12px 20px;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      z-index: 10000;
      animation: slideInRight 0.3s ease-out;
    `;
        notification.textContent = message;

        document.body.appendChild(notification);

        setTimeout(() => {
            notification.remove();
        }, 3000);
    }

    // ========================================
    // PUBLIC METHODS
    // ========================================

    startSession() {
        console.log('🚀 Starting new session');
        this.recordActivity();
        this.resetInactivityTimer();
    }

    getSessionInfo() {
        const session = this.getSessionData();
        const now = Date.now();

        return {
            ...session,
            sessionDuration: now - session.sessionStart,
            timeSinceActivity: now - session.lastActivity,
            timeUntilExpiry: this.sessionTimeout - (now - session.lastActivity),
            isValid: this.validateSession()
        };
    }

    async refreshSession() {
        console.log('🔄 Manually refreshing session');

        if (auth.currentUser) {
            this.updateSessionData(auth.currentUser);
            this.recordActivity();
            this.showNotification('Session refreshed', 'success');
            return true;
        } else {
            this.handleSessionExpired('No authenticated user');
            return false;
        }
    }

    // ========================================
    // CLEANUP
    // ========================================

    destroy() {
        console.log('🧹 Cleaning up Session Manager');
        this.clearAllTimers();

        // Remove event listeners
        this.activityEvents.forEach(event => {
            document.removeEventListener(event, this.recordActivity, true);
        });
    }
}

// ========================================
// GLOBAL INSTANCE AND EXPORTS
// ========================================

// Create global session manager instance
let sessionManager = null;

// Initialize session manager
export function initSessionManager() {
    if (!sessionManager) {
        sessionManager = new SessionManager();

        // Make it globally accessible
        window.sessionManager = sessionManager;

        console.log('✅ Session Manager initialized globally');
    }
    return sessionManager;
}

// Page protection function
export function protectPage(requiredRole = null) {
    const session = sessionManager?.getSessionData();

    if (!session || !sessionManager?.validateSession()) {
        console.warn('⚠️ Page access denied - invalid session');
        window.location.href = 'login.html';
        return false;
    }

    if (requiredRole && session.role !== requiredRole) {
        console.warn('⚠️ Page access denied - insufficient privileges');
        window.location.href = 'login.html';
        return false;
    }

    return true;
}

// Quick access functions
export function getSessionInfo() {
    return sessionManager?.getSessionInfo() || null;
}

export function refreshSession() {
    return sessionManager?.refreshSession() || false;
}

export function forceLogout() {
    return sessionManager?.forceLogout();
}

// CSS for animations
const style = document.createElement('style');
style.textContent = `
  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }
  
  @keyframes slideInRight {
    from { transform: translateX(100%); opacity: 0; }
    to { transform: translateX(0); opacity: 1; }
  }
`;
document.head.appendChild(style);

console.log('📦 Session Manager module loaded');