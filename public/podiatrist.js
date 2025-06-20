// ========================================
// PODIATRIST DASHBOARD FUNCTIONALITY
// Tab switching and UI interactions
// ========================================

// Tab switching functionality
function showTab(tabName) {
  // Hide all tab contents
  const tabs = document.querySelectorAll('.tab-content');
  tabs.forEach(tab => tab.classList.add('hidden'));
  
  // Remove active class from all buttons
  const buttons = document.querySelectorAll('.tab-button');
  buttons.forEach(btn => {
    btn.classList.remove('active');
    btn.style.borderBottomColor = 'transparent';
  });
  
  // Show selected tab
  document.getElementById(tabName + '-tab').classList.remove('hidden');
  
  // Add active class to clicked button
  event.target.classList.add('active');
  event.target.style.borderBottomColor = 'var(--blue-600)';
}

// ========================================
// QUICK ACTION FUNCTIONS
// JONATHAN: Frontend interactions and UI updates
// JUNJIE: Backend routing and business logic
// TODO: Connect these to actual backend functionality
// ========================================

function viewPatientQueue() {
  showTab('patients');
  // TODO: JUNJIE - Add backend call to refresh patient data
}

function scheduleAppointment() {
  showTab('schedule');
  // TODO: JUNJIE - Add scheduling backend logic and validation
  // TODO: JONATHAN - Add scheduling UI components
}

function viewReports() {
  showTab('analytics');
  // TODO: JUNJIE - Add reports backend logic and data aggregation
  // TODO: JONATHAN - Add reports UI and visualization
}

function accessResources() {
  alert('Accessing clinical resources...');
  // TODO: JUNJIE - Replace with actual resources backend integration
  // TODO: JONATHAN - Add resources UI and navigation
}

// ========================================
// BERNICE'S PROFESSIONAL AI CHATBOT IMPLEMENTATION
// Enhanced formatting with professional styling
// ========================================

// Enhanced helper function to format AI responses with better structure
function formatAIResponse(message) {
  // Convert markdown-style formatting to HTML
  let formatted = message
    // Bold text: **text** -> <strong>text</strong>
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    // Headers: ## Title -> <h4>Title</h4>
    .replace(/^## (.+)$/gm, '<h4 style="color: var(--blue-700); margin: var(--space-4) 0 var(--space-2) 0; font-size: 1.1rem;">$1</h4>')
    // Single bullet points: • text -> <li>text</li>
    .replace(/^[•·]\s+(.+)$/gm, '<li>$1</li>')
    // Numbered lists: 1. text -> <li>text</li> 
    .replace(/^\d+\.\s+(.+)$/gm, '<li>$1</li>')
    // Line breaks
    .replace(/\n\n/g, '</p><p>')
    .replace(/\n/g, '<br>');
    
  // Wrap in paragraphs and handle lists
  formatted = '<p>' + formatted + '</p>';
  
  // Fix lists by wrapping consecutive <li> items in <ul>
  formatted = formatted.replace(/(<li>.*?<\/li>)(\s*<br>\s*<li>.*?<\/li>)*/g, function(match) {
    const listItems = match.match(/<li>.*?<\/li>/g);
    return '<ul>' + listItems.join('') + '</ul>';
  });
  
  // Clean up empty paragraphs
  formatted = formatted.replace(/<p><\/p>/g, '').replace(/<p><br><\/p>/g, '');
  
  return formatted;
}

// PROFESSIONAL Main AI Chat Function
async function sendPodiatristMessage() {
  const input = document.getElementById('podiatristMessage');
  const chatbox = document.getElementById('podiatristChatbox');
  
  if (!input || !chatbox) return;
  
  const message = input.value.trim();
  if (!message) return;
  
  // Add user message to chat - Professional styling
  chatbox.innerHTML += `<div class="message-user"><strong>Dr. [NAME]:</strong> ${message}</div>`;
  input.value = '';
  chatbox.scrollTop = chatbox.scrollHeight;

  try {
    // Send to podiatrist chat endpoint
    const response = await fetch("/podiatrist-chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        message: message,
        podiatristId: "current_podiatrist"
      })
    });

    const data = await response.json();

    // Format and display AI response with professional structure
    const formattedReply = formatAIResponse(data.reply);
    chatbox.innerHTML += `<div class="message-bot"><strong>Clinical Assistant:</strong><br>${formattedReply}</div>`;
    chatbox.scrollTop = chatbox.scrollHeight;

  } catch (err) {
    console.error("AI chat error:", err);
    chatbox.innerHTML += `<div class="message-bot"><strong>Clinical Assistant:</strong> I'm currently unable to connect. Please try again.</div>`;
    chatbox.scrollTop = chatbox.scrollHeight;
  }
}

