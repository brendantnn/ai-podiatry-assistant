// ========================================
// PODIATRIST DASHBOARD FUNCTIONALITY
// Tab switching and UI interactions ONLY
// ========================================

//Declare needed variables

let patientQueue = []; // Patient Queue

// Load Stuff on entering window
window.onload = async () => {
  const podId = "pod_1"; // Simulated logged-in podiatrist

  try {
    const res = await fetch("/podiatrist-get-queue", { // Get patient queue
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ podId })
    });
  
    // Get queue from database and assgin to variable
    const data = await res.json();
    patientQueue = data.appointments;
    populateTable(patientQueue)
    
  }catch (err) {
    console.error("❌ Failed to fetch patient details:", err);
  }
}

// Tab switching functionality
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
  // TODO: Add backend call to refresh patient data
}

function scheduleAppointment() {
  showTab('schedule');
  // TODO: Add scheduling backend logic and validation
}

function viewReports() {
  showTab('analytics');
  // TODO: Add reports backend logic and data aggregation
}

function accessResources() {
  alert('Accessing clinical resources...');
  // TODO: Replace with actual resources backend integration
}

// ========================================
// PATIENT QUEUE MANAGEMENT
// ========================================

function refreshPatientQueue() {
  // TODO: Implement actual refresh functionality with database calls
  console.log('Refreshing patient queue...');
}

function viewPatientDetails(patientId) {
  // TODO: Implement patient detail backend data fetching
  console.log('Viewing details for patient:', patientId);
}

function startPatientChat(patientId) {
  // TODO: Implement patient chat backend integration
  console.log('Starting chat with patient:', patientId);
}

// Filter function
function filterPatients() {
  const searchValue = document.getElementById("searchName").value.toLowerCase();
  const selectedCategory = document.getElementById("filterCategory").value;

  const filteredData = patientQueue.filter(patient => {
    const matchesName = patient.patientId.toLowerCase().includes(searchValue);
    const matchesCategory = selectedCategory === "" || patient.category.toLowerCase() === selectedCategory.toLowerCase();
    return matchesName && matchesCategory;
  });

  populateTable(filteredData);
}

//Dynamically make dashboard
function populateTable(data = patientQueue) {
  const tableBody = document.getElementById("patientQueue");
  tableBody.innerHTML = ""; // Clear existing rows

  data.forEach(patient => {
    const row = document.createElement("tr");

    row.innerHTML = `
      <td><span class="medical-badge badge-${patient.urgencyLevel === "🚨 Urgent" ? "danger" : "warning"}">${patient.urgencyLevel}</span></td>
      <td>${patient.patientId}</td>
      <td>${patient.name}</td>
      <td>${patient.category}</td>
      <td>${patient.initialDiagnosis}</td>
      <td>${patient.date}</td>
      <td>
        <button class="medical-btn medical-btn-primary medical-btn-sm"
        onclick="openModal('${patient.patientId}', '${patient.name}', '${patient.category}', '${patient.initialDiagnosis}', '${patient.date}', '${patient.summary}')"
        >👁️ View</button>
        <button class="medical-btn medical-btn-secondary medical-btn-sm ml-sm">💬 Chat</button>
      </td>
    `;
    
    tableBody.appendChild(row);
  });
}
 
// Function to open populated modal
function openModal(id, name, category, symptoms, waitTime, summary) {
  document.getElementById('modalPatientId').innerText = id;
  document.getElementById('modalPatientName').innerText = name;
  document.getElementById('modalPatientCategory').innerText = category;
  document.getElementById('modalPatientSymptoms').innerText = symptoms;
  document.getElementById('modalPatientWaitTime').innerText = waitTime;
  document.getElementById('modalPatientCaseSummary').innerText = summary;

  // Show the modal
  document.getElementById('patientModal').style.display = 'block';
  }

  function closeModal() {
  document.getElementById('patientModal').style.display = 'none';
  }

  // Close the modal when clicking outside of it
  window.onclick = function(event) {
  const modal = document.getElementById('patientModal');
  if (event.target === modal) {
    closeModal();
  }
};


// ========================================
// APPOINTMENT MANAGEMENT
// ========================================

function rescheduleAppointment(appointmentId) {
  // TODO: Implement reschedule backend logic and validation
  console.log('Rescheduling appointment:', appointmentId);
}

function cancelAppointment(appointmentId) {
  // TODO: Implement cancel backend logic and notification system
  console.log('Cancelling appointment:', appointmentId);
}

