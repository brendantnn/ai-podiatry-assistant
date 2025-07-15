// ========================================
// DEMO-SAFE SINGPASS SIMULATION 
// File: js/singpass.js (demo-safe version)
// ========================================

import { auth, db } from "./config/firebase-config.js";
import {
    signOut
} from "https://www.gstatic.com/firebasejs/10.11.0/firebase-auth.js";

// Global variables
let qrTimer = null;
let qrTimeLeft = 120; // 2 minutes
let authenticatedUser = null;
let sessionId = null;

// Demo users with complete data (no Firebase dependency for demo)
const demoUsers = {
    patient: {
        nric: "S1234567A",
        email: "patient1@gmail.com",
        role: "patient",
        userId: "patient_1",
        firstName: "John",
        lastName: "Lim",
        gender: "male",
        phone: "66665555",
        dob: "21 June 2000",
        isActive: true,
        //language: "en"
    },
    podiatrist: {
        nric: "S1112222B",
        email: "podiatrist1@gmail.com",
        role: "podiatrist",
        userId: "pod_1",
        firstName: "Dr. Jason",
        lastName: "Tan",
        gender: "male",
        phone: "89898666",
        dob: "11 February 1998",
        isActive: true,
        //language: "en"
    }
};

// Selected user type for current session
let selectedUserType = null;

/**
 * Initialize the SingPass login flow
 */
document.addEventListener('DOMContentLoaded', function () {
    console.log('🔐 Demo-Safe SingPass integration initialized');

    // Clear any existing auth state
    clearExistingAuthState();

    // Check if user type was passed via URL parameter
    const urlParams = new URLSearchParams(window.location.search);
    const userType = urlParams.get('type');

    if (userType && (userType === 'patient' || userType === 'podiatrist')) {
        selectedUserType = userType;
        console.log(`🎯 Demo mode: ${userType} login selected`);
    }

    // Start with user selection or direct QR if type specified
    if (selectedUserType) {
        initializeQRCodeForUserType(selectedUserType);
    } else {
        showUserTypeSelection();
    }
});

/**
 * Clear any existing authentication state
 */
async function clearExistingAuthState() {
    try {
        if (auth.currentUser) {
            await signOut(auth);
            console.log('🧹 Cleared existing auth state');
        }
        sessionStorage.removeItem('singpassAuth');
    } catch (error) {
        console.warn('Error clearing auth state:', error);
    }
}

/**
 * Navigate back to main login page
 */
function goBackToLogin() {
    window.location.href = 'login.html';
}

/**
 * Show user type selection for demo
 */
function showUserTypeSelection() {
    const qrStep = document.getElementById('qrStep');
    qrStep.innerHTML = `
    <div class="step-content">
      <h1>Demo SingPass Login</h1>
      <p class="subtitle">Choose which type of user you want to simulate</p>
      
      <div class="service-info">
        <div class="service-icon">🏥</div>
        <div class="service-details">
          <h3>Singapore General Hospital</h3>
          <p>Podiatry Department Portal</p>
          <small style="color: #666; font-size: 0.8rem;">Demo Mode - Select User Type</small>
        </div>
      </div>

      <div class="user-type-selection" style="margin: 2rem 0;">
        <h3 style="text-align: center; margin-bottom: 1.5rem; color: #333;">Select Demo User Type</h3>
        
        <div class="user-type-buttons" style="display: flex; flex-direction: column; gap: 1rem;">
          <button class="user-type-btn" onclick="selectUserType('patient')" style="display: flex; align-items: center; padding: 1.5rem; border: 2px solid #059669; border-radius: 8px; background: #f0fdf4; cursor: pointer; transition: all 0.2s;">
            <div class="icon" style="font-size: 3rem; margin-right: 1.5rem;">🩹</div>
            <div style="text-align: left;">
              <div class="type-title" style="font-weight: 600; color: #059669; font-size: 1.2rem;">Patient Login</div>
              <div class="type-desc" style="color: #6b7280; margin: 0.5rem 0;">NRIC: S1234567A</div>
              <div class="type-desc" style="color: #6b7280; font-size: 0.875rem;">John Lim - Patient Dashboard</div>
            </div>
          </button>
          
          <button class="user-type-btn" onclick="selectUserType('podiatrist')" style="display: flex; align-items: center; padding: 1.5rem; border: 2px solid #3b82f6; border-radius: 8px; background: #f0f9ff; cursor: pointer; transition: all 0.2s;">
            <div class="icon" style="font-size: 3rem; margin-right: 1.5rem;">👨‍⚕️</div>
            <div style="text-align: left;">
              <div class="type-title" style="font-weight: 600; color: #3b82f6; font-size: 1.2rem;">Podiatrist Login</div>
              <div class="type-desc" style="color: #6b7280; margin: 0.5rem 0;">NRIC: S1112222B</div>
              <div class="type-desc" style="color: #6b7280; font-size: 0.875rem;">Dr. Sarah Chen - Podiatrist Dashboard</div>
            </div>
          </button>
        </div>
      </div>

      <div style="text-align: center; margin-top: 2rem; padding: 1rem; background: #f9fafb; border-radius: 8px;">
        <p style="margin: 0; color: #6b7280; font-size: 0.875rem;">
          <strong>Demo Mode:</strong> This is a simulation using pre-configured user data. 
          In production, this would authenticate against actual SingPass and Firebase.
        </p>
      </div>
      
      <div style="text-align: center; margin-top: 1rem;">
        <button onclick="goBackToLogin()" style="background: #6b7280; color: white; border: none; padding: 0.75rem 1.5rem; border-radius: 6px; cursor: pointer;">
          ← Back to Login
        </button>
      </div>
    </div>
  `;
}