// Enhanced Quick Query Function with Patient Support
async function sendQuickQuery(query) {
  const chatbox = document.getElementById('podiatristChatbox') || document.getElementById('aiChatbox');
  
  // Add user query to chat
  addMessageToChat(query, 'user', chatbox);
  
  try {
    let response;
    
    // Check if it's a patient-specific query
    if (query.includes('patient summary') || query.includes('Patient')) {
      // This will work better once database is ready
      response = await fetch("/podiatrist-patient-query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          query: query,
          patientId: "P001" // Default for now, will be dynamic later
        })
      });
    } else {
      // General medical queries
      response = await fetch("/podiatrist-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          message: generateQueryPrompt(query),
          podiatristId: "current_podiatrist"
        })
      });
    }

    const data = await response.json();
    addMessageToChat(data.reply, 'bot', chatbox);

  } catch (err) {
    console.error("Quick query error:", err);
    addMessageToChat("Error processing your request. Please try again.", 'bot', chatbox);
  }
}

// Helper function to generate specific prompts for quick queries
function generateQueryPrompt(query) {
  const prompts = {
    'patient summary': 'Can you provide guidance on reviewing patient cases and what key information I should focus on during consultations?',
    'treatment options': 'What are the standard treatment protocols for common podiatry conditions like diabetic foot ulcers, plantar fasciitis, and ingrown toenails?',
    'drug interactions': 'What are important drug interactions I should be aware of when treating foot conditions, especially for diabetic patients?',
    'clinical guidelines': 'Can you summarize the latest clinical guidelines for podiatry care, particularly for wound management and diabetic foot care?',
    'urgent cases': 'What are the red flags and criteria I should use to identify urgent cases that need immediate attention in podiatry?',
    'scheduling': 'What factors should I consider when prioritizing patient appointments based on condition severity?'
  };
  
  return prompts[query] || query;
}

// PROFESSIONAL addMessageToChat function with formatting
function addMessageToChat(message, sender, chatbox) {
  if (!chatbox) return;
  
  const messageDiv = document.createElement('div');
  messageDiv.className = sender === 'user' ? 'message-user' : 'message-bot';
  
  if (sender === 'user') {
    messageDiv.innerHTML = `<strong>Dr. [NAME]:</strong> ${message}`;
  } else {
    const formattedMessage = formatAIResponse(message);
    messageDiv.innerHTML = `<strong>Clinical Assistant:</strong><br>${formattedMessage}`;
  }
  
  chatbox.appendChild(messageDiv);
  chatbox.scrollTop = chatbox.scrollHeight;
}

// Add Enter key support for main chat
function addEnterKeySupport() {
  const mainInput = document.getElementById('podiatristMessage');
  if (mainInput) {
    mainInput.addEventListener('keypress', function(event) {
      if (event.key === 'Enter') {
        sendPodiatristMessage();
      }
    });
  }
}

// ========================================
// PROFESSIONAL FLOATING AI ASSISTANT
// Enhanced with professional styling
// ========================================

// Toggle AI Chat Popup
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

// PROFESSIONAL sendAIMessage function for floating chat
async function sendAIMessage() {
  const input = document.getElementById('aiMessage');
  const message = input.value.trim();
  if (message) {
    // Add user message to chat
    addFormattedAIMessage(message, 'user');
    input.value = '';
    
    try {
      const response = await fetch("/podiatrist-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          message: message,
          podiatristId: "current_podiatrist"
        })
      });

      const data = await response.json();
      addFormattedAIMessage(data.reply, 'bot');

    } catch (err) {
      console.error("Floating AI chat error:", err);
      addFormattedAIMessage("Unable to connect to clinical assistant. Please try again.", 'bot');
    }
  }
}

// Professional Add Message function with formatting for floating AI
function addFormattedAIMessage(message, sender) {
  const chatbox = document.getElementById('aiChatbox');
  const messageDiv = document.createElement('div');
  messageDiv.className = sender === 'user' ? 'message-user' : 'message-bot';
  
  if (sender === 'user') {
    messageDiv.innerHTML = '<strong>You:</strong> ' + message;
  } else {
    const formattedMessage = formatAIResponse(message);
    messageDiv.innerHTML = '<strong>Clinical Assistant:</strong><br>' + formattedMessage;
  }
  
  chatbox.appendChild(messageDiv);
  chatbox.scrollTop = chatbox.scrollHeight;
}

// Handle Enter Key in AI Input
function handleAIEnter(event) {
  if (event.key === 'Enter') {
    sendAIMessage();
  }
}

// ========================================
// PATIENT-SPECIFIC QUERY FUNCTIONS
// These will work better once Yin Er has the database ready
// ========================================

// Function to query specific patient information
async function queryPatientInfo(patientId, question) {
  try {
    const response = await fetch("/podiatrist-patient-query", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        query: question,
        patientId: patientId
      })
    });

    const data = await response.json();
    
    // Display in the active chatbox
    const chatbox = document.getElementById('podiatristChatbox') || document.getElementById('aiChatbox');
    addMessageToChat(`Question about ${patientId}: ${question}`, 'user', chatbox);
    addMessageToChat(data.reply, 'bot', chatbox);

  } catch (err) {
    console.error("Patient query error:", err);
  }
}

// Quick patient query buttons (you can add these to HTML later)
function quickPatientQuery(patientId) {
  const questions = [
    "What is the current treatment plan?",
    "What are the latest symptoms reported?",
    "When was the last appointment?",
    "Are there any urgent concerns?"
  ];
  
  // For now, just ask the first question
  queryPatientInfo(patientId, questions[0]);
}