function addNewAppointment() {
  // TODO: Implement new appointment backend creation and validation
  console.log('Adding new appointment...');
}

// ========================================
// NOTIFICATION MANAGEMENT
// ========================================

function markNotificationRead(notificationId) {
  // TODO: Implement notification read status backend update
  console.log('Marking notification as read:', notificationId);
}

function clearAllNotifications() {
  // TODO: Implement clear all notifications backend logic
  console.log('Clearing all notifications...');
}

// ========================================
// ANALYTICS AND REPORTING
// ========================================

function generateReport(reportType) {
  // TODO: Implement report generation backend logic and data processing
  console.log('Generating report:', reportType);
}

function exportData(dataType) {
  // TODO: Implement data export backend processing and file generation
  console.log('Exporting data:', dataType);
}

function syncEMR() {
  // TODO: Implement EMR synchronization backend integration
  console.log('Syncing with EMR system...');
}

// ========================================
// FLOATING AI ASSISTANT TOGGLE
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

// Handle Enter Key in AI Input (calls the AI chat module)
function handleAIEnter(event) {
  if (event.key === 'Enter') {
    // This will be handled by the AI chat module
    if (window.sendAIMessage) {
      window.sendAIMessage();
    }
  }
}


// ========================================
// DASHBOARD DATA LOADING
// ========================================

async function loadDashboardData() {
  // TODO: Load initial dashboard metrics
  console.log('Loading dashboard data...');
}

async function loadPatientQueue() {
  // TODO: Load patient queue from backend
  console.log('Loading patient queue...');
}

async function loadNotifications() {
  // TODO: Load notifications from backend
  console.log('Loading notifications...');
}

// ========================================
// UTILITY FUNCTIONS
// ========================================

// Initialize dashboard when page loads
document.addEventListener('DOMContentLoaded', function() {
  console.log('Podiatrist Dashboard loaded successfully');
  
  // Set default active tab
  showTab('patients');
  
  // TODO: Load initial data
  // loadDashboardData();
  // loadPatientQueue();
  // loadNotifications();
});

// Handle window resize for responsive adjustments
window.addEventListener('resize', function() {
  // TODO: Add responsive handling if needed
});

// ========================================
// PATIENT TABLE INTERACTION FUNCTIONS
// ========================================

// These functions are called from the HTML table buttons
function viewPatient(patientId) {
  console.log('Viewing patient:', patientId);
  // TODO: Implement patient detail view
  alert(`Viewing patient ${patientId} details\n\nFeatures coming soon:\n- Medical history\n- Current treatments\n- Progress notes`);
}

function chatWithPatient(patientId) {
  console.log('Starting chat with patient:', patientId);
  // TODO: Implement patient chat functionality
  alert(`Starting chat with patient ${patientId}\n\nFeatures coming soon:\n- Real-time messaging\n- Medical updates\n- Appointment coordination`);
}

// ========================================
// SETTINGS AND SYSTEM FUNCTIONS
// ========================================

function openSettings() {
  alert('Settings panel coming soon:\n- Profile management\n- Notification preferences\n- System settings');
}

function logout() {
  if (confirm('Are you sure you want to logout?')) {
    // TODO: Implement proper logout with session clearing
    sessionStorage.clear();
    window.location.href = 'login.html';
  }
}

// ========================================
// DEBUG AND TESTING FUNCTIONS
// ========================================

function testDashboardFunctions() {
  console.log('🧪 Testing dashboard functions...');
  
  console.log('Tab functions:', typeof showTab);
  console.log('Patient queue functions:', typeof refreshPatientQueue);
  console.log('Appointment functions:', typeof rescheduleAppointment);
  console.log('Calendar integration:', typeof resetCalendarFilters);
  
  console.log('✅ Dashboard function testing completed');
}

// Make test function globally available
window.testDashboardFunctions = testDashboardFunctions;

// ========================================
// GLOBAL FUNCTION EXPORTS
// Make functions available to HTML onclick handlers
// ========================================

window.showTab = showTab;
window.viewPatientQueue = viewPatientQueue;
window.scheduleAppointment = scheduleAppointment;
window.viewReports = viewReports;
window.accessResources = accessResources;
window.toggleAIChat = toggleAIChat;
window.handleAIEnter = handleAIEnter;
window.viewPatient = viewPatient;
window.chatWithPatient = chatWithPatient;
window.openSettings = openSettings;
window.logout = logout;