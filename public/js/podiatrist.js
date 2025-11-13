// ========================================
// PODIATRIST DASHBOARD FUNCTIONALITY
// Tab switching and UI interactions ONLY
// ========================================

//Declare needed variables
let patientQueue = []; // Patient Queue
let allPatients = []; // All Patient

// NOTIFICATION CACHE FOR INSTANT RESPONSES
let notificationCache = {
  data: null,
  timestamp: null,
  TTL: 60000 // 1 minute cache
};



function getCurrentPodId() {
  console.log('🔍 getCurrentPodId() called');
  
  // Method 1: Check for directly stored pod ID
  const sessionPodId = sessionStorage.getItem('currentPodId');
  console.log('Method 1 - sessionStorage currentPodId:', sessionPodId);
  if (sessionPodId) {
    console.log('✅ Using pod ID from session:', sessionPodId);
    return sessionPodId;
  }
  
  // Method 2: Check stored user data
  const storedUser = sessionStorage.getItem('currentUser');
  console.log('Method 2 - sessionStorage currentUser:', storedUser);
  if (storedUser) {
    try {
      const userData = JSON.parse(storedUser);
      console.log('Parsed user data:', userData);
      if (userData.podId) {
        console.log('✅ Using pod ID from stored user:', userData.podId);
        return userData.podId;
      }
      if (userData.userId) {
        console.log('✅ Using userId as pod ID:', userData.userId);
        return userData.userId;
      }
    } catch (e) {
      console.error('Error parsing stored user data:', e);
    }
  }
  
  // Method 3: Check if there's any login info stored under different keys
  console.log('Method 3 - Checking all sessionStorage keys for pod info:');
  for (let i = 0; i < sessionStorage.length; i++) {
    const key = sessionStorage.key(i);
    const value = sessionStorage.getItem(key);
    
    // Check if any key contains pod information
    if (key.toLowerCase().includes('pod') || key.toLowerCase().includes('user')) {
      console.log(`Checking key: ${key} = ${value}`);
      
      try {
        const parsedValue = JSON.parse(value);
        if (parsedValue.podId) {
          console.log(`✅ Found podId in ${key}:`, parsedValue.podId);
          return parsedValue.podId;
        }
        if (parsedValue.userId && parsedValue.userId.includes('pod_')) {
          console.log(`✅ Found pod in userId from ${key}:`, parsedValue.userId);
          return parsedValue.userId;
        }
      } catch (e) {
        // Not JSON, check if it's a direct pod ID
        if (value.includes('pod_')) {
          console.log(`✅ Found pod ID in ${key}:`, value);
          return value;
        }
      }
    }
    
    // SPECIAL CHECK: Look for userId key specifically
    if (key === 'userId' && value.includes('pod_')) {
      console.log(`✅ Found pod ID in userId key:`, value);
      return value;
    }
  }
  
  // Method 4: Check URL parameters (if pod ID is passed in URL)
  const urlParams = new URLSearchParams(window.location.search);
  const urlPodId = urlParams.get('podId') || urlParams.get('pod');
  console.log('Method 4 - URL params pod ID:', urlPodId);
  if (urlPodId) {
    console.log('✅ Using pod ID from URL:', urlPodId);
    // Store it for future use
    sessionStorage.setItem('currentPodId', urlPodId);
    return urlPodId;
  }
  
  // Last fallback
  console.log('⚠️ No pod ID found anywhere, falling back to pod_1');
  return "pod_1";
}


// ========================================
// PODIATRIST NAME FROM DATABASE
// ========================================

// Cache for podiatrist names to avoid repeated API calls
const podiatristNameCache = new Map();

async function getPodiatristNameFromDB(podId) {
  // Check cache first
  if (podiatristNameCache.has(podId)) {
    console.log('✅ Using cached name for:', podId, podiatristNameCache.get(podId));
    return podiatristNameCache.get(podId);
  }
  
  // Handle null/undefined/empty podId
  if (!podId || podId === 'unassigned') {
    console.log('⚠️ No podId provided, returning Unassigned');
    return 'Unassigned';
  }
  
  try {
    console.log('🔍 Fetching podiatrist name for podId:', podId);
    
    const response = await fetch("/api/get-podiatrist-name", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ podId })
    });
    
    console.log('📡 Server response status:', response.status);
    
    if (!response.ok) {
      console.error('❌ Server response not OK:', response.status, response.statusText);
      return `Podiatrist ${podId}`;
    }
    
    const result = await response.json();
    console.log('📊 Server response data:', result);
    
    if (result.success && result.name) {
      const fullName = result.name;
      console.log('✅ Found podiatrist name:', fullName);
      // Cache the result
      podiatristNameCache.set(podId, fullName);
      return fullName;
    } else {
      console.log('⚠️ Podiatrist not found for:', podId, 'Response:', result);
      return `Podiatrist ${podId}`;
    }
    
  } catch (error) {
    console.error('❌ Error fetching podiatrist name:', error);
    return `Podiatrist ${podId}`;
  }
}

// Sync version for immediate display (uses cache)
function getPodiatristName(podId) {
  if (podiatristNameCache.has(podId)) {
    return podiatristNameCache.get(podId);
  }
  return 'Loading...'; // Will be updated when async call completes
}

function isValidNotificationCache() {
  return notificationCache.data && 
         notificationCache.timestamp && 
         (Date.now() - notificationCache.timestamp) < notificationCache.TTL;
}

function escapeSpecialCharacters(str) { //Function to escape special characters
    const escapeMap = {
        "'": "\\'",  // Escape single quote
        '"': '\\"',  // Escape double quote
        '\\': '\\\\', // Escape backslash
        '\n': '\\n', // Escape newline
        '\r': '\\r', // Escape carriage return
        '\t': '\\t', // Escape tab
        // Add any other characters you want to escape
    };
    
    return str.replace(/['"\\\n\r\t]/g, (match) => escapeMap[match]);
}


// REPLACE your window.onload function with this FIXED version

window.onload = async () => {
  // Debug session storage
  console.log('=== SESSION STORAGE DEBUG ===');
  console.log('currentPodId:', sessionStorage.getItem('currentPodId'));
  console.log('currentUser:', sessionStorage.getItem('currentUser'));
  console.log('All sessionStorage keys:', Object.keys(sessionStorage));
  
  for (let i = 0; i < sessionStorage.length; i++) {
    const key = sessionStorage.key(i);
    const value = sessionStorage.getItem(key);
    console.log(`${key}: ${value}`);
  }
  
  const podId = getCurrentPodId();
  console.log('getCurrentPodId() returned:', podId);
  console.log('=== END DEBUG ===');

  try {
    // Load patient queue with proper error handling
    console.log('🔄 Loading patient queue for pod:', podId);
    const res = await fetch("/api/podiatrist-get-appointments-all", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ podId })
    });
  
    if (!res.ok) {
      throw new Error(`Patient queue API returned ${res.status}`);
    }
    
    const data = await res.json();
    console.log('📊 API Response for patient queue:', data);
    
    // Handle the response safely
    if (data && data.success !== false) {
      patientQueue = Array.isArray(data.appointments) ? data.appointments : [];
    } else {
      console.error('❌ API returned error:', data);
      patientQueue = [];
    }
    
    console.log('📋 Patient queue data:', patientQueue);
    console.log('📋 Patient queue length:', patientQueue.length);
    
    populateQueueTab(patientQueue);
    console.log('✅ Patient queue populated successfully');

    // Load all patients with proper error handling
    console.log('🔄 Loading all patients...');
    const resAll = await fetch("/api/get-all-appointments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });
  
    if (!resAll.ok) {
      throw new Error(`All patients API returned ${resAll.status}`);
    }
    
    const allData = await resAll.json();
    console.log('📊 API Response for all patients:', allData);
    
    // Handle the response safely
    if (allData && allData.success !== false) {
      allPatients = Array.isArray(allData.appointments) ? allData.appointments : [];
    } else {
      console.error('❌ API returned error:', allData);
      allPatients = [];
    }
    
    console.log('📋 All patients data:', allPatients);
    console.log('📋 All patients length:', allPatients.length);

    populateAllTab(allPatients);
    console.log('✅ All patients populated successfully');
    
    // Load dashboard metrics
    console.log('🔄 Loading dashboard metrics...');
    await loadDashboardMetrics();
    
    // Load real-time notifications
    console.log('🔄 Loading notifications...');
    await loadNotifications();
    
    console.log('✅ All data loaded successfully');
    
  } catch (err) {
    console.error("❌ Failed to fetch data:", err);
    
    // Set safe defaults in case of error
    patientQueue = patientQueue || [];
    allPatients = allPatients || [];
    
    // Populate tables with whatever data we have
    try {
      populateQueueTab(patientQueue);
      populateAllTab(allPatients);
    } catch (populateError) {
      console.error("❌ Error populating tables:", populateError);
    }
    
    // Show error notification to user
    showUpdateNotification('⚠️ Error loading some data. Please refresh the page.');
  }
  
  updateDayNames();
}