// ========================================
// LEGACY AI ASSISTANT FUNCTIONALITY (For backwards compatibility)
// TODO: Remove these once floating AI is fully integrated
// ========================================

// ========================================
// PATIENT QUEUE MANAGEMENT
// JONATHAN: UI interactions and display updates
// JUNJIE: Backend data management and business logic
// TODO: Connect to actual database/backend
// ========================================

function refreshPatientQueue() {
  // TODO: JUNJIE - Implement actual refresh functionality with database calls
  // TODO: JONATHAN - Add loading states and UI feedback
  console.log('Refreshing patient queue...');
  // This would typically make an API call to get updated patient data
}

function viewPatientDetails(patientId) {
  // TODO: JUNJIE - Implement patient detail backend data fetching
  // TODO: JONATHAN - Implement patient detail UI modal/page
  console.log('Viewing details for patient:', patientId);
  // This would open a modal or navigate to patient detail page
}

function startPatientChat(patientId) {
  // TODO: JUNJIE - Implement patient chat backend integration
  // TODO: JONATHAN - Implement chat UI interface
  console.log('Starting chat with patient:', patientId);
  // This would open chat interface with specific patient
}

// ========================================
// APPOINTMENT MANAGEMENT
// JONATHAN: Appointment UI components and interactions
// JUNJIE: Scheduling backend logic and business rules
// TODO: Connect to actual scheduling system
// ========================================

function rescheduleAppointment(appointmentId) {
  // TODO: JUNJIE - Implement reschedule backend logic and validation
  // TODO: JONATHAN - Add reschedule UI modal and calendar picker
  console.log('Rescheduling appointment:', appointmentId);
}

function cancelAppointment(appointmentId) {
  // TODO: JUNJIE - Implement cancel backend logic and notification system
  // TODO: JONATHAN - Add cancel confirmation UI
  console.log('Cancelling appointment:', appointmentId);
}

function addNewAppointment() {
  // TODO: JUNJIE - Implement new appointment backend creation and validation
  // TODO: JONATHAN - Add new appointment UI form and calendar integration
  console.log('Adding new appointment...');
}

// ========================================
// NOTIFICATION MANAGEMENT
// JONATHAN: Notification UI display and interactions
// JUNJIE: Real-time notification backend and business logic
// TODO: Connect to actual notification system
// ========================================

function markNotificationRead(notificationId) {
  // TODO: JUNJIE - Implement notification read status backend update
  // TODO: JONATHAN - Update notification UI state
  console.log('Marking notification as read:', notificationId);
}

function clearAllNotifications() {
  // TODO: JUNJIE - Implement clear all notifications backend logic
  // TODO: JONATHAN - Update notification UI display
  console.log('Clearing all notifications...');
}

// ========================================
// ANALYTICS AND REPORTING
// JONATHAN: Analytics UI, charts, and data visualization
// JUNJIE: Data aggregation, calculations, and report generation
// TODO: Connect to actual analytics backend
// ========================================

function generateReport(reportType) {
  // TODO: JUNJIE - Implement report generation backend logic and data processing
  // TODO: JONATHAN - Add report generation UI and progress indicators
  console.log('Generating report:', reportType);
}

function exportData(dataType) {
  // TODO: JUNJIE - Implement data export backend processing and file generation
  // TODO: JONATHAN - Add export UI and download handling
  console.log('Exporting data:', dataType);
}

function syncEMR() {
  // TODO: JUNJIE - Implement EMR synchronization backend integration
  // TODO: JONATHAN - Add sync UI status and progress indicators
  console.log('Syncing with EMR system...');
}

// ========================================
// UTILITY FUNCTIONS
// ========================================

// Initialize dashboard when page loads
document.addEventListener('DOMContentLoaded', function() {
  console.log('Podiatrist Dashboard loaded successfully');
  
  // Set default active tab
  showTab('patients');
  
  // Add enter key support for AI chat
  addEnterKeySupport();
  
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
// ADDITIONAL FUNCTIONALITY TO BE IMPLEMENTED
// TODO: Add these functions as needed by your team
// ========================================

// TODO: JUNJIE - Authentication and session management functions
// TODO: JUNJIE - Patient data loading and API integration functions
// TODO: JUNJIE - Real-time updates functionality and WebSocket connections
// TODO: JUNJIE - Data export/import backend processing
// TODO: JUNJIE - Settings management backend logic
// TODO: JUNJIE - Business logic for severity-based patient prioritization
// TODO: JUNJIE - EMR integration and medical workflow management
// TODO: JUNJIE - Security and compliance implementation (HIPAA)
// TODO: JUNJIE - Resource optimization and conflict resolution algorithms
// TODO: JUNJIE - Audit trails for all medical interactions

// TODO: JONATHAN - UI components for all above backend functions
// TODO: JONATHAN - Error handling and user feedback systems
// TODO: JONATHAN - Offline support UI states
// TODO: JONATHAN - Print functionality and layouts
// TODO: JONATHAN - Advanced dashboard widgets and analytics visualization