/**
 * Select user type for demo
 */
function selectUserType(userType) {
    selectedUserType = userType;
    const user = demoUsers[userType];

    console.log(`🎯 Selected ${userType} demo user:`, user);

    // Update URL to reflect selection
    const url = new URL(window.location);
    url.searchParams.set('type', userType);
    window.history.replaceState({}, '', url);

    // Initialize QR code for selected user type
    initializeQRCodeForUserType(userType);
}

/**
 * Initialize QR code for specific user type
 */
function initializeQRCodeForUserType(userType) {
    const user = demoUsers[userType];

    // Update the QR step content for the selected user
    const qrStep = document.getElementById('qrStep');
    qrStep.innerHTML = `
    <div class="step-content">
      <h1>Login with SingPass</h1>
      <p class="subtitle">Demo authentication as <strong>${user.firstName} ${user.lastName}</strong> (${user.role})</p>
      
      <div class="service-info" style="border: 2px solid ${userType === 'patient' ? '#059669' : '#3b82f6'};">
        <div class="service-icon">${userType === 'patient' ? '🩹' : '👨‍⚕️'}</div>
        <div class="service-details">
          <h3>SGH Podiatry - ${userType === 'patient' ? 'Patient' : 'Podiatrist'} Login</h3>
          <p>Demo User: ${user.nric} - ${user.firstName} ${user.lastName}</p>
          <small style="color: #666; font-size: 0.8rem;">Will redirect to ${userType}.html after authentication</small>
        </div>
      </div>

      <div class="qr-container">
        <div class="qr-code" id="qrCode">
          <!-- QR Code will be generated here -->
        </div>
        <div class="qr-timer">
          <div class="timer-text">Code expires in: <span id="countdown">02:00</span></div>
          <div class="timer-bar">
            <div class="timer-progress" id="timerProgress"></div>
          </div>
        </div>
      </div>

      <div class="scan-instructions">
        <h3>Demo Authentication Flow:</h3>
        <ol>
          <li>This QR code represents <strong>${user.nric}</strong> (${user.firstName} ${user.lastName})</li>
          <li>Click <strong>"Open Mobile Scanner"</strong> below to simulate scanning</li>
          <li>Click <strong>"Authenticate with SingPass"</strong> in the scanner</li>
          <li>System will authenticate as <strong>${user.role}</strong> using demo data</li>
          <li>You'll be redirected to <strong>${userType}.html</strong></li>
        </ol>
      </div>

      <div class="qr-status" id="qrStatus">
        <div class="status-icon">📱</div>
        <p>Waiting for you to scan the QR code...</p>
      </div>

      <button class="refresh-btn" onclick="refreshQR()" id="refreshBtn" style="display: none;">
        🔄 Generate New Code
      </button>

      <!-- Demo Helper -->
      <div style="margin-top: 2rem; padding: 1rem; background: ${userType === 'patient' ? '#f0fdf4' : '#f0f9ff'}; border: 1px solid ${userType === 'patient' ? '#059669' : '#3b82f6'}; border-radius: 8px; text-align: center;">
        <p style="margin: 0; color: ${userType === 'patient' ? '#065f46' : '#1e40af'}; font-size: 0.875rem;">
          <strong>Demo Mode:</strong> Will authenticate as ${user.firstName} ${user.lastName} (${user.role})
        </p>
        <button onclick="startDemoAuthentication()" style="margin-top: 0.5rem; padding: 0.5rem 1rem; background: ${userType === 'patient' ? '#059669' : '#3b82f6'}; color: white; border: none; border-radius: 4px; cursor: pointer;">
          📱 Open Mobile Scanner
        </button>
      </div>
      
      <div style="text-align: center; margin-top: 1rem;">
        <button onclick="showUserTypeSelection()" style="background: #6b7280; color: white; border: none; padding: 0.5rem 1rem; border-radius: 4px; cursor: pointer; margin-right: 0.5rem;">
          ← Change User Type
        </button>
        <button onclick="goBackToLogin()" style="background: #6b7280; color: white; border: none; padding: 0.5rem 1rem; border-radius: 4px; cursor: pointer;">
          ← Back to Login
        </button>
      </div>
    </div>
  `;

    // Generate QR code and start timer
    generateQRCodeForUser(userType);
    startQRTimer();
    updateQRStatus('waiting', `Waiting for you to scan the ${userType} QR code...`);

    // Auto-trigger mobile scanner after 3 seconds (for demo purposes)
    setTimeout(() => {
        showMobileScanner();
    }, 3000);
}