// ========================================
// DASHBOARD METRICS LOADING
// ========================================

async function loadDashboardMetrics() {
  const podId = getCurrentPodId();;
  
  try {
    console.log('📊 Loading dashboard metrics...');
    
    const response = await fetch("/api/get-dashboard-metrics", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ podiatristId: podId })
    });
    
    const data = await response.json();
    
    if (data.success) {
      updateDashboardDisplay(data.metrics);
      console.log('✅ Dashboard metrics loaded successfully');
    } else {
      console.error('❌ Failed to load dashboard metrics:', data.error);
      updateDashboardDisplay({
        totalAppointments: "Error",
        urgentCases: "Error", 
        completedAppointments: "Error"
      });
    }
    
  } catch (error) {
    console.error('❌ Dashboard metrics loading error:', error);
    updateDashboardDisplay({
      totalAppointments: "Error",
      urgentCases: "Error",
      completedAppointments: "Error"
    });
  }
}

function updateDashboardDisplay(metrics) {
  console.log('🔄 Updating dashboard display with:', metrics);
  
  const metricElements = document.querySelectorAll('.metric-number');
  
  if (metricElements.length >= 3) {
    metricElements[0].textContent = metrics.totalAppointments;
    metricElements[1].textContent = metrics.urgentCases;
    metricElements[2].textContent = metrics.completedAppointments;
    console.log('✅ Dashboard display updated');
  } else {
    console.warn('⚠️ Could not find all metric elements');
  }
  
  const lastUpdated = new Date().toLocaleTimeString("en-SG", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Singapore"
  });
  
  let lastUpdatedElement = document.getElementById('dashboard-last-updated');
  if (!lastUpdatedElement) {
    const dashboardWidget = document.querySelector('.dashboard-widget');
    if (dashboardWidget) {
      lastUpdatedElement = document.createElement('div');
      lastUpdatedElement.id = 'dashboard-last-updated';
      lastUpdatedElement.style.cssText = `
        font-size: 0.75rem;
        color: var(--gray-500);
        text-align: center;
        margin-top: var(--space-3);
        border-top: 1px solid var(--gray-200);
        padding-top: var(--space-2);
      `;
      dashboardWidget.appendChild(lastUpdatedElement);
    }
  }
  
  if (lastUpdatedElement) {
    lastUpdatedElement.textContent = `Last updated: ${lastUpdated}`;
  }
}

// ========================================
// REAL-TIME NOTIFICATIONS SYSTEM
// ========================================

// async function loadNotifications() {
//   const podId = getCurrentPodId();;
  
//   try {
//     // CHECK CACHE FIRST (INSTANT RESPONSE)
//     if (isValidNotificationCache()) {
//       console.log('⚡ CACHE HIT: Using cached notifications (INSTANT)');
//       updateNotificationsDisplay(notificationCache.data.notifications);
//       return;
//     }
    
//     console.log('🔔 CACHE MISS: Loading fresh notifications...');
    
//     const response = await fetch("/get-notifications", {
//       method: "POST",
//       headers: { "Content-Type": "application/json" },
//       body: JSON.stringify({ podiatristId: podId })
//     });
    
//     if (!response.ok) {
//       throw new Error(`HTTP error! status: ${response.status}`);
//     }
    
//     const data = await response.json();
    
//     if (data.success) {
//       // CACHE THE RESULT FOR INSTANT FUTURE REQUESTS
//       notificationCache.data = data;
//       notificationCache.timestamp = Date.now();
      
//       updateNotificationsDisplay(data.notifications);
//       console.log('✅ Notifications loaded and cached');
//     } else {
//       console.error('❌ Failed to load notifications:', data.error);
//       showErrorNotifications();
//     }
    
//   } catch (error) {
//     console.error('❌ Notifications loading error:', error);
//     showErrorNotifications();
//   }
// }

// REPLACE your loadNotifications function with this FIXED version

async function loadNotifications() {
  const podId = getCurrentPodId(); // 🔧 FIXED: Use proper function call without semicolons
  
  try {
    // CHECK CACHE FIRST (INSTANT RESPONSE)
    if (isValidNotificationCache()) {
      console.log('⚡ CACHE HIT: Using cached notifications (INSTANT) for pod:', podId);
      updateNotificationsDisplay(notificationCache.data.notifications);
      return;
    }
    
    console.log('🔔 CACHE MISS: Loading fresh notifications for pod:', podId);
    
    const response = await fetch("/api/get-notifications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ podId: podId }) // 🔧 FIXED: Send podId instead of podiatristId
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    console.log('📊 Notifications API Response for pod', podId, ':', data);
    
    if (data.success) {
      // 🔧 FIXED: Handle null/undefined notifications
      const notifications = data.notifications || [];
      
      console.log('🔔 Received', notifications.length, 'notifications for pod:', podId);
      
      // CACHE THE RESULT FOR INSTANT FUTURE REQUESTS
      notificationCache.data = {
        success: true,
        notifications: notifications
      };
      notificationCache.timestamp = Date.now();
      
      updateNotificationsDisplay(notifications);
      console.log('✅ Notifications loaded and cached for pod:', podId);
    } else {
      console.error('❌ Failed to load notifications for pod', podId, ':', data.error);
      showErrorNotifications();
    }
    
  } catch (error) {
    console.error('❌ Notifications loading error for pod', podId, ':', error);
    showErrorNotifications();
  }
}

function updateNotificationsDisplay(notifications) {
  console.log('🔔 Updating notifications display with:', notifications.length, 'notifications');
  
  const notificationsContainer = document.querySelector('.dashboard-widget:nth-child(3) > div:last-child');
  
  if (!notificationsContainer) {
    console.error('❌ Notifications container not found');
    return;
  }
  
  notificationsContainer.innerHTML = '';
  
  if (notifications.length === 0) {
    notificationsContainer.innerHTML = `
      <div class="medical-card" style="background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%); border-color: #bbf7d0; padding: var(--space-md); text-align: center;">
        <div class="flex items-center justify-center">
          <span style="font-size: 1.2rem; margin-right: var(--space-2);">✅</span>
          <span class="text-success font-semibold">All caught up! No urgent notifications.</span>
        </div>
      </div>
    `;
    return;
  }
  
  notifications.forEach(notification => {
    const notificationElement = createNotificationElement(notification);
    notificationsContainer.appendChild(notificationElement);
  });
  
  const lastUpdated = new Date().toLocaleTimeString("en-SG", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Singapore"
  });
  
  const timestampElement = document.createElement('div');
  timestampElement.style.cssText = `
    font-size: 0.75rem;
    color: var(--gray-500);
    text-align: center;
    margin-top: var(--space-3);
    border-top: 1px solid var(--gray-200);
    padding-top: var(--space-2);
  `;
  timestampElement.textContent = `Last updated: ${lastUpdated}`;
  notificationsContainer.appendChild(timestampElement);
}

