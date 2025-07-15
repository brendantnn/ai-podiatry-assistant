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

function isValidNotificationCache() {
  return notificationCache.data && 
         notificationCache.timestamp && 
         (Date.now() - notificationCache.timestamp) < notificationCache.TTL;
}

// Load Stuff on entering window
window.onload = async () => {
  const podId = "pod_1"; // Simulated logged-in podiatrist

  try {
    // Load patient queue
    const res = await fetch("/podiatrist-get-queue", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ podId })
    });
  
    const data = await res.json();
    patientQueue = data.appointments;
    
    // ✅ IMPORTANT: populateTable will now auto-sort by urgency
    populateTable(patientQueue);
    
    console.log('✅ Patient queue loaded and sorted by urgency level');

    //load all patients
    const resAll = await fetch("/podiatrist-get-all-patients", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });
  
    const allData = await resAll.json();
    allPatients = allData.appointments;

    //READ ME BEFORE YOU CONT: Finished getting all list of patients from db, still need check for bugs and over laps, ability to accept appointments, search.
    
    // ✅ IMPORTANT: populateTable will now auto-sort by urgency [Remove comment]
    populateAllTab(allPatients);
    
    console.log('✅ Patient queue loaded and sorted by urgency level');
    
    // Load dashboard metrics
    await loadDashboardMetrics();
    
    // Load real-time notifications
    await loadNotifications();
    
  } catch (err) {
    console.error("❌ Failed to fetch data:", err);
  }
}

// ========================================
// DASHBOARD METRICS LOADING
// ========================================

async function loadDashboardMetrics() {
  const podId = "pod_1";
  
  try {
    console.log('📊 Loading dashboard metrics...');
    
    const response = await fetch("/get-dashboard-metrics", {
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

async function loadNotifications() {
  const podId = "pod_1";
  
  try {
    // CHECK CACHE FIRST (INSTANT RESPONSE)
    if (isValidNotificationCache()) {
      console.log('⚡ CACHE HIT: Using cached notifications (INSTANT)');
      updateNotificationsDisplay(notificationCache.data.notifications);
      return;
    }
    
    console.log('🔔 CACHE MISS: Loading fresh notifications...');
    
    const response = await fetch("/get-notifications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ podiatristId: podId })
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (data.success) {
      // CACHE THE RESULT FOR INSTANT FUTURE REQUESTS
      notificationCache.data = data;
      notificationCache.timestamp = Date.now();
      
      updateNotificationsDisplay(data.notifications);
      console.log('✅ Notifications loaded and cached');
    } else {
      console.error('❌ Failed to load notifications:', data.error);
      showErrorNotifications();
    }
    
  } catch (error) {
    console.error('❌ Notifications loading error:', error);
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

// Auto-refresh dashboard metrics every 5 minutes
setInterval(loadDashboardMetrics, 5 * 60 * 1000);

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

function showTab(tabName) {
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
    
    const podId = "pod_1";
    const res = await fetch("/podiatrist-get-queue", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ podId })
    });
    
    const data = await res.json();
    patientQueue = data.appointments || [];
    
    // ✅ IMPORTANT: populateTable will now auto-sort by urgency
    populateTable(patientQueue);
    
    console.log('✅ Patient queue refreshed and sorted by urgency level');
    console.log('📊 Queue order:', patientQueue.map(p => `${p.name} (Level ${p.urgencyLevel})`));
    
    showUpdateNotification('Patient queue updated and sorted by priority');
    
  } catch (err) {
    console.error("❌ Failed to refresh patient queue:", err);
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
  populateTable(filteredData);
  
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
  populateTable(patientQueue);
  
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

function populateTable(data = patientQueue) {
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
    <td>${patient.date}</td>
    <td>
      <button class="medical-btn medical-btn-primary medical-btn-sm"
      onclick="openModal('${patient.patientId}', '${patient.name}', '${patient.category}', '${patient.initialDiagnosis}', '${patient.time} on ${patient.date}', '${patient.summary}')"
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
    <td>${patient.date}</td>
    <td>
      <button class="medical-btn medical-btn-primary medical-btn-sm"
      onclick="openModal('${patient.patientId}', '${patient.name}', '${patient.category}', '${patient.initialDiagnosis}', '${patient.time} on ${patient.date}', '${patient.summary}')"
      >👁️ View</button>
      <button class="medical-btn medical-btn-secondary medical-btn-sm ml-sm" onclick="askAIAboutPatientFromRow(this)">🤖 Ask AI</button>
    </td>
  `;
    
    tableBody.appendChild(row);
  });
}

function openModal(id, name, category, symptoms, waitTime, summary) {
  document.getElementById('modalPatientId').innerText = id;
  document.getElementById('modalPatientName').innerText = name;
  document.getElementById('modalPatientCategory').innerText = category;
  document.getElementById('modalPatientSymptoms').innerText = symptoms;
  document.getElementById('modalPatientWaitTime').innerText = waitTime;
  document.getElementById('modalPatientCaseSummary').innerText = summary;

  document.getElementById('patientModal').style.display = 'block';
}

function closeModal() {
  document.getElementById('patientModal').style.display = 'none';
}

window.onclick = function(event) {
  const modal = document.getElementById('patientModal');
  if (event.target === modal) {
    closeModal();
  }
};

// ========================================
// AI ASSISTANT FUNCTIONS
// ========================================

function toggleAIChat() {
  const popup = document.getElementById('aiChatPopup');
  const btn = document.getElementById('aiFloatingBtn');
  
  if (popup && btn) {
    if (popup.classList.contains('ai-popup-open')) {
      popup.classList.remove('ai-popup-open');
      btn.classList.remove('ai-btn-active');
    } else {
      popup.classList.add('ai-popup-open');
      btn.classList.add('ai-btn-active');
    }
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

// NEW FUNCTION: Handle AI requests from table rows using data attributes
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
    category: row.getAttribute('data-patient-category'),
    initialDiagnosis: row.getAttribute('data-patient-diagnosis'),
    date: row.getAttribute('data-patient-date'),
    time: row.getAttribute('data-patient-time'),
    summary: row.getAttribute('data-patient-summary'),
    urgencyLevel: parseInt(row.getAttribute('data-patient-urgency'))
  };
  
  console.log('Getting AI analysis for patient from row:', patientData);
  
  toggleAIChat();
  
  setTimeout(() => {
    // Build unique message for this specific patient case
  const message = `[PATIENT_QUEUE_ANALYSIS] Tell me about this case: 
  Patient ID: ${patientData.patientId}
  Name: ${patientData.name}
  Category: ${patientData.category}  
  Diagnosis: ${patientData.initialDiagnosis}
  Appointment: ${patientData.date} at ${patientData.time}
  Case Summary: ${patientData.summary}
  Urgency Level: ${patientData.urgencyLevel}

  Please provide clinical analysis and recommendations for this specific case.`;
    
    console.log('AI Message for', patientData.patientId, ':', message);
    
    const aiInput = document.getElementById('aiMessage');
    if (aiInput) {
      aiInput.value = message;
      if (window.sendAIMessage) {
        window.sendAIMessage();
      }
    }
  }, 1000);
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

// // Auto-refresh calendar every 30 seconds to catch any missed updates
// setInterval(() => {
//   if (window.podiatristCalendar && window.podiatristCalendar.isInitialized) {
//     console.log('🔄 AUTO: Periodic calendar refresh...');
//     window.podiatristCalendar.refreshCalendar();
//   }
// }, 30000); // 30 seconds

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