/**
 * Generate QR code for specific user type
 */
function generateQRCodeForUser(userType) {
    const qrContainer = document.getElementById('qrCode');
    if (!qrContainer) return;
    
    sessionId = generateSessionId();
    const user = demoUsers[userType];

    // Create QR code content with user-specific details
    const qrData = {
        service: "SGH_Podiatry_SingPass",
        sessionId: sessionId,
        userType: userType,
        demoNRIC: user.nric,
        timestamp: Date.now(),
        endpoint: "https://singpass.gov.sg/auth/sgh",
        redirectUrl: window.location.origin
    };

    // Generate QR code using a simple pattern
    const qrCodeSVG = generateQRCodeSVG(JSON.stringify(qrData));
    qrContainer.innerHTML = qrCodeSVG;

    console.log(`📱 QR Code generated for ${userType} (${user.nric}):`, qrData);
}

/**
 * Generate a simple QR code SVG (placeholder implementation)
 */
function generateQRCodeSVG(data) {
    const size = 200;
    const cellSize = 8;
    const cells = Math.floor(size / cellSize);

    let svg = `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">`;
    svg += `<rect width="${size}" height="${size}" fill="white"/>`;

    // Generate random pattern based on data hash
    const hash = simpleHash(data);
    for (let i = 0; i < cells; i++) {
        for (let j = 0; j < cells; j++) {
            if ((hash + i * j) % 3 === 0) {
                const x = i * cellSize;
                const y = j * cellSize;
                svg += `<rect x="${x}" y="${y}" width="${cellSize}" height="${cellSize}" fill="black"/>`;
            }
        }
    }

    // Add corner markers
    svg += `<rect x="0" y="0" width="${cellSize * 7}" height="${cellSize * 7}" fill="none" stroke="black" stroke-width="2"/>`;
    svg += `<rect x="${size - cellSize * 7}" y="0" width="${cellSize * 7}" height="${cellSize * 7}" fill="none" stroke="black" stroke-width="2"/>`;
    svg += `<rect x="0" y="${size - cellSize * 7}" width="${cellSize * 7}" height="${cellSize * 7}" fill="none" stroke="black" stroke-width="2"/>`;

    svg += '</svg>';
    return svg;
}

/**
 * Simple hash function for QR code generation
 */
function simpleHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
    }
    return Math.abs(hash);
}

/**
 * Generate unique session ID
 */
function generateSessionId() {
    return 'SP_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now();
}

/**
 * Start QR code countdown timer
 */
function startQRTimer() {
    qrTimeLeft = 120;
    updateTimerDisplay();

    qrTimer = setInterval(() => {
        qrTimeLeft--;
        updateTimerDisplay();
        updateTimerProgress();

        if (qrTimeLeft <= 0) {
            clearInterval(qrTimer);
            expireQRCode();
        }
    }, 1000);
}