function createNotificationElement(notification) {
  const element = document.createElement('div');
  
  let bgStyle, borderColor, badgeClass, badgeText;
  
  switch (notification.type) {
    case 'urgent':
      bgStyle = 'linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%)';
      borderColor = '#fecaca';
      badgeClass = 'badge-danger';
      badgeText = '🚨 Urgent';
      break;
    case 'upcoming':
      bgStyle = 'linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)';
      borderColor = '#fed7aa';
      badgeClass = 'badge-warning';
      badgeText = '⏰ Soon';
      break;
    case 'reminder':
      bgStyle = 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)';
      borderColor = '#bfdbfe';
      badgeClass = 'badge-info';
      badgeText = '📅 Reminder';
      break;
    case 'update':
      bgStyle = 'linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)';
      borderColor = '#fed7aa';
      badgeClass = 'badge-warning';
      badgeText = '📝 Update';
      break;
    default:
      bgStyle = 'linear-gradient(135deg, #f9fafb 0%, #f3f4f6 100%)';
      borderColor = '#e5e7eb';
      badgeClass = 'badge-secondary';
      badgeText = '📋 Notice';
  }
  
  element.className = 'medical-card notification-item';
  element.style.cssText = `
    background: ${bgStyle};
    border-color: ${borderColor};
    padding: var(--space-md);
    margin-bottom: var(--space-3);
    cursor: pointer;
    transition: all var(--transition-normal);
  `;
  
  element.addEventListener('mouseenter', () => {
    element.style.transform = 'translateY(-2px)';
    element.style.boxShadow = 'var(--shadow-md)';
  });
  
  element.addEventListener('mouseleave', () => {
    element.style.transform = 'translateY(0)';
    element.style.boxShadow = 'var(--shadow-sm)';
  });
  
  if (notification.appointmentId) {
    element.addEventListener('click', () => {
      handleNotificationClick(notification);
    });
  }
  
  const timeAgo = getTimeAgo(notification.timestamp);
  
  element.innerHTML = `
    <div class="flex items-center justify-between">
      <div class="flex items-center flex-1">
        <span class="medical-badge ${badgeClass}" style="margin-right: var(--space-3);">${badgeText}</span>
        <div class="flex-1">
          <div style="font-weight: var(--font-weight-semibold); color: var(--gray-800); margin-bottom: var(--space-1);">
            ${notification.message}
          </div>
          <div style="font-size: 0.75rem; color: var(--gray-500);">
            ${timeAgo}
          </div>
        </div>
      </div>
      ${notification.appointmentId ? '<span style="color: var(--gray-400); font-size: 0.75rem;">Click to view</span>' : ''}
    </div>
  `;
  
  return element;
}

function getTimeAgo(timestamp) {
  const now = new Date();
  const notificationTime = new Date(timestamp);
  const diffMs = now - notificationTime;
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins} min ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  
  return notificationTime.toLocaleDateString("en-SG", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Singapore"
  });
}

function handleNotificationClick(notification) {
  console.log('🔔 Notification clicked:', notification);
  
  if (notification.appointmentId && notification.patientId) {
    showTab('patients');
    
    setTimeout(() => {
      const patientRows = document.querySelectorAll('#patientQueue tr');
      patientRows.forEach(row => {
        const patientIdCell = row.querySelector('td:nth-child(2)');
        if (patientIdCell && patientIdCell.textContent.trim() === notification.patientId) {
          row.style.backgroundColor = '#fef3c7';
          row.style.border = '2px solid #f59e0b';
          row.scrollIntoView({ behavior: 'smooth', block: 'center' });
          
          setTimeout(() => {
            row.style.backgroundColor = '';
            row.style.border = '';
          }, 3000);
        }
      });
    }, 100);
  }
}

function showErrorNotifications() {
  const notificationsContainer = document.querySelector('.dashboard-widget:nth-child(3) > div:last-child');
  
  if (notificationsContainer) {
    notificationsContainer.innerHTML = `
      <div class="medical-card" style="background: linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%); border-color: #fecaca; padding: var(--space-md); text-align: center;">
        <div class="flex items-center justify-center">
          <span style="font-size: 1.2rem; margin-right: var(--space-2);">❌</span>
          <span class="text-danger font-semibold">Error loading notifications</span>
        </div>
      </div>
    `;
  }
}

// ========================================
// AUTO-REFRESH AND EXPORTS
// ========================================

// Auto-refresh notifications every 5 minutes
setInterval(loadNotifications, 5 * 60 * 1000); 

// // Auto-refresh dashboard metrics every 5 minutes
// setInterval(loadDashboardMetrics, 5 * 60 * 1000);

// 🔄 CROSS-PODIATRIST: Auto-refresh All Patients tab every 30 seconds to catch changes from other pods
setInterval(() => {
  // Only refresh if the All Patients tab is currently visible
  const allPatientsTab = document.getElementById('all-patients-tab');
  if (allPatientsTab && !allPatientsTab.classList.contains('hidden')) {
    console.log('🔄 CROSS-POD: Auto-refreshing All Patients tab to catch changes from other podiatrists...');
    if (typeof window.refreshAllPatients === 'function') {
      window.refreshAllPatients();
    }
  }
}, 30 * 1000); // Every 30 seconds - frequent enough to catch changes quickly

// Export functions for global access
window.loadNotifications = loadNotifications;
window.refreshNotifications = loadNotifications;
window.refreshDashboardMetrics = async function() {
  console.log('🔄 Manually refreshing dashboard metrics...');
  await loadDashboardMetrics();
  if (typeof window.showUpdateNotification === 'function') {
    window.showUpdateNotification('Dashboard metrics refreshed');
  }
};
window.loadDashboardMetrics = loadDashboardMetrics;

// ========================================
// TAB SWITCHING
// ========================================

/**function showTab(tabName) {
  const tabs = document.querySelectorAll('.tab-content');
  tabs.forEach(tab => tab.classList.add('hidden'));
  
  const buttons = document.querySelectorAll('.tab-button');
  buttons.forEach(btn => {
    btn.classList.remove('active');
    btn.style.borderBottomColor = 'transparent';
  });
  
  document.getElementById(tabName + '-tab').classList.remove('hidden');
  
  event.target.classList.add('active');
  event.target.style.borderBottomColor = 'var(--blue-600)';
}**/

function showTab(tabName, event) {
  const tabs = document.querySelectorAll('.tab-content');
  tabs.forEach(tab => tab.classList.add('hidden'));
  
  const buttons = document.querySelectorAll('.tab-button');
  buttons.forEach(btn => {
    btn.classList.remove('active');
    btn.style.borderBottomColor = 'transparent';
  });
  
  const targetTab = document.getElementById(tabName + '-tab');
  if (targetTab) {
    targetTab.classList.remove('hidden');
  }
  
  if (event && event.target) {
    event.target.classList.add('active');
    event.target.style.borderBottomColor = 'var(--blue-600)';
  } else {
    buttons.forEach(btn => {
      if (btn.getAttribute('onclick')?.includes(tabName)) {
        btn.classList.add('active');
        btn.style.borderBottomColor = 'var(--blue-600)';
      }
    });
  }
}

// ========================================
// QUICK ACTION FUNCTIONS
// ========================================

function viewPatientQueue() {
  showTab('patients');
}

function scheduleAppointment() {
  showTab('schedule');
}

// ========================================
// PATIENT QUEUE MANAGEMENT
// ========================================

async function refreshPatientQueue() {
  try {
    console.log('🔄 Refreshing patient queue...');
    
    const podId = getCurrentPodId();
    console.log('🔄 Refreshing for pod:', podId);
    
    const res = await fetch("/api/podiatrist-get-appointments-all", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ podId })
    });
    
    const data = await res.json();
    console.log('📊 Refresh API Response:', data);
    
    // 🔧 CRITICAL FIX: Handle null/undefined appointments
    patientQueue = data.appointments || [];
    
    console.log('📋 Refreshed patient queue data:', patientQueue);
    console.log('📋 Refreshed patient queue length:', patientQueue.length);
    
    // Only call populateQueueTab if we have valid data (even if empty array)
    if (Array.isArray(patientQueue)) {
      populateQueueTab(patientQueue);
      console.log('✅ Patient queue refreshed and populated successfully');
      
      if (patientQueue.length > 0) {
        console.log('📊 Queue order:', patientQueue.map(p => `${p.name} (Level ${p.urgencyLevel})`));
      } else {
        console.log('📋 Patient queue is empty for pod:', podId);
      }
    } else {
      console.error('❌ Refreshed patient queue is not an array:', typeof patientQueue, patientQueue);
      patientQueue = []; // Reset to empty array
      populateQueueTab([]); // Populate with empty array
    }
    
    showUpdateNotification(`Patient queue updated for ${podId}`);
    
  } catch (err) {
    console.error("❌ Failed to refresh patient queue:", err);
    
    // Set safe default and show error notification
    patientQueue = [];
    populateQueueTab([]);
    showUpdateNotification('Error refreshing patient queue');
  }
}

// ========================================
// REFRESH ALL PATIENTS TAB
// ========================================

async function refreshAllPatients() {
  try {
    console.log('🔄 Refreshing all patients tab...');
    
    const resAll = await fetch("/api/get-all-appointments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });
  
    const allData = await resAll.json();
    console.log('📊 All patients refresh - API Response:', allData);
    
    // Use existing logic - handle null/undefined appointments
    allPatients = allData.appointments || [];
    
    console.log('✅ All patients data refreshed, count:', allPatients.length);

    // Use existing populateAllTab function - no changes to original logic
    if (Array.isArray(allPatients)) {
      populateAllTab(allPatients);
      console.log('✅ All patients tab populated successfully');
    } else {
      console.error('❌ All patients is not an array:', typeof allPatients, allPatients);
      allPatients = [];
      populateAllTab([]);
    }
    
    
  } catch (err) {
    console.error("❌ Failed to refresh all patients:", err);
    allPatients = [];
    populateAllTab([]);
    showUpdateNotification('Error refreshing all patients tab');
  }
}



// ========================================
// PATIENT FILTERING AND SEARCH LOGIC
// ========================================

function filterPatients() {
  const searchValue = document.getElementById("searchName").value.toLowerCase();
  const selectedCategory = document.getElementById("filterCategory").value;

  console.log('🔍 Filtering patients:', { searchValue, selectedCategory });
  console.log('📊 Original patient queue:', patientQueue);

  // Filter the patient queue based on search and category
  const filteredData = patientQueue.filter(patient => {
    // Check name match (search in both patient ID and name)
    const matchesName = searchValue === "" || 
                       patient.patientId.toLowerCase().includes(searchValue) ||
                       (patient.name && patient.name.toLowerCase().includes(searchValue));
    
    // Check category match
    const matchesCategory = selectedCategory === "" || 
                           patient.category.toLowerCase() === selectedCategory.toLowerCase();
    
    const shouldInclude = matchesName && matchesCategory;
    
    if (searchValue || selectedCategory) {
      console.log(`Patient ${patient.name}: name match=${matchesName}, category match=${matchesCategory}, included=${shouldInclude}`);
    }
    
    return shouldInclude;
  });

  console.log('✅ Filtered results:', filteredData);

  // Update the table with filtered data
  populateQueueTab(filteredData);
  
  // Show filter status
  showFilterStatus(filteredData.length, patientQueue.length, searchValue, selectedCategory);
}


function filterAllPatients() {
  const searchValue = document.getElementById("searchNameAll").value.toLowerCase();
  const selectedCategory = document.getElementById("filterCategoryAll").value;

  console.log('🔍 Filtering patients:', { searchValue, selectedCategory });
  console.log('📊 Original patient queue:', allPatients);

  // Filter the patient queue based on search and category
  const filteredData = allPatients.filter(patient => {
    // Check name match (search in both patient ID and name)
    const matchesName = searchValue === "" || 
                       patient.patientId.toLowerCase().includes(searchValue) ||
                       (patient.name && patient.name.toLowerCase().includes(searchValue));
    
    // Check category match
    const matchesCategory = selectedCategory === "" || 
                           patient.category.toLowerCase() === selectedCategory.toLowerCase();
    
    const shouldInclude = matchesName && matchesCategory;
    
    if (searchValue || selectedCategory) {
      console.log(`Patient ${patient.name}: name match=${matchesName}, category match=${matchesCategory}, included=${shouldInclude}`);
    }
    
    return shouldInclude;
  });

  console.log('✅ Filtered results:', filteredData);

  // Update the table with filtered data
  populateAllTab(filteredData);
  
  // Show filter status
  showFilterStatusAll(filteredData.length, allPatients.length, searchValue, selectedCategory);
}

// ========================================
// REAL-TIME SEARCH ENHANCEMENT
// ========================================

function setupRealTimeSearch() {
  const searchInput = document.getElementById("searchName");
  const categorySelect = document.getElementById("filterCategory");
  const searchInputAll = document.getElementById("searchNameAll");
  const categorySelectAll = document.getElementById("filterCategoryAll");
  
  if (searchInput) {
    // Add real-time search with debouncing
    let searchTimeout;
    searchInput.addEventListener('input', function() {
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => {
        filterPatients();
      }, 300); // 300ms delay to avoid too many calls
    });
    
    // Also trigger on Enter key
    searchInput.addEventListener('keypress', function(event) {
      if (event.key === 'Enter') {
        clearTimeout(searchTimeout);
        filterPatients();
      }
    });
  }
  
  if (categorySelect) {
    categorySelect.addEventListener('change', filterPatients);
  }

  if (searchInputAll) {
    // Add real-time search with debouncing
    let searchTimeout;
    searchInputAll.addEventListener('input', function() {
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => {
        filterAllPatients();
      }, 300); // 300ms delay to avoid too many calls
    });
    
    // Also trigger on Enter key
    searchInputAll.addEventListener('keypress', function(event) {
      if (event.key === 'Enter') {
        clearTimeout(searchTimeout);
        filterAllPatients();
      }
    });
  }
  
  if (categorySelectAll) {
    categorySelectAll.addEventListener('change', filterAllPatients);
  }
}