/**
 * Update timer display
 */
function updateTimerDisplay() {
    const minutes = Math.floor(qrTimeLeft / 60);
    const seconds = qrTimeLeft % 60;
    const timeString = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

    const countdownElement = document.getElementById('countdown');
    if (countdownElement) {
        countdownElement.textContent = timeString;
    }
}

/**
 * Update timer progress bar
 */
function updateTimerProgress() {
    const progress = (qrTimeLeft / 120) * 100;
    const progressBar = document.getElementById('timerProgress');
    if (progressBar) {
        progressBar.style.width = `${progress}%`;
    }
}

/**
 * Handle QR code expiration
 */
function expireQRCode() {
    updateQRStatus('error', 'QR code has expired. Please generate a new code.');
    const refreshBtn = document.getElementById('refreshBtn');
    if (refreshBtn) {
        refreshBtn.style.display = 'block';
    }
    console.log('⏰ QR Code expired');
}

/**
 * Update QR status display
 */
function updateQRStatus(type, message) {
    const qrStatus = document.getElementById('qrStatus');
    if (!qrStatus) return;
    
    qrStatus.className = `qr-status ${type}`;

    let icon = '📱';
    if (type === 'success') icon = '✅';
    if (type === 'error') icon = '❌';
    if (type === 'processing') icon = '⏳';

    qrStatus.innerHTML = `
    <div class="status-icon">${icon}</div>
    <p>${message}</p>
  `;
}

/**
 * Refresh QR code
 */
function refreshQR() {
    const refreshBtn = document.getElementById('refreshBtn');
    if (refreshBtn) {
        refreshBtn.style.display = 'none';
    }

    if (selectedUserType) {
        generateQRCodeForUser(selectedUserType);
    } else {
        showUserTypeSelection();
        return;
    }

    startQRTimer();
    updateQRStatus('waiting', `Waiting for you to scan the ${selectedUserType} QR code...`);
}

/**
 * Show mobile scanner simulation
 */
function showMobileScanner() {
    const mobileScanner = document.getElementById('mobileScanner');
    if (mobileScanner) {
        mobileScanner.style.display = 'flex';
        console.log('📱 Mobile scanner opened');
    }
}

/**
 * Close mobile scanner
 */
function closeMobileScanner() {
    const mobileScanner = document.getElementById('mobileScanner');
    if (mobileScanner) {
        mobileScanner.style.display = 'none';
        console.log('📱 Mobile scanner closed');
    }
}

/**
 * Start demo authentication (simplified process)
 */
function startDemoAuthentication() {
    showMobileScanner();
}

/**
 * Simulate successful QR scan (DEMO VERSION - NO FIREBASE)
 */
function simulateSuccessfulScan() {
    closeMobileScanner();

    updateQRStatus('success', 'QR code scanned successfully! Authenticating...');

    // Stop QR timer
    if (qrTimer) {
        clearInterval(qrTimer);
    }

    console.log('✅ QR Code scan simulated, starting demo authentication');

    // Show a simple processing message
    setTimeout(() => {
        showSimpleProcessing();
    }, 1000);
}

/**
 * Show simple processing without complex DOM manipulation
 */
function showSimpleProcessing() {
    const qrStep = document.getElementById('qrStep');
    if (!qrStep) return;

    qrStep.innerHTML = `
    <div class="step-content">
      <div style="text-align: center;">
        <div style="width: 60px; height: 60px; border: 4px solid #e2e8f0; border-top: 4px solid #ee3124; border-radius: 50%; animation: spin 1s linear infinite; margin: 0 auto 2rem;"></div>
        <h1>Authenticating with SingPass</h1>
        <p class="subtitle">Please wait while we verify your identity using demo data...</p>
        
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 1.5rem; margin: 2rem 0; text-align: left;">
          <h3 style="color: #1e293b; margin-bottom: 1rem;">Demo Authentication Steps:</h3>
          <div style="display: flex; flex-direction: column; gap: 0.5rem;">
            <div style="color: #22c55e;">✓ QR Code scanned successfully</div>
            <div style="color: #22c55e;">✓ SingPass identity verified</div>
            <div style="color: #22c55e;">✓ User profile loaded from demo data</div>
            <div style="color: #22c55e;">✓ Access permissions confirmed</div>
            <div style="color: #f59e0b;">⏳ Setting up secure session...</div>
          </div>
        </div>

        <div style="background: #f0f9ff; border: 1px solid #bae6fd; border-radius: 8px; padding: 1rem; margin: 1.5rem 0;">
          <p style="margin: 0; color: #0c4a6e; font-size: 0.875rem;">
            <strong>Demo Mode:</strong> Using pre-configured user data. In production, this would authenticate against real SingPass servers and Firebase.
          </p>
        </div>
      </div>
    </div>
  `;

    // Add spin animation
    const style = document.createElement('style');
    style.textContent = `
      @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
    `;
    document.head.appendChild(style);

    // Complete authentication after 3 seconds
    setTimeout(() => {
        completeAuthentication();
    }, 3000);
}