// Initialize search when page loads
document.addEventListener('DOMContentLoaded', function() {
  setupRealTimeSearch();
});

function showFilterStatus(filteredCount, totalCount, searchValue, selectedCategory) {
  // Remove any existing filter status
  const existingStatus = document.getElementById('filter-status');
  if (existingStatus) {
    existingStatus.remove();
  }
  
  // Only show status if filters are active
  if (searchValue || selectedCategory) {
    const statusDiv = document.createElement('div');
    statusDiv.id = 'filter-status';
    statusDiv.style.cssText = `
      background: var(--blue-50);
      border: 1px solid var(--blue-200);
      border-radius: var(--radius-lg);
      padding: var(--space-3) var(--space-4);
      margin: var(--space-4) 0;
      font-size: 0.875rem;
      color: var(--blue-700);
    `;
    
    let statusText = `📊 Showing ${filteredCount} of ${totalCount} patients`;
    
    if (searchValue && selectedCategory) {
      statusText += ` (filtered by name: "${searchValue}" and category: "${selectedCategory}")`;
    } else if (searchValue) {
      statusText += ` (filtered by name: "${searchValue}")`;
    } else if (selectedCategory) {
      statusText += ` (filtered by category: "${selectedCategory}")`;
    }
    
    statusText += ' • <button onclick="clearFilters()" style="color: var(--blue-600); text-decoration: underline; background: none; border: none; cursor: pointer;">Clear filters</button>';
    
    statusDiv.innerHTML = statusText;
    
    // Insert before the table wrapper
    const tableWrapper = document.getElementById('patient-queue-table');
    tableWrapper.parentNode.insertBefore(statusDiv, tableWrapper);
  }
}

function showFilterStatusAll(filteredCount, totalCount, searchValue, selectedCategory) {
  // Remove any existing filter status
  const existingStatus = document.getElementById('filter-status-all');
  if (existingStatus) {
    existingStatus.remove();
  }
  
  // Only show status if filters are active
  if (searchValue || selectedCategory) {
    const statusDiv = document.createElement('div');
    statusDiv.id = 'filter-status-all';
    statusDiv.style.cssText = `
      background: var(--blue-50);
      border: 1px solid var(--blue-200);
      border-radius: var(--radius-lg);
      padding: var(--space-3) var(--space-4);
      margin: var(--space-4) 0;
      font-size: 0.875rem;
      color: var(--blue-700);
    `;
    
    let statusText = `📊 Showing ${filteredCount} of ${totalCount} patients`;
    
    if (searchValue && selectedCategory) {
      statusText += ` (filtered by name: "${searchValue}" and category: "${selectedCategory}")`;
    } else if (searchValue) {
      statusText += ` (filtered by name: "${searchValue}")`;
    } else if (selectedCategory) {
      statusText += ` (filtered by category: "${selectedCategory}")`;
    }
    
    statusText += ' • <button onclick="clearFiltersAll()" style="color: var(--blue-600); text-decoration: underline; background: none; border: none; cursor: pointer;">Clear filters</button>';
    
    statusDiv.innerHTML = statusText;
    
    // Insert before the table wrapper
    const tableWrapper = document.getElementById('patient-all-table');
    tableWrapper.parentNode.insertBefore(statusDiv, tableWrapper);
  }
}

function clearFilters() {
  // Clear the input values
  document.getElementById("searchName").value = "";
  document.getElementById("filterCategory").value = "";
  
  // Remove filter status
  const existingStatus = document.getElementById('filter-status');
  if (existingStatus) {
    existingStatus.remove();
  }
  
  // Show all patients
  populateQueueTab(patientQueue);
  
  console.log('🧹 Filters cleared, showing all patients');
}

function clearFiltersAll() {
  // Clear the input values
  document.getElementById("searchNameAll").value = "";
  document.getElementById("filterCategoryAll").value = "";
  
  // Remove filter status
  const existingStatus = document.getElementById('filter-status-all');
  if (existingStatus) {
    existingStatus.remove();
  }
  
  // Show all patients
  populateAllTab(allPatients);
  
  console.log('🧹 Filters cleared, showing all patients');
}

function getUrgencyBadgeClass(urgencyLevel) {
  switch (urgencyLevel) {
    case 1: return "danger";
    case 2: return "warning"; 
    case 3: return "info";
    case 4: return "secondary";
    default: return "secondary";
  }
}

function getUrgencyText(urgencyLevel) {
  switch (urgencyLevel) {
    case 1: return "🚨 Urgent";
    case 2: return "⚠️ High";
    case 3: return "📋 Medium";
    case 4: return "📝 Low";
    default: return "📋 Standard";
  }
}

function populateQueueTab(data = patientQueue) {
  const tableBody = document.getElementById("patientQueue");
  tableBody.innerHTML = "";

  // ✅ CRITICAL FIX: Sort by urgency level BEFORE displaying
  const sortedData = [...data].sort((a, b) => {
    // Sort by urgency level: 1 (most urgent) to 4 (least urgent)
    if (a.urgencyLevel !== b.urgencyLevel) {
      return a.urgencyLevel - b.urgencyLevel; // 1, 2, 3, 4
    }
    
    // If same urgency, sort by appointment date (earliest first)
    const dateA = new Date(a.date);
    const dateB = new Date(b.date);
    return dateA - dateB;
  });

  console.log('📊 Patient queue sorted by urgency:', sortedData.map(p => ({
    name: p.name,
    urgency: p.urgencyLevel,
    category: p.category
  })));

  sortedData.forEach((patient, index) => {
    const row = document.createElement("tr");
    
    // Store patient data as data attributes for easy access
    row.setAttribute('data-patient-id', patient.patientId);
    row.setAttribute('data-patient-name', patient.name || 'Unknown');
    row.setAttribute('data-patient-category', patient.category || 'General');
    row.setAttribute('data-patient-diagnosis', patient.initialDiagnosis || 'Assessment pending');
    row.setAttribute('data-patient-date', patient.date || 'TBD');
    row.setAttribute('data-patient-time', patient.time || 'TBD');
    row.setAttribute('data-patient-summary', patient.summary || 'No summary available');
    row.setAttribute('data-patient-urgency', patient.urgencyLevel || 4);
    row.setAttribute('data-patient-status', patient.status || 'scheduled');
    row.setAttribute('data-appointment-id', patient.apptId || 'unknown');

    // ✅ VISUAL PRIORITY INDICATOR: Add background color based on urgency
    let rowBgColor = '';
    switch(patient.urgencyLevel) {
      case 1:
        rowBgColor = 'background-color: #fef2f2; border-left: 4px solid #ef4444;'; // Red
        break;
      case 2:
        rowBgColor = 'background-color: #fffbeb; border-left: 4px solid #f59e0b;'; // Orange
        break;
      case 3:
        rowBgColor = 'background-color: #eff6ff; border-left: 4px solid #3b82f6;'; // Blue
        break;
      case 4:
        rowBgColor = 'background-color: #f9fafb; border-left: 4px solid #6b7280;'; // Gray
        break;
    }
    
    row.style.cssText = rowBgColor;

    row.innerHTML = `
    <td><span class="medical-badge badge-${getUrgencyBadgeClass(patient.urgencyLevel)}">${getUrgencyText(patient.urgencyLevel)}</span></td>
    <td>${patient.patientId}</td>
    <td>${patient.name}</td>
    <td>${patient.category}</td>
    <td>${patient.initialDiagnosis}</td>
    <td>${patient.date} (Status: ${patient.status})</td>
    <td>
      <button class="medical-btn medical-btn-primary medical-btn-sm"
      onclick="openModal('queue', '${patient.apptId}', '${patient.patientId}', '${patient.name}', '${patient.category}', '${escapeSpecialCharacters(patient.initialDiagnosis)}', '${patient.status}', '${patient.date}', '${patient.time}', '${escapeSpecialCharacters(patient.summary)}', '${patient.podId || ''}', '${patient.imageUrl || ''}', '${escapeSpecialCharacters(patient.imageCaption || '')}')"
      >👁️ View</button>
      <button class="medical-btn medical-btn-secondary medical-btn-sm ml-sm" onclick="askAIAboutPatientFromRow(this)">🤖 Ask AI</button>
    </td>
  `;
    
    tableBody.appendChild(row);
  });
}

// Debug function to check patient queue data
function debugPatientQueue() {
  console.log('Current patient queue:', patientQueue);
  patientQueue.forEach((patient, index) => {
    console.log(`Patient ${index + 1}:`, {
      id: patient.patientId,
      name: patient.name,
      category: patient.category,
      diagnosis: patient.initialDiagnosis,
      summary: patient.summary
    });
  });
}

// Call debug function when queue is refreshed
window.debugQueue = debugPatientQueue;

//Function to populate All Patients tab
function populateAllTab(data = allPatients) {
  const tableBody = document.getElementById("patientAll");
  tableBody.innerHTML = "";

  // ✅ CRITICAL FIX: Sort by urgency level BEFORE displaying
  const sortedData = [...data].sort((a, b) => {
    // Sort by urgency level: 1 (most urgent) to 4 (least urgent)
    if (a.urgencyLevel !== b.urgencyLevel) {
      return a.urgencyLevel - b.urgencyLevel; // 1, 2, 3, 4
    }
    
    // If same urgency, sort by appointment date (earliest first)
    const dateA = new Date(a.date);
    const dateB = new Date(b.date);
    return dateA - dateB;
  });

  console.log('📊 Patient queue sorted by urgency:', sortedData.map(p => ({
    name: p.name,
    urgency: p.urgencyLevel,
    category: p.category
  })));

  sortedData.forEach((patient, index) => {
    const row = document.createElement("tr");
    
    // Store patient data as data attributes for easy access
    row.setAttribute('data-patient-id', patient.patientId);
    row.setAttribute('data-patient-name', patient.name || 'Unknown');
    row.setAttribute('data-patient-category', patient.category || 'General');
    row.setAttribute('data-patient-diagnosis', patient.initialDiagnosis || 'Assessment pending');
    row.setAttribute('data-patient-date', patient.date || 'TBD');
    row.setAttribute('data-patient-time', patient.time || 'TBD');
    row.setAttribute('data-patient-summary', patient.summary || 'No summary available');
    row.setAttribute('data-patient-urgency', patient.urgencyLevel || 4);
    row.setAttribute('data-patient-status', patient.status || 'scheduled');
    row.setAttribute('data-appointment-id', patient.apptId || 'unknown');

    // ✅ VISUAL PRIORITY INDICATOR: Add background color based on urgency
    let rowBgColor = '';
    switch(patient.urgencyLevel) {
      case 1:
        rowBgColor = 'background-color: #fef2f2; border-left: 4px solid #ef4444;'; // Red
        break;
      case 2:
        rowBgColor = 'background-color: #fffbeb; border-left: 4px solid #f59e0b;'; // Orange
        break;
      case 3:
        rowBgColor = 'background-color: #eff6ff; border-left: 4px solid #3b82f6;'; // Blue
        break;
      case 4:
        rowBgColor = 'background-color: #f9fafb; border-left: 4px solid #6b7280;'; // Gray
        break;
    }
   //hello 
    row.style.cssText = rowBgColor;

    row.innerHTML = `
    <td><span class="medical-badge badge-${getUrgencyBadgeClass(patient.urgencyLevel)}">${getUrgencyText(patient.urgencyLevel)}</span></td>
    <td>${patient.patientId}</td>
    <td>${patient.name}</td>
    <td>${patient.category}</td>
    <td>${patient.initialDiagnosis}</td>
    <td>${patient.status}</td>
    <td>${patient.date}</td>
    <td>
      <button class="medical-btn medical-btn-primary medical-btn-sm"
      onclick="openModal('all', '${patient.apptId}',  '${patient.patientId}', '${patient.name}', '${patient.category}', '${escapeSpecialCharacters(patient.initialDiagnosis)}', '${patient.status}', '${patient.date}', '${patient.time}', '${escapeSpecialCharacters(patient.summary)}', '${patient.podId || 'unassigned'}', '${patient.imageUrl || ''}', '${escapeSpecialCharacters(patient.imageCaption || '')}')"
      >👁️ View</button>
      <button class="medical-btn medical-btn-secondary medical-btn-sm ml-sm" onclick="askAIAboutPatientFromRow(this)">🤖 Ask AI</button>
    </td>
  `;
    tableBody.appendChild(row);
  });
}