// ========================================
// SINGPASS INTEGRATION WITH REGULAR SESSION MANAGER
// Update your singpass.js createDemoSession function with this
// ========================================

/**
 * Create demo session compatible with regular sessionManager
 */
function createDemoSession() {
    console.log('🔐 Creating standard session for SingPass user...');

    // Create session data in the EXACT format that sessionManager expects
    const sessionData = {
        // Core fields that sessionManager requires
        uid: `singpass_${authenticatedUser.userId}`,
        email: authenticatedUser.email,
        role: authenticatedUser.role,
        userId: authenticatedUser.userId,
        firstName: authenticatedUser.firstName,
        lastName: authenticatedUser.lastName,
        
        // Session timing (required by sessionManager)
        lastActivity: Date.now(),
        sessionStart: Date.now(),
        isActive: true,
        
        // Additional SingPass info (optional but useful)
        loginMethod: 'singpass',
        singpassSessionId: sessionId,
        nricVerified: true,
        loginTime: new Date().toISOString()
    };

    // Store in sessionStorage with proper string conversion
    Object.keys(sessionData).forEach(key => {
        const value = sessionData[key];
        
        if (typeof value === 'boolean') {
            sessionStorage.setItem(key, value.toString());
        } else if (typeof value === 'number') {
            sessionStorage.setItem(key, value.toString());
        } else {
            sessionStorage.setItem(key, value || '');
        }
    });

    console.log('✅ Standard session created for SingPass user');
    console.log('Session data stored:', {
        uid: sessionStorage.getItem('uid'),
        email: sessionStorage.getItem('email'),
        role: sessionStorage.getItem('role'),
        lastActivity: sessionStorage.getItem('lastActivity'),
        isActive: sessionStorage.getItem('isActive')
    });
}

// ========================================
// INTEGRATION WITH FIREBASE AUTH (OPTIONAL)
// If you want to create a Firebase user for SingPass demo
// ========================================

/**
 * Optional: Create Firebase user for SingPass session
 * This makes the session fully compatible with regular sessionManager
 */
async function createFirebaseCompatibleSession() {
    console.log('🔐 Creating Firebase-compatible SingPass session...');
    
    try {
        // Import Firebase functions
        const { signInAnonymously } = await import("https://www.gstatic.com/firebasejs/10.11.0/firebase-auth.js");
        const { auth } = await import("./config/firebase-config.js");
        
        // Create anonymous Firebase user for SingPass session
        const userCredential = await signInAnonymously(auth);
        const firebaseUid = userCredential.user.uid;
        
        console.log('✅ Firebase anonymous user created:', firebaseUid);
        
        // Create session data using Firebase UID
        const sessionData = {
            uid: firebaseUid, // Use Firebase UID instead of custom UID
            email: authenticatedUser.email,
            role: authenticatedUser.role,
            userId: authenticatedUser.userId,
            firstName: authenticatedUser.firstName,
            lastName: authenticatedUser.lastName,
            lastActivity: Date.now(),
            sessionStart: Date.now(),
            isActive: true,
            loginMethod: 'singpass',
            singpassSessionId: sessionId,
            nricVerified: true,
            loginTime: new Date().toISOString()
        };

        // Store session data
        Object.keys(sessionData).forEach(key => {
            const value = sessionData[key];
            if (typeof value === 'boolean') {
                sessionStorage.setItem(key, value.toString());
            } else if (typeof value === 'number') {
                sessionStorage.setItem(key, value.toString());
            } else {
                sessionStorage.setItem(key, value || '');
            }
        });

        console.log('✅ Firebase-compatible SingPass session created');
        return true;
        
    } catch (error) {
        console.warn('⚠️ Could not create Firebase user, using standard session:', error);
        // Fall back to standard session creation
        createDemoSession();
        return false;
    }
}