function openModal(tab, apptId, patientId, name, category, symptoms, status, date, time, summary, podId, imageUrl, imageCaption) {
  console.log('🔍 Opening modal with params:', { tab, apptId, patientId, name, podId });
  
  // Check if modal elements exist
  const modal = document.getElementById('patientModal');
  if (!modal) {
    console.error('❌ Patient modal not found!');
    return;
  }
  
  // Set basic patient info
  const setElementText = (id, text) => {
    const element = document.getElementById(id);
    if (element) {
      element.innerText = text || 'N/A';
    } else {
      console.warn(`⚠️ Element ${id} not found`);
    }
  };
  
  setElementText('modalPatientId', patientId);
  setElementText('modalPatientName', name);
  setElementText('modalPatientCategory', category);
  setElementText('modalPatientSymptoms', symptoms);
  setElementText('modalPatientWaitTime', time + " on " + date);
  setElementText('modalPatientStatus', status);
  setElementText('modalPatientCaseSummary', summary);

  // Display patient image if available
  const imageContainer = document.getElementById('modalPatientImage');
  if (imageContainer) {
    if (imageUrl && imageUrl !== 'null' && imageUrl !== 'undefined') {
      imageContainer.innerHTML = `
        <div style="margin: 15px 0; padding: 15px; background: #f8f9fa; border-radius: 8px;">
          <p><strong>📷 Patient Submitted Image:</strong></p>
          <img src="${imageUrl}" 
               alt="Patient foot image" 
               style="max-width: 100%; max-height: 400px; border-radius: 8px; cursor: pointer; box-shadow: 0 2px 8px rgba(0,0,0,0.1);"
               onclick="window.open('${imageUrl}', '_blank')">
          ${imageCaption && imageCaption !== 'null' ? `<p style="margin-top: 10px; font-style: italic; color: #666;">Caption: ${imageCaption}</p>` : ''}
          <p style="font-size: 12px; color: #888; margin-top: 5px;">Click image to view full size</p>
        </div>
      `;
    } else {
      imageContainer.innerHTML = ''; // Clear if no image
    }
  }
  
  // Set podiatrist name (async)
  const podiatristElement = document.getElementById('modalAssignedPodiatrist');
  if (podiatristElement) {
    podiatristElement.innerText = 'Loading...';
    
    // Load podiatrist name asynchronously
    getPodiatristNameFromDB(podId).then(podiatristName => {
      if (podiatristElement) { // Check again in case modal was closed
        podiatristElement.innerText = podiatristName;
      }
    }).catch(error => {
      console.error('Error loading podiatrist name:', error);
      if (podiatristElement) {
        podiatristElement.innerText = podId ? `Podiatrist ${podId}` : 'Unassigned';
      }
    });
  }
  
  const originalSlot = formatDate(date) + "T" + formatTime(time);

  function formatDate(dateString) { //Convert Date to HTML Readable 
    const [day, month, year] = dateString.split(' ');
    const months = {
      January: '01', February: '02', March: '03', April: '04',
      May: '05', June: '06', July: '07', August: '08',
      September: '09', October: '10', November: '11', December: '12'
    };
    return `${year}-${months[month]}-${String(day).padStart(2, '0')}`;
  }

  function formatTime(timeString) { //Convert Date to HTML Readable 
    const timeParts = timeString.split(' ');
    let [hours, minutes] = timeParts[0].split(':');
    if (timeParts[1] === 'pm' && hours !== '12') {
      hours = String(Number(hours) + 12);
    } else if (timeParts[1] === 'am' && hours === '12') {
      hours = '00';
    }
    return hours+":"+minutes;
  }
  
  // Show the modal
  modal.style.display = 'block';

  // Handle button visibility
  const editBtn = document.getElementById('modalPatientEditBtn');
  const cancelBtn = document.getElementById('modalPatientCancelBtn');
  
  if (editBtn) {
    if (tab == 'all' && status != 'cancelled') {
      editBtn.hidden = true;
    } else {
      editBtn.hidden = false;
    }
    editBtn.onclick = function() {openEditModal(name, date, time, patientId, apptId)};
  }

  if (cancelBtn) {
    if (tab == 'queue' && status != 'cancelled') {
      cancelBtn.hidden = false;
    } else {
      cancelBtn.hidden = true;
    }
    cancelBtn.onclick = function() {openCancelModal(apptId, originalSlot)};
  }
}

function closeModal() {
  document.getElementById('patientModal').style.display = 'none';
}

function openEditModal(appointmentPatient, appointmentDate, appointmentTime, patientId, appointmentId) {
  closeModal();
  window.podiatristCalendar.showEditAppointmentModal(appointmentPatient, appointmentDate, appointmentTime, patientId, appointmentId);
}

function openCancelModal(appointmentId, originalSlot) {
  closeModal();
  

  //open cancel modal (put more details in, date time, name) Fix close logic
  const modalHTML = `
    <div id="cancelAppointmentModal" class="edit-modal-overlay">
      <div class="edit-modal-content">
        <div class="edit-modal-header">
          <h3>📝 Cancel Appointment For: ${appointmentId}</h3>
          <button class="edit-modal-close" onclick="closeCancelAppointmentModal()">✕</button>
        </div>
        <div class="edit-modal-body">
          <h3>Are You Sure You Want To Cancel?</h3>
          <div class="edit-modal-footer">
            <button class="medical-btn medical-btn-secondary" onclick="cancelAppointment('${appointmentId || 'unknown'}', '${originalSlot || 'unknown'}')">❌ Confirm Cancelation</button>
            <button class="medical-btn medical-btn-primary" onclick="closeCancelAppointmentModal()">🔄 Go Back</button>
          </div>
        </div>
      </div>
    </div>
  `;
  
  document.body.insertAdjacentHTML('beforeend', modalHTML);
};

function closeCancelAppointmentModal() {
  const modal = document.getElementById('cancelAppointmentModal');
  if (modal) {
    modal.remove();
  }
};

async function cancelAppointment(appointmentId, originalSlot) {
  // Show loading state
  const saveBtn = event.target;
  const originalText = saveBtn.textContent;
  saveBtn.textContent = '⏳ Saving...';
  saveBtn.disabled = true;

  //Update in database
  try {
    const res = await fetch("/api/podiatrist-cancel-appointment", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ "apptId": appointmentId, "originalSlot": originalSlot })
    });

    const result = await res.json();
    
    if (result.success) {
      console.log('✅ Appointment cancelation successful:', result);
      
      // IMMEDIATE: Trigger calendar refresh right after successful update
      setTimeout(async () => {
        console.log('🔄 IMMEDIATE: Triggering calendar refresh...');
        await window.podiatristCalendar.refreshCalendar();
        
        // Also refresh patient queue if available
        if (typeof this.refreshPatientQueue === 'function') {
          await this.refreshPatientQueue();
        }
      }, 500); // Short delay to ensure DB update is complete
      
    } else {
      console.error('❌ Database update failed:', result);
    }

  } catch (err) {
    console.error("❌ Failed to update appt:", err);
    throw err; // Re-throw to handle in calling function
  }

  //close cancel modal
  closeCancelAppointmentModal()

  //regen queue and calendar
}

window.onclick = function(event) {
  const modal = document.getElementById('patientModal');
  if (event.target === modal) {
    closeModal();
  }
};



function toggleAIChat() {
  const popup = document.getElementById('aiChatPopup');
  const btn = document.getElementById('aiFloatingBtn');
  
  console.log('🤖 Toggle AI Chat called'); // Debug log
  
  if (popup && btn) {
    if (popup.classList.contains('ai-popup-open')) {
      // CLOSE the popup
      popup.classList.remove('ai-popup-open');
      btn.classList.remove('ai-btn-active');
      console.log('✅ AI Chat popup closed');
    } else {
      // OPEN the popup
      popup.classList.add('ai-popup-open');
      btn.classList.add('ai-btn-active');
      console.log('✅ AI Chat popup opened');
    }
  } else {
    console.error('❌ AI Chat elements not found!');
  }
}

function handleAIEnter(event) {
  if (event.key === 'Enter') {
    if (window.sendAIMessage) {
      window.sendAIMessage();
    }
  }
}

function askAIAboutPatient(patientId) {
  console.log('Getting AI analysis for patient:', patientId);
  
  // Find the specific patient case from the queue
  const patientCase = patientQueue.find(patient => patient.patientId === patientId);
  
  console.log('Found patient case:', patientCase); // Debug log
  
  toggleAIChat();
  
  setTimeout(() => {
    let message;
    
    if (patientCase) {
      // Build unique message for each patient case
      message = `Tell me about this case: 
Patient ID: ${patientCase.patientId}
Name: ${patientCase.name}
Category: ${patientCase.category}  
Diagnosis: ${patientCase.initialDiagnosis}
Appointment: ${patientCase.date} at ${patientCase.time}
Case Summary: ${patientCase.summary}
Urgency Level: ${patientCase.urgencyLevel}

Please provide clinical analysis and recommendations for this specific case.`;
    } else {
      message = `Tell me about Patient ${patientId} - I couldn't find their case details in the current queue.`;
    }
    
    console.log('AI Message for', patientId, ':', message); // Debug log
    
    const aiInput = document.getElementById('aiMessage');
    if (aiInput) {
      aiInput.value = message;
      if (window.sendAIMessage) {
        window.sendAIMessage();
      }
    }
  }, 1000);
}