/**
 * Complete authentication and show success (UPDATED VERSION)
 */
function completeAuthentication() {
    if (!selectedUserType) {
        console.error('❌ No user type selected');
        goBackToLogin();
        return;
    }

    // Use demo user data
    authenticatedUser = demoUsers[selectedUserType];
    
    const qrStep = document.getElementById('qrStep');
    if (!qrStep) return;

    qrStep.innerHTML = `
    <div class="step-content">
      <div style="text-align: center;">
        <div style="font-size: 4rem; margin-bottom: 1rem; animation: bounceIn 0.6s ease-out;">✅</div>
        <h1 style="color: #22c55e;">Login Successful!</h1>
        <p class="subtitle">Welcome to SGH Podiatry Portal</p>
        
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 1.5rem; margin: 2rem 0; text-align: left;">
          <h3 style="color: #1e293b; font-size: 1.25rem; font-weight: 600; margin-bottom: 1rem; text-align: center;">SingPass Authentication Successful</h3>
          
          <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.75rem 0; border-bottom: 1px solid #e2e8f0;">
            <span style="color: #64748b; font-weight: 500;">Name:</span>
            <span style="color: #1e293b; font-weight: 600;">${authenticatedUser.firstName} ${authenticatedUser.lastName}</span>
          </div>
          <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.75rem 0; border-bottom: 1px solid #e2e8f0;">
            <span style="color: #64748b; font-weight: 500;">NRIC:</span>
            <span style="color: #1e293b; font-weight: 600;">${authenticatedUser.nric}</span>
          </div>
          <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.75rem 0; border-bottom: 1px solid #e2e8f0;">
            <span style="color: #64748b; font-weight: 500;">Email:</span>
            <span style="color: #1e293b; font-weight: 600;">${authenticatedUser.email}</span>
          </div>
          <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.75rem 0; border-bottom: 1px solid #e2e8f0;">
            <span style="color: #64748b; font-weight: 500;">User ID:</span>
            <span style="color: #1e293b; font-weight: 600;">${authenticatedUser.userId}</span>
          </div>
          <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.75rem 0; border-bottom: 1px solid #e2e8f0;">
            <span style="color: #64748b; font-weight: 500;">Access Level:</span>
            <span style="text-transform: capitalize; font-weight: 600; color: ${authenticatedUser.role === 'patient' ? '#059669' : '#3b82f6'};">${authenticatedUser.role}</span>
          </div>
          <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.75rem 0;">
            <span style="color: #64748b; font-weight: 500;">Login Method:</span>
            <span style="color: #1e293b; font-weight: 600;">SingPass Digital Identity</span>
          </div>
        </div>

        <div style="background: #f0f9ff; border: 1px solid #bae6fd; border-radius: 8px; padding: 1rem; margin: 1.5rem 0;">
          <p style="margin: 0; color: #0c4a6e; font-weight: 500;">
            You will be redirected to your dashboard in <span id="redirectCountdown" style="font-weight: 700; color: #ee3124;">3</span> seconds...
          </p>
          <p style="font-size: 0.875rem; color: #64748b; margin-top: 0.5rem; margin-bottom: 0;">
            Or click the button below to continue immediately
          </p>
        </div>

        <button onclick="redirectToDashboard()" style="background: #ee3124; color: white; border: none; padding: 1rem 2rem; border-radius: 8px; cursor: pointer; font-weight: 600; font-size: 1rem; transition: all 0.2s ease; display: inline-flex; align-items: center; gap: 0.5rem; margin: 1rem auto;">
          Continue to Dashboard
        </button>

        <div style="margin-top: 1.5rem; padding: 1rem; background: #f0fdf4; border: 1px solid #16a34a; border-radius: 8px;">
          <p style="margin: 0; color: #15803d; font-size: 0.875rem; text-align: center;">
            <strong>✓ Secure Session Established</strong><br>
            Your identity has been verified through SingPass and your session is compatible with the regular session manager.
          </p>
        </div>
      </div>
    </div>
  `;

    // Create standard session (compatible with regular sessionManager)
    console.log('🔄 Creating standard session compatible with sessionManager...');
    
    // Try Firebase-compatible session first, fall back to standard
    createFirebaseCompatibleSession().then((success) => {
        if (success) {
            console.log('✅ Firebase-compatible session created');
        } else {
            console.log('✅ Standard demo session created');
        }
        
        // Start redirect countdown
        startRedirectCountdown();
    }).catch((error) => {
        console.warn('⚠️ Error creating Firebase session, using standard:', error);
        createDemoSession();
        startRedirectCountdown();
    });

    console.log('🎉 SingPass authentication completed with standard session');
}