function askAIAboutPatientFromRow(buttonElement) {
  // Get the table row containing this button
  const row = buttonElement.closest('tr');
  
  if (!row) {
    console.error('Could not find table row');
    return;
  }
  
  // Extract patient data from data attributes
  const patientData = {
    patientId: row.getAttribute('data-patient-id'),
    name: row.getAttribute('data-patient-name'),
    status: row.getAttribute('data-patient-status'),
    appointmentId: row.getAttribute('data-appointment-id') // ADD THIS
  };
  
  console.log('🤖 Getting AI analysis for patient from row:', patientData);
  
  // FORCE SHOW the AI chat popup
  const popup = document.getElementById('aiChatPopup');
  const btn = document.getElementById('aiFloatingBtn');
  
  if (popup && btn) {
    popup.classList.add('ai-popup-open');
    btn.classList.add('ai-btn-active');
    console.log('✅ AI popup forced open');
  }
  
  setTimeout(() => {
    // SEND APPOINTMENT ID TO SERVER
    const message = `Analyze appointment ${patientData.appointmentId || 'unknown'} for patient ${patientData.patientId} (${patientData.name})`;
    
    console.log('📝 AI Message:', message);
    
    const aiInput = document.getElementById('aiMessage');
    if (aiInput) {
      aiInput.value = message;
      
      if (window.sendAIMessage) {
        window.sendAIMessage();
      }
    } else {
      console.error('❌ AI input field not found!');
    }
  }, 500);
}

// ========================================
// REAL-TIME UPDATE FUNCTIONS
// ========================================

async function refreshCalendarView() {
  try {
    console.log('🔄 Enhanced calendar refresh triggered...');
    
    if (window.podiatristCalendar && typeof window.podiatristCalendar.refreshCalendar === 'function') {
      console.log('🔄 Using calendar instance refresh...');
      await window.podiatristCalendar.refreshCalendar();
      return;
    }
    
    if (typeof window.refreshCalendar === 'function') {
      console.log('🔄 Using global calendar refresh...');
      await window.refreshCalendar();
      return;
    }
    
    console.log('🔄 Manual calendar reload...');
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();
    
    if (window.podiatristCalendar && typeof window.podiatristCalendar.generateCalendarForMonth === 'function') {
      await window.podiatristCalendar.loadAppointments();
      window.podiatristCalendar.generateCalendarForMonth(currentMonth, currentYear);
    }
    
    console.log('✅ Calendar refresh completed');
    
  } catch (error) {
    console.error('❌ Error refreshing calendar:', error);
  }
}

function showUpdateNotification(message) {
  const notification = document.createElement('div');
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: #10b981;
    color: white;
    padding: 12px 20px;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    z-index: 10000;
    font-size: 0.9rem;
    font-weight: 500;
    animation: slideInRight 0.3s ease-out;
  `;
  notification.innerHTML = `✅ ${message}`;
  
  const style = document.createElement('style');
  style.textContent = `
    @keyframes slideInRight {
      from { transform: translateX(100%); opacity: 0; }
      to { transform: translateX(0); opacity: 1; }
    }
    @keyframes slideOutRight {
      from { transform: translateX(0); opacity: 1; }
      to { transform: translateX(100%); opacity: 0; }
    }
  `;
  document.head.appendChild(style);
  
  document.body.appendChild(notification);
  
  setTimeout(() => {
    notification.style.animation = 'slideOutRight 0.3s ease-in';
    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
      if (style.parentNode) {
        style.parentNode.removeChild(style);
      }
    }, 300);
  }, 3000);
}

function updateDayNames() { //Shorten calendar day names if in smaller screen
  const isSmallScreen = window.innerWidth <= 768;
  document.querySelectorAll('.calendar-day-header').forEach((header, index) => {
      if (isSmallScreen) {
          header.textContent = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][index];
      } else {
          header.textContent = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'][index];
      }
  });
}


// ========================================
// AUTO-REFRESH FUNCTIONS FOR REAL-TIME UPDATES
// ========================================

// Enhanced calendar refresh that actually works
async function forceRefreshCalendar() {
  try {
    console.log('🔄 FORCE: Refreshing calendar with all methods...');
    
    // Method 1: Clear cache first
    if (typeof scheduleCache !== 'undefined') {
      scheduleCache.clear();
    }
    
    // Method 2: Use calendar instance if available
    if (window.podiatristCalendar && window.podiatristCalendar.isInitialized) {
      console.log('🔄 FORCE: Using calendar instance...');
      await window.podiatristCalendar.refreshCalendar();
    }
    
    // Method 3: Use global function
    if (typeof window.refreshCalendarView === 'function') {
      console.log('🔄 FORCE: Using global function...');
      await window.refreshCalendarView();
    }
    
    // Method 4: Manual reload and regenerate
    if (window.podiatristCalendar) {
      console.log('🔄 FORCE: Manual reload...');
      await window.podiatristCalendar.loadAppointments();
      const currentDate = window.podiatristCalendar.currentDate || new Date();
      window.podiatristCalendar.generateCalendarForMonth(
        currentDate.getMonth(), 
        currentDate.getFullYear()
      );
    }
    
    console.log('✅ FORCE: Calendar refresh completed');
    
    // Show notification
    showUpdateNotification('📅 Calendar updated successfully');
    
  } catch (error) {
    console.error('❌ FORCE: Calendar refresh failed:', error);
  }
}

// Export the function globally
window.forceRefreshCalendar = forceRefreshCalendar;


// ========================================
// SYSTEM FUNCTIONS
// ========================================

function openSettings() {
  alert('Settings panel coming soon:\n- Profile management\n- Notification preferences\n- System settings');
}

function logout() {
  if (confirm('Are you sure you want to logout?')) {
    sessionStorage.clear();
    window.location.href = 'login.html';
  }
}

// ========================================
// INITIALIZATION
// ========================================

document.addEventListener('DOMContentLoaded', function() {
  console.log('Podiatrist Dashboard loaded successfully');
  showTab('patients');
});

window.addEventListener('resize', function() {
  // Responsive handling if needed
});

window.addEventListener('resize', updateDayNames);

// ========================================
// GLOBAL FUNCTION EXPORTS
// ========================================

window.showTab = showTab;
window.viewPatientQueue = viewPatientQueue;
window.scheduleAppointment = scheduleAppointment;
window.toggleAIChat = toggleAIChat;
window.handleAIEnter = handleAIEnter;
window.askAIAboutPatient = askAIAboutPatient;
window.askAIAboutPatientFromRow = askAIAboutPatientFromRow;
window.openSettings = openSettings;
window.logout = logout;
window.refreshPatientQueue = refreshPatientQueue;
window.refreshCalendarView = refreshCalendarView;
window.showUpdateNotification = showUpdateNotification;
window.filterPatients = filterPatients;
window.filterAllPatients = filterAllPatients;
window.openModal = openModal;
window.closeModal = closeModal;
window.clearFilters = clearFilters;
window.clearFiltersAll = clearFiltersAll;
window.showFilterStatus = showFilterStatus;
window.setupRealTimeSearch = setupRealTimeSearch;