function startRedirectCountdown() {
    const countdownElement = document.getElementById('redirectCountdown');
    if (!countdownElement) {
        redirectToDashboard(); // Fallback
        return;
    }

    let secondsLeft = parseInt(countdownElement.textContent) || 3;

    const interval = setInterval(() => {
        secondsLeft--;
        countdownElement.textContent = secondsLeft.toString();

        if (secondsLeft <= 0) {
            clearInterval(interval);
            redirectToDashboard();
        }
    }, 1000);
}

// ========================================
// SESSION VALIDATION BEFORE REDIRECT
// ========================================

/**
 * Validate session works with regular sessionManager before redirect
 */
function validateSessionBeforeRedirect() {
    console.log('🔍 Validating session compatibility with sessionManager...');
    
    // Check all required fields that sessionManager needs
    const requiredFields = ['uid', 'email', 'role', 'lastActivity', 'sessionStart', 'isActive'];
    const missingFields = [];
    
    for (const field of requiredFields) {
        const value = sessionStorage.getItem(field);
        if (!value || value === 'undefined' || value === 'null') {
            missingFields.push(field);
        }
    }
    
    if (missingFields.length > 0) {
        console.error('❌ Session missing required fields:', missingFields);
        return false;
    }
    
    // Validate data types
    const lastActivity = parseInt(sessionStorage.getItem('lastActivity'));
    const sessionStart = parseInt(sessionStorage.getItem('sessionStart'));
    
    if (isNaN(lastActivity) || isNaN(sessionStart)) {
        console.error('❌ Invalid timestamp values in session');
        return false;
    }
    
    // Check if session is too old (should be recent)
    const now = Date.now();
    if (now - sessionStart > 60000) { // More than 1 minute old
        console.warn('⚠️ Session seems old, updating timestamps');
        sessionStorage.setItem('lastActivity', now.toString());
        sessionStorage.setItem('sessionStart', now.toString());
    }
    
    console.log('✅ Session validation passed - compatible with sessionManager');
    return true;
}

/**
 * Updated redirect function with validation
 */
function redirectToDashboard() {
    if (!authenticatedUser) {
        console.error('❌ No authenticated user found for redirect');
        goBackToLogin();
        return;
    }

    // Validate session before redirect
    if (!validateSessionBeforeRedirect()) {
        console.error('❌ Session validation failed');
        
        // Try to fix the session
        console.log('🔧 Attempting to fix session...');
        createDemoSession();
        
        // Re-validate
        if (!validateSessionBeforeRedirect()) {
            console.error('❌ Could not fix session, redirecting to login');
            goBackToLogin();
            return;
        }
    }

    const redirectUrl = authenticatedUser.role === 'patient' ? 'patient.html' : 'podiatrist.html';
    console.log(`🚀 Session validated, redirecting ${authenticatedUser.role} to ${redirectUrl}`);
    
    window.location.href = redirectUrl;
}

// ========================================
// DEBUGGING FUNCTIONS
// ========================================

/**
 * Test compatibility with regular sessionManager
 */
window.testSessionManagerCompatibility = function() {
    console.log('🧪 Testing sessionManager compatibility...');
    
    const session = {
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
    
    console.log('Session data for sessionManager:', session);
    
    // Simulate sessionManager validation
    const isValid = session.uid && session.email && session.role && 
                   session.isActive && session.lastActivity > 0 && session.sessionStart > 0;
    
    if (isValid) {
        console.log('✅ Session is compatible with sessionManager');
    } else {
        console.log('❌ Session will NOT work with sessionManager');
    }
    
    return isValid;
};

window.triggerScanSimulation = startDemoAuthentication;
window.simulateSuccessfulScan = simulateSuccessfulScan;

console.log('🔗 SingPass sessionManager integration loaded');
console.log('Available debug function: testSessionManagerCompatibility()');