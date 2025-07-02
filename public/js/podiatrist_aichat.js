// ========================================
// COMPLETE WORKING AI CHAT - FLOATING ASSISTANT WITH MODAL APPOINTMENT EDITING
// ========================================

class PodiatristAIChat {
  constructor() {
    this.isInitialized = false;
    this.patientCache = new Map();
    this.selectedAppointment = null;
    
    this.init = this.init.bind(this);
    this.sendMessage = this.sendMessage.bind(this);
    this.sendQuickQuery = this.sendQuickQuery.bind(this);
    this.querySpecificPatient = this.querySpecificPatient.bind(this);
    this.refreshChat = this.refreshChat.bind(this);
    this.startAppointmentEdit = this.startAppointmentEdit.bind(this);
    this.detectEditRequest = this.detectEditRequest.bind(this);
    this.parseEditRequest = this.parseEditRequest.bind(this);
    this.processAppointmentEdit = this.processAppointmentEdit.bind(this);
    this.showAppointmentModal = this.showAppointmentModal.bind(this);
    this.closeAppointmentModal = this.closeAppointmentModal.bind(this);
    this.selectAppointmentFromModal = this.selectAppointmentFromModal.bind(this);
  }

  // Initialize AI chat system
  init() {
    console.log('🤖 Initializing Podiatrist AI Chat (Floating Only)...');
    
    if (this.isInitialized) {
      console.log('⚠️ AI Chat already initialized');
      return;
    }

    try {
      this.setupEventListeners();
      this.initializeWelcomeMessage();
      
      this.isInitialized = true;
      console.log('✅ AI Chat initialization completed');
    } catch (error) {
      console.error('❌ AI Chat initialization failed:', error);
    }
  }

  // Initialize welcome message ONLY in floating chatbox
  initializeWelcomeMessage() {
    console.log('📝 Initializing welcome message in floating chatbox...');
    
    const floatingChatbox = document.getElementById('aiChatbox');
    if (floatingChatbox && floatingChatbox.children.length === 0) {
      console.log('📝 Adding welcome message to floating chatbox');
      this.addWelcomeMessage(floatingChatbox);
    }
    
    console.log('✅ Welcome message initialized');
  }

  // Setup event listeners ONLY for floating chatbox
  setupEventListeners() {
    const floatingInput = document.getElementById('aiMessage');
    if (floatingInput) {
      floatingInput.addEventListener('keypress', (event) => {
        if (event.key === 'Enter') {
          this.sendFloatingMessage();
        }
      });
    }
    console.log('✅ Event listeners setup for floating AI only');
  }

  // REFRESH CHAT FUNCTION - ONLY floating chatbox
  refreshChat() {
    console.log('🔄 Refreshing floating chat...');
    
    const chatbox = document.getElementById('aiChatbox');
    
    if (!chatbox) {
      console.error('❌ No floating chatbox available for refresh');
      return;
    }

    chatbox.innerHTML = '';
    this.addWelcomeMessage(chatbox);
    this.patientCache.clear();
    this.selectedAppointment = null;
    
    console.log('✅ Floating chat refreshed successfully');
  }

  // ADD COMPLETE WELCOME MESSAGE WITH APPOINTMENT EDITING
  addWelcomeMessage(chatbox) {
    const welcomeDiv = document.createElement('div');
    welcomeDiv.className = 'message-bot';
    welcomeDiv.innerHTML = `
      <strong>🤖 Clinical Assistant:</strong> 
      <p>Hello Dr. [NAME]! I'm your AI support assistant. I can help you with:</p>
      
      <div style="margin: 16px 0; padding: 16px; background: #fefdf8; border-radius: 12px; border: 1px solid #e5e7eb;">
        <h4 style="color: #1d4ed8; margin: 0 0 12px 0; font-size: 1rem;">📋 Patient Management</h4>
        <div style="display: grid; gap: 8px; margin-bottom: 16px;">
          <button class="medical-btn medical-btn-secondary medical-btn-sm" onclick="podiatristAI.sendQuickQuery('today schedule')" style="text-align: left; padding: 8px 12px;">
            📅 Today's Schedule Overview
          </button>
          <button class="medical-btn medical-btn-secondary medical-btn-sm" onclick="podiatristAI.sendQuickQuery('urgent cases')" style="text-align: left; padding: 8px 12px;">
            🚨 Urgent Cases Summary
          </button>
          <button class="medical-btn medical-btn-secondary medical-btn-sm" onclick="podiatristAI.sendQuickQuery('patient summaries')" style="text-align: left; padding: 8px 12px;">
            📝 Recent Patient Summaries
          </button>
        </div>
        
        <h4 style="color: #1d4ed8; margin: 0 0 12px 0; font-size: 1rem;">🔧 Appointment Management</h4>
        <div style="display: grid; gap: 8px; margin-bottom: 16px;">
          <button class="medical-btn medical-btn-secondary medical-btn-sm" onclick="podiatristAI.startAppointmentEdit()" style="text-align: left; padding: 8px 12px;">
            ✏️ Edit Appointment
          </button>
          <button class="medical-btn medical-btn-secondary medical-btn-sm" onclick="podiatristAI.sendQuickQuery('reschedule help')" style="text-align: left; padding: 8px 12px;">
            🔄 Reschedule Help
          </button>
        </div>
        
        <h4 style="color: #1d4ed8; margin: 0 0 12px 0; font-size: 1rem;">🩺 Clinical Support</h4>
        <div style="display: grid; gap: 8px; margin-bottom: 16px;">
          <button class="medical-btn medical-btn-secondary medical-btn-sm" onclick="podiatristAI.sendQuickQuery('clinical guidelines')" style="text-align: left; padding: 8px 12px;">
            📋 Clinical Guidelines
          </button>
          <button class="medical-btn medical-btn-secondary medical-btn-sm" onclick="podiatristAI.sendQuickQuery('drug interactions')" style="text-align: left; padding: 8px 12px;">
            ⚠️ Drug Interactions
          </button>
          <button class="medical-btn medical-btn-secondary medical-btn-sm" onclick="podiatristAI.sendQuickQuery('treatment protocols')" style="text-align: left; padding: 8px 12px;">
            💊 Treatment Protocols
          </button>
        </div>
        
        <p style="color: #6b7280; font-size: 0.875rem; margin: 0;">
          💡 <strong>Tip:</strong> You can ask "Edit patient_1's appointment" or "Reschedule John's appointment to tomorrow 2pm"
        </p>
      </div>
    `;
    chatbox.appendChild(welcomeDiv);
    chatbox.scrollTop = chatbox.scrollHeight;
  }

  // ========================================
  // APPOINTMENT EDITING FUNCTIONALITY WITH MODAL
  // ========================================

  // START APPOINTMENT EDIT WORKFLOW - WITH MODAL
  async startAppointmentEdit() {
    const chatbox = document.getElementById('aiChatbox');
    if (!chatbox) return;
    
    this.addMessageToChat("I'd like to edit an appointment", 'user', chatbox);
    this.addMessageToChat("🔍 Loading appointment selection...", 'bot', chatbox);
    
    try {
      const response = await fetch("/get-upcoming-appointments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          podiatristId: "current_podiatrist",
          days: 30,
          limit: 20
        })
      });
      
      const result = await response.json();
      
      if (result.success && result.appointments && result.appointments.length > 0) {
        this.addMessageToChat(`📅 Found ${result.appointments.length} appointments. Opening selection window...`, 'bot', chatbox);
        
        // Show modal instead of inline list
        setTimeout(() => {
          this.showAppointmentModal(result.appointments, result.totalCount);
        }, 500);
      } else {
        this.addMessageToChat("📅 No appointments found to edit.", 'bot', chatbox);
      }
      
    } catch (error) {
      console.error("Error fetching appointments:", error);
      this.addMessageToChat("❌ Error loading appointments. Please try again.", 'bot', chatbox);
    }
  }

  // SHOW APPOINTMENT SELECTION MODAL
  showAppointmentModal(appointments, totalCount) {
    // Remove existing modal if any
    const existingModal = document.getElementById('appointmentEditModal');
    if (existingModal) {
      existingModal.remove();
    }
    
    // Create modal
    const modal = document.createElement('div');
    modal.id = 'appointmentEditModal';
    modal.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.5);
      display: flex;
      justify-content: center;
      align-items: center;
      z-index: 10000;
      animation: fadeIn 0.2s ease-out;
    `;
    
    const modalContent = document.createElement('div');
    modalContent.style.cssText = `
      background: white;
      border-radius: 12px;
      padding: 20px;
      max-width: 500px;
      max-height: 80vh;
      width: 90%;
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
      overflow-y: auto;
      animation: slideInScale 0.2s ease-out;
    `;
    
    let modalHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; border-bottom: 1px solid #e5e7eb; padding-bottom: 15px;">
        <h3 style="margin: 0; color: #1d4ed8; font-size: 1.2rem;">📅 Select Appointment to Edit</h3>
        <button onclick="podiatristAI.closeAppointmentModal()" style="
          background: none;
          border: none;
          font-size: 1.5rem;
          cursor: pointer;
          color: #6b7280;
          padding: 5px;
          border-radius: 4px;
          transition: background-color 0.2s;
        " onmouseover="this.style.backgroundColor='#f3f4f6'" onmouseout="this.style.backgroundColor='transparent'">✕</button>
      </div>
      
      <div style="margin-bottom: 15px; color: #6b7280; font-size: 0.9rem;">
        Found ${appointments.length} appointments to edit:
      </div>
    `;
    
    appointments.forEach((appointment, index) => {
      const urgencyColor = this.getUrgencyColor(appointment.urgencyLevel);
      
      modalHTML += `
        <div style="
          padding: 15px;
          margin-bottom: 10px;
          background: #f8f9fa;
          border: 1px solid #e5e7eb;
          border-left: 4px solid ${urgencyColor.main};
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.2s ease;
        " 
        onmouseover="this.style.backgroundColor='#f0f9ff'; this.style.transform='translateY(-1px)'"
        onmouseout="this.style.backgroundColor='#f8f9fa'; this.style.transform='translateY(0)'"
        onclick="podiatristAI.selectAppointmentFromModal('${appointment.patientId}', '${appointment.appointmentId}', '${appointment.patientName}', '${appointment.scheduledDateTime}')">
          
          <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px;">
            <div style="font-weight: 600; color: #374151; font-size: 1rem;">
              ${appointment.patientName}
            </div>
            <div style="font-size: 0.8rem; color: ${urgencyColor.main}; font-weight: 600; background: ${urgencyColor.border}; padding: 2px 8px; border-radius: 12px;">
              ${appointment.urgencyText}
            </div>
          </div>
          
          <div style="font-size: 0.9rem; color: #6b7280; margin-bottom: 4px;">
            📅 ${appointment.scheduledDateTime}
          </div>
          
          <div style="font-size: 0.85rem; color: #374151; margin-bottom: 8px;">
            📋 ${appointment.category} - ${appointment.initialDiagnosis}
          </div>
          
          <div style="text-align: center;">
            <span style="
              background: #3b82f6;
              color: white;
              padding: 6px 12px;
              border-radius: 6px;
              font-size: 0.8rem;
              font-weight: 500;
            ">✏️ Click to Edit This Appointment</span>
          </div>
        </div>
      `;
    });
    
    modalContent.innerHTML = modalHTML;
    modal.appendChild(modalContent);
    document.body.appendChild(modal);
    
    // Add animation styles
    const style = document.createElement('style');
    style.textContent = `
      @keyframes fadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
      }
      @keyframes slideInScale {
        from { opacity: 0; transform: translateY(-20px) scale(0.95); }
        to { opacity: 1; transform: translateY(0) scale(1); }
      }
    `;
    document.head.appendChild(style);
    
    // Close modal when clicking outside
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        this.closeAppointmentModal();
      }
    });
  }

  // SELECT APPOINTMENT FROM MODAL - ENHANCED WITH IN-MODAL EDITING
selectAppointmentFromModal(patientId, appointmentId, patientName, currentDateTime) {
  // Store selected appointment
  this.selectedAppointment = {
    patientId,
    appointmentId, 
    patientName,
    currentDateTime
  };
  
  // Transform the modal into an editing interface
  this.showAppointmentEditForm(patientId, appointmentId, patientName, currentDateTime);
}

// SHOW APPOINTMENT EDIT FORM IN MODAL
showAppointmentEditForm(patientId, appointmentId, patientName, currentDateTime) {
  const modal = document.getElementById('appointmentEditModal');
  if (!modal) return;
  
  const modalContent = modal.querySelector('div');
  
  // Replace modal content with edit form
  modalContent.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; border-bottom: 1px solid #e5e7eb; padding-bottom: 15px;">
      <h3 style="margin: 0; color: #1d4ed8; font-size: 1.2rem;">✏️ Edit Appointment</h3>
      <button onclick="podiatristAI.closeAppointmentModal()" style="
        background: none;
        border: none;
        font-size: 1.5rem;
        cursor: pointer;
        color: #6b7280;
        padding: 5px;
        border-radius: 4px;
        transition: background-color 0.2s;
      " onmouseover="this.style.backgroundColor='#f3f4f6'" onmouseout="this.style.backgroundColor='transparent'">✕</button>
    </div>
    
    <div style="margin-bottom: 20px;">
      <div style="background: #f0f9ff; padding: 15px; border-radius: 8px; border: 1px solid #bfdbfe; margin-bottom: 20px;">
        <h4 style="margin: 0 0 10px 0; color: #1d4ed8;">📋 Current Appointment</h4>
        <div style="font-size: 0.9rem; color: #374151;">
          <div><strong>Patient:</strong> ${patientName}</div>
          <div><strong>Current Date/Time:</strong> ${currentDateTime}</div>
        </div>
      </div>
      
      <div style="background: #fefdf8; padding: 20px; border-radius: 8px; border: 1px solid #e5e7eb;">
        <h4 style="margin: 0 0 15px 0; color: #374151;">📅 New Date & Time</h4>
        
        <div style="margin-bottom: 15px;">
          <label style="display: block; margin-bottom: 5px; font-weight: 600; color: #374151;">Date:</label>
          <input type="date" id="newAppointmentDate" style="
            width: 100%;
            padding: 10px;
            border: 1px solid #d1d5db;
            border-radius: 6px;
            font-size: 1rem;
          " min="${new Date().toISOString().split('T')[0]}">
        </div>
        
        <div style="margin-bottom: 20px;">
          <label style="display: block; margin-bottom: 5px; font-weight: 600; color: #374151;">Time:</label>
          <select id="newAppointmentTime" style="
            width: 100%;
            padding: 10px;
            border: 1px solid #d1d5db;
            border-radius: 6px;
            font-size: 1rem;
          ">
            <option value="">Select time</option>
            <option value="08:00">8:00 AM</option>
            <option value="08:30">8:30 AM</option>
            <option value="09:00">9:00 AM</option>
            <option value="09:30">9:30 AM</option>
            <option value="10:00">10:00 AM</option>
            <option value="10:30">10:30 AM</option>
            <option value="11:00">11:00 AM</option>
            <option value="11:30">11:30 AM</option>
            <option value="12:00">12:00 PM</option>
            <option value="12:30">12:30 PM</option>
            <option value="13:00">1:00 PM</option>
            <option value="13:30">1:30 PM</option>
            <option value="14:00">2:00 PM</option>
            <option value="14:30">2:30 PM</option>
            <option value="15:00">3:00 PM</option>
            <option value="15:30">3:30 PM</option>
            <option value="16:00">4:00 PM</option>
            <option value="16:30">4:30 PM</option>
            <option value="17:00">5:00 PM</option>
          </select>
        </div>
        
        <div style="display: flex; gap: 10px; justify-content: flex-end;">
          <button onclick="podiatristAI.closeAppointmentModal()" style="
            background: #6b7280;
            color: white;
            border: none;
            padding: 10px 20px;
            border-radius: 6px;
            cursor: pointer;
            font-size: 0.9rem;
            transition: background-color 0.2s;
          " onmouseover="this.style.backgroundColor='#4b5563'" onmouseout="this.style.backgroundColor='#6b7280'">
            Cancel
          </button>
          <button onclick="podiatristAI.submitAppointmentEdit('${patientId}', '${appointmentId}', '${patientName}')" style="
            background: #3b82f6;
            color: white;
            border: none;
            padding: 10px 20px;
            border-radius: 6px;
            cursor: pointer;
            font-size: 0.9rem;
            transition: background-color 0.2s;
          " onmouseover="this.style.backgroundColor='#2563eb'" onmouseout="this.style.backgroundColor='#3b82f6'">
            ✅ Update Appointment
          </button>
        </div>
      </div>
    </div>
  `;
}

// SUBMIT APPOINTMENT EDIT FROM MODAL - FIXED VERSION
async submitAppointmentEdit(patientId, appointmentId, patientName) {
  const dateInput = document.getElementById('newAppointmentDate');
  const timeInput = document.getElementById('newAppointmentTime');
  
  if (!dateInput || !timeInput) {
    alert('Error: Could not find date/time inputs');
    return;
  }
  
  const newDate = dateInput.value;
  const newTime = timeInput.value;
  
  if (!newDate || !newTime) {
    alert('Please select both date and time');
    return;
  }
  
  // Combine date and time
  const newDateTime = `${newDate} ${newTime}`;
  
  try {
    // Show loading in modal
    const modal = document.getElementById('appointmentEditModal');
    const originalContent = modal.innerHTML;
    
    modal.querySelector('div').innerHTML = `
      <div style="text-align: center; padding: 40px;">
        <div style="font-size: 1.2rem; color: #1d4ed8; margin-bottom: 10px;">⏳ Updating Appointment...</div>
        <div style="color: #6b7280;">Please wait while we process your changes.</div>
      </div>
    `;
    
    // Send edit request to server
    const response = await fetch("/edit-appointment", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        patientId: patientId,
        appointmentId: appointmentId,
        newDateTime: newDateTime,
        podiatristId: "current_podiatrist"
      })
    });
    
    const result = await response.json();
    
    if (result.success) {
      // Show success message
      modal.querySelector('div').innerHTML = `
        <div style="text-align: center; padding: 40px;">
          <div style="font-size: 3rem; margin-bottom: 15px;">✅</div>
          <h3 style="color: #059669; margin-bottom: 15px;">Appointment Updated Successfully!</h3>
          <div style="background: #f0fdf4; padding: 15px; border-radius: 8px; margin-bottom: 20px; text-align: left;">
            <div><strong>Patient:</strong> ${result.patientName || patientName}</div>
            <div><strong>New Date & Time:</strong> ${result.newDateTime || newDateTime}</div>
            ${result.oldDateTime ? `<div><strong>Previous:</strong> ${result.oldDateTime}</div>` : ''}
          </div>
          <div style="color: #6b7280; font-size: 0.9rem; margin-bottom: 15px;">
            📊 Updating patient queue and calendar...
          </div>
          <button onclick="podiatristAI.closeAppointmentModal()" style="
            background: #3b82f6;
            color: white;
            border: none;
            padding: 10px 30px;
            border-radius: 6px;
            cursor: pointer;
            font-size: 1rem;
          ">Close</button>
        </div>
      `;
      
      // Add success message to AI chat
      const chatbox = document.getElementById('aiChatbox');
      if (chatbox) {
        this.addMessageToChat(`✅ **Appointment Updated**: ${patientName}'s appointment has been successfully rescheduled to ${result.newDateTime || newDateTime}`, 'bot', chatbox);
      }
      
      // ✨ FIXED: REAL-TIME UPDATES - Refresh patient queue and calendar
      setTimeout(async () => {
        try {
          console.log('🔄 Starting real-time updates after appointment edit...');
          
          // 1. Refresh patient queue
          if (typeof window.refreshPatientQueue === 'function') {
            console.log('🔄 Refreshing patient queue...');
            await window.refreshPatientQueue();
            console.log('✅ Patient queue refreshed');
          } else {
            console.warn('⚠️ Patient queue refresh function not available');
          }
          
          // 2. FIXED: Refresh calendar view properly
          if (typeof window.refreshCalendarView === 'function') {
            console.log('🔄 Refreshing calendar view...');
            await window.refreshCalendarView();
            console.log('✅ Calendar view refreshed');
          } else if (window.podiatristCalendar && typeof window.podiatristCalendar.refreshCalendar === 'function') {
            console.log('🔄 Refreshing calendar directly...');
            await window.podiatristCalendar.refreshCalendar();
            console.log('✅ Calendar refreshed directly');
          } else {
            console.warn('⚠️ Calendar refresh function not available');
          }
          
          // 3. Show update notification
          if (typeof window.showUpdateNotification === 'function') {
            window.showUpdateNotification('Calendar and queue updated with latest appointment changes');
          }
          
          console.log('✅ All real-time updates completed successfully');
        } catch (error) {
          console.error('❌ Error during real-time update:', error);
        }
      }, 1000); // 1 second delay to allow success message to show
      
    } else {
      // Show error message
      modal.querySelector('div').innerHTML = `
        <div style="text-align: center; padding: 40px;">
          <div style="font-size: 3rem; margin-bottom: 15px;">❌</div>
          <h3 style="color: #dc2626; margin-bottom: 15px;">Update Failed</h3>
          <div style="background: #fef2f2; padding: 15px; border-radius: 8px; margin-bottom: 20px; color: #dc2626;">
            ${result.message || 'Unable to update appointment. Please try again.'}
          </div>
          <div style="display: flex; gap: 10px; justify-content: center;">
            <button onclick="podiatristAI.showAppointmentEditForm('${patientId}', '${appointmentId}', '${patientName}', '${this.selectedAppointment.currentDateTime}')" style="
              background: #6b7280;
              color: white;
              border: none;
              padding: 10px 20px;
              border-radius: 6px;
              cursor: pointer;
            ">Try Again</button>
            <button onclick="podiatristAI.closeAppointmentModal()" style="
              background: #3b82f6;
              color: white;
              border: none;
              padding: 10px 20px;
              border-radius: 6px;
              cursor: pointer;
            ">Close</button>
          </div>
        </div>
      `;
    }
    
  } catch (error) {
    console.error("Edit appointment error:", error);
    alert('Error updating appointment. Please try again.');
  }
}

  // CLOSE APPOINTMENT MODAL
  closeAppointmentModal() {
    const modal = document.getElementById('appointmentEditModal');
    if (modal) {
      modal.style.animation = 'fadeOut 0.2s ease-out';
      setTimeout(() => {
        modal.remove();
      }, 200);
    }
  }

  // GET URGENCY COLORS
  getUrgencyColor(urgencyLevel) {
    switch (urgencyLevel) {
      case 1: return { main: '#ef4444', border: '#fecaca' }; // Red
      case 2: return { main: '#f59e0b', border: '#fed7aa' }; // Orange  
      case 3: return { main: '#3b82f6', border: '#bfdbfe' }; // Blue
      case 4: return { main: '#6b7280', border: '#e5e7eb' }; // Gray
      default: return { main: '#6b7280', border: '#e5e7eb' };
    }
  }

  // DETECT EDIT/RESCHEDULE REQUESTS
  detectEditRequest(message) {
    const lowerMessage = message.toLowerCase();
    const editKeywords = ['edit', 'reschedule', 'change', 'move', 'update'];
    const timeKeywords = ['appointment', 'time', 'date', 'schedule'];
    
    const hasEditKeyword = editKeywords.some(keyword => lowerMessage.includes(keyword));
    const hasTimeKeyword = timeKeywords.some(keyword => lowerMessage.includes(keyword));
    
    return hasEditKeyword && hasTimeKeyword;
  }

  // PARSE EDIT REQUEST
  parseEditRequest(message) {
    // Extract patient ID
    const patientMatch = message.match(/patient[_\s]*(\d+)|(\w+\s+\w+)'s?\s+appointment/i);
    let patientId = null;
    
    if (patientMatch) {
      if (patientMatch[1]) {
        patientId = `patient_${patientMatch[1]}`;
      } else if (patientMatch[2]) {
        // Try to find patient by name
        patientId = this.findPatientByName(patientMatch[2]);
      }
    }
    
    // Extract new date/time
    const dateTimeMatch = message.match(/(\d{1,2}[:\.]?\d{0,2}\s*(am|pm)?|\d{1,2}\/\d{1,2}\/?\d{0,4}|tomorrow|today|monday|tuesday|wednesday|thursday|friday)/i);
    const newDateTime = dateTimeMatch ? dateTimeMatch[0] : null;
    
    return { patientId, newDateTime };
  }

  // FIND PATIENT BY NAME (helper function)
  findPatientByName(name) {
    // This would search through the patient queue to find matching name
    // For now, return null - implement based on your patient data structure
    return null;
  }

  // PROCESS APPOINTMENT EDIT
  async processAppointmentEdit(patientId, newDateTime, originalMessage) {
    const chatbox = document.getElementById('aiChatbox');
    if (!chatbox) return;
    
    try {
      // Show processing message
      const loadingDiv = this.addLoadingIndicator(chatbox);
      this.updateLoadingMessage(loadingDiv, 'Processing appointment edit...');
      
      // Use selected appointment data if available
      const appointmentData = this.selectedAppointment || { patientId };
      
      // Send edit request to server
      const response = await fetch("/edit-appointment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patientId: appointmentData.patientId,
          appointmentId: appointmentData.appointmentId,
          newDateTime: newDateTime,
          podiatristId: "current_podiatrist"
        })
      });
      
      const result = await response.json();
      this.removeLoadingIndicator(loadingDiv);
      
      if (result.success) {
        this.addMessageToChat(`✅ **Appointment Updated Successfully**<br><br>**Patient:** ${result.patientName}<br>**New Date & Time:** ${result.newDateTime}<br>**Previous:** ${result.oldDateTime}<br><br>The patient will be notified of this change.`, 'bot', chatbox);
        
        // Clear selected appointment
        this.selectedAppointment = null;
      } else {
        this.addMessageToChat(`❌ **Unable to update appointment**<br><br>${result.message}`, 'bot', chatbox);
      }
      
    } catch (error) {
      console.error("Edit appointment error:", error);
      this.removeLoadingIndicator(loadingDiv);
      this.addMessageToChat("❌ Error processing appointment edit. Please try again.", 'bot', chatbox);
    }
  }

  // PATIENT ID PREPROCESSING
  preprocessPatientQuery(message) {
    let processedMessage = message;
    
    const patientIdPatterns = [
      /\b(patient_\d+)\b/gi,
      /\bpatient\s+(\d+)\b/gi,
      /\b(p\d+)\b/gi,
      /\b(pt\d+)\b/gi
    ];
    
    const foundPatientIds = [];
    
    patientIdPatterns.forEach((pattern, index) => {
      const matches = [...processedMessage.matchAll(pattern)];
      
      matches.forEach(match => {
        if (index === 0) {
          foundPatientIds.push(match[1]);
        } else if (index === 1) {
          const id = match[1];
          foundPatientIds.push(`patient_${id}`);
        } else {
          foundPatientIds.push(match[1]);
        }
      });
    });
    
    const uniquePatientIds = [...new Set(foundPatientIds)];
    
    if (uniquePatientIds.length > 0) {
      uniquePatientIds.forEach(patientId => {
        if (/^(patient_\d+|p\d+|pt\d+)$/i.test(patientId)) {
          const regex = new RegExp(`\\b${patientId.replace('_', '_')}\\b(?!\\s*:)`, 'gi');
          processedMessage = processedMessage.replace(regex, `Patient ${patientId}`);
        }
      });
    }
    
    processedMessage = processedMessage.replace(/\bPatient\s+Patient\s+/gi, 'Patient ');
    
    return processedMessage;
  }

  // ========================================
  // ENHANCED sendMessage function with APPOINTMENT EDITING
  // ========================================
  async sendMessage(message) {
    const chatbox = document.getElementById('aiChatbox');
    
    if (!chatbox) {
      console.error('❌ Floating chatbox not available');
      return;
    }

    if (!message || !message.trim()) {
      console.warn('⚠️ Empty message');
      return;
    }

    // Preprocess message
    const processedMessage = this.preprocessPatientQuery(message);

    // Add user message
    this.addMessageToChat(message, 'user', chatbox);
    
    // INSTANT FEEDBACK - Add thinking indicator
    const thinkingDiv = this.addLoadingIndicator(chatbox);
    this.updateLoadingMessage(thinkingDiv, 'AI is thinking...');

    try {
      // CHECK FOR EDIT/RESCHEDULE REQUESTS FIRST
      if (this.detectEditRequest(processedMessage)) {
        console.log('📝 Detected edit/reschedule request');
        
        const editInfo = this.parseEditRequest(processedMessage);
        
        this.removeLoadingIndicator(thinkingDiv);
        
        if (editInfo.patientId && editInfo.newDateTime) {
          await this.processAppointmentEdit(editInfo.patientId, editInfo.newDateTime, processedMessage);
          return;
        } else if (editInfo.newDateTime && this.selectedAppointment) {
          // If we have a selected appointment and new time, process the edit
          await this.processAppointmentEdit(this.selectedAppointment.patientId, editInfo.newDateTime, processedMessage);
          return;
        } else if (editInfo.patientId) {
          this.addMessageToChat(`I found the patient. What's the new date and time for ${editInfo.patientId}'s appointment?<br><br>You can say something like:<br>• "Change to tomorrow 2pm"<br>• "Move to July 5th 10am"<br>• "Reschedule to next Friday 3pm"`, 'bot', chatbox);
          return;
        } else if (this.selectedAppointment) {
          this.addMessageToChat(`What's the new date and time for ${this.selectedAppointment.patientName}'s appointment?<br><br>You can say something like:<br>• "Change to tomorrow 2pm"<br>• "Move to July 5th 10am"<br>• "Reschedule to next Friday 3pm"`, 'bot', chatbox);
          return;
        } else {
          this.addMessageToChat("Which patient's appointment would you like to edit? Please specify the patient ID or name.", 'bot', chatbox);
          return;
        }
      }

      // CHECK FOR DATE-SPECIFIC SCHEDULE QUERIES
      const scheduleQuery = this.detectScheduleQuery(processedMessage);
      
      if (scheduleQuery.isScheduleQuery) {
        console.log('📅 Detected schedule query for date:', scheduleQuery.targetDate);
        
        // Update loading message
        this.updateLoadingMessage(thinkingDiv, 'Fetching schedule data...');
        
        // Fetch schedule for specific date
        const scheduleResponse = await fetch("/get-schedule-by-date", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ 
            podiatristId: "current_podiatrist",
            targetDate: scheduleQuery.targetDate
          })
        });
        
        const scheduleResult = await scheduleResponse.json();
        
        // Remove loading indicator
        this.removeLoadingIndicator(thinkingDiv);
        
        if (scheduleResult.success) {
          // DIRECT HANDLING OF EMPTY SCHEDULE - NO AI PROCESSING
          if (scheduleResult.isEmpty || !scheduleResult.appointments || scheduleResult.appointments.length === 0) {
            console.log('📅 Empty schedule detected - sending direct response');
            const directMessage = `📅 **${scheduleResult.date}**: No appointments scheduled for this date.`;
            this.addMessageToChat(directMessage, 'bot', chatbox);
            return;
          }
          
          // If there ARE appointments, process normally with AI
          if (scheduleResult.appointments && scheduleResult.appointments.length > 0) {
            // Create AI prompt with schedule data
            const schedulePrompt = `Here's the appointment schedule for ${scheduleResult.date}:

**${scheduleResult.date}**
**Total Appointments: ${scheduleResult.totalCount}**

**Scheduled Appointments:**
${scheduleResult.appointments.map((apt, index) => `
${index + 1}. **${apt.scheduledTime}** - ${apt.patientName} (${apt.patientId})
   - Category: ${apt.category}
   - Priority: ${apt.urgencyText}
   - Initial Diagnosis: ${apt.initialDiagnosis}
   - Contact: ${apt.patientPhone}
   - Summary: ${apt.summary}
`).join('')}

Please provide a comprehensive overview including workload analysis, priority cases, and clinical recommendations.`;

            // Get AI analysis
            const aiResponse = await fetch("/podiatrist-chat", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ 
                message: schedulePrompt,
                podiatristId: "current_podiatrist"
              })
            });

            const aiData = await aiResponse.json();
            this.addMessageToChat(aiData.reply, 'bot', chatbox);
            
            // Add schedule cards
            this.addScheduleCards(scheduleResult.appointments, chatbox);
          }
        } else {
          this.addMessageToChat("❌ Unable to fetch schedule for the requested date. Please try again.", 'bot', chatbox);
        }
        
        return;
      }

      // REGULAR AI CHAT (no schedule query detected)
      const response = await fetch("/podiatrist-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          message: processedMessage,
          podiatristId: "current_podiatrist"
        })
      });

      const data = await response.json();
      
      // Remove thinking indicator
      this.removeLoadingIndicator(thinkingDiv);
      
      // Add AI response
      this.addMessageToChat(data.reply, 'bot', chatbox);
      
      // If patient data found, show quick actions
      if (data.patientData) {
        this.addPatientQuickActions(data.patientData.name || 'Unknown', chatbox);
      }

    } catch (error) {
      console.error("AI chat error:", error);
      this.removeLoadingIndicator(thinkingDiv);
      this.addMessageToChat("I'm currently unable to connect. Please try again.", 'bot', chatbox);
    }
  }

// FIXED detectScheduleQuery function
detectScheduleQuery(message) {
  console.log('🔍 TIMEZONE-FIXED detectScheduleQuery called with:', message);
  
  const lowerMessage = message.toLowerCase();
  
  // Common schedule-related keywords
  const scheduleKeywords = [
    'schedule', 'appointments', 'calendar', 'agenda', 
    'what\'s on', 'what do i have', 'any appointments',
    'my day', 'tomorrow', 'yesterday', 'monday', 'tuesday',
    'wednesday', 'thursday', 'friday', 'saturday', 'sunday',
    'july', 'august', 'september', 'october', 'november', 'december',
    'january', 'february', 'march', 'april', 'may', 'june'
  ];
  
  // Check if message contains schedule keywords OR date patterns
  const isScheduleQuery = scheduleKeywords.some(keyword => 
    lowerMessage.includes(keyword)
  ) || /\d+[\/-]\d+[\/-]?\d*/.test(message) || /\d+(st|nd|rd|th)?\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i.test(message);
  
  if (!isScheduleQuery) {
    console.log('❌ Not a schedule query');
    return { isScheduleQuery: false, targetDate: null };
  }
  
  console.log('✅ Schedule query detected, parsing date from:', message);
  
  let targetDate = 'today'; // default
  
  // TIMEZONE-SAFE DATE CREATION FUNCTION
  function createTimezoneSafeDate(year, monthIndex, day) {
    // Create date string manually to avoid timezone issues
    const monthStr = (monthIndex + 1).toString().padStart(2, '0');
    const dayStr = day.toString().padStart(2, '0');
    const dateString = `${year}-${monthStr}-${dayStr}`;
    console.log('🕐 Creating timezone-safe date:', dateString);
    return dateString;
  }
  
  // 1. "1st July 2025", "2nd August 2025" with YEAR - HIGHEST PRIORITY
  const dayMonthYearPattern = /(\d{1,2})(st|nd|rd|th)?\s+(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{4})/i;
  const dayMonthYearMatch = message.match(dayMonthYearPattern);
  
  if (dayMonthYearMatch) {
    const day = parseInt(dayMonthYearMatch[1]);
    const monthName = dayMonthYearMatch[3].toLowerCase();
    const year = parseInt(dayMonthYearMatch[4]);
    
    const monthNames = ['january', 'february', 'march', 'april', 'may', 'june', 
                       'july', 'august', 'september', 'october', 'november', 'december'];
    const monthIndex = monthNames.indexOf(monthName);
    
    if (monthIndex !== -1) {
      targetDate = createTimezoneSafeDate(year, monthIndex, day);
      return { isScheduleQuery: true, targetDate };
    }
  }
  
  // 2. "July 1st 2025", "August 2nd 2025" with YEAR
  const monthDayYearPattern = /(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{1,2})(st|nd|rd|th)?\s+(\d{4})/i;
  const monthDayYearMatch = message.match(monthDayYearPattern);
  
  if (monthDayYearMatch) {
    const monthName = monthDayYearMatch[1].toLowerCase();
    const day = parseInt(monthDayYearMatch[2]);
    const year = parseInt(monthDayYearMatch[4]);
    
    const monthNames = ['january', 'february', 'march', 'april', 'may', 'june', 
                       'july', 'august', 'september', 'october', 'november', 'december'];
    const monthIndex = monthNames.indexOf(monthName);
    
    if (monthIndex !== -1) {
      targetDate = createTimezoneSafeDate(year, monthIndex, day);
      return { isScheduleQuery: true, targetDate };
    }
  }
  
  // 3. "today", "tomorrow", "yesterday"
  if (lowerMessage.includes('today')) {
    targetDate = 'today';
    return { isScheduleQuery: true, targetDate };
  } else if (lowerMessage.includes('tomorrow')) {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const year = tomorrow.getFullYear();
    const month = tomorrow.getMonth();
    const day = tomorrow.getDate();
    targetDate = createTimezoneSafeDate(year, month, day);
    return { isScheduleQuery: true, targetDate };
  } else if (lowerMessage.includes('yesterday')) {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const year = yesterday.getFullYear();
    const month = yesterday.getMonth();
    const day = yesterday.getDate();
    targetDate = createTimezoneSafeDate(year, month, day);
    return { isScheduleQuery: true, targetDate };
  }
  
  // Fallback
  return { isScheduleQuery: true, targetDate: 'today' };
}

  // ========================================
  // ENHANCED QUICK QUERY
  // ========================================
  async sendQuickQuery(query, specificDate = null) {
    console.log('🔍 Quick query triggered:', query, 'for date:', specificDate);
    
    const chatbox = document.getElementById('aiChatbox');
    if (!chatbox) {
      console.error('❌ Floating chatbox not available for quick query');
      return;
    }
    
    // Add user message
    const displayMessage = specificDate ? 
      `Quick query: ${query} for ${specificDate}` : 
      `Quick query: ${query}`;
    this.addMessageToChat(displayMessage, 'user', chatbox);
    
    // INSTANT FEEDBACK - Show loading immediately
    const loadingDiv = this.addLoadingIndicator(chatbox);
    
    try {
      let prompt = '';
      let needsDatabase = false;
      let scheduleData = null;
      
      // Handle different query types
      switch(query) {
        case 'today schedule':
        case 'schedule':
          needsDatabase = true;
          
          try {
            const scheduleResponse = await fetch("/get-schedule-by-date", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ 
                podiatristId: "current_podiatrist",
                targetDate: specificDate || 'today'
              })
            });
            
            const scheduleResult = await scheduleResponse.json();
            
            if (scheduleResult.success && (scheduleResult.isEmpty || !scheduleResult.appointments || scheduleResult.appointments.length === 0)) {
              this.removeLoadingIndicator(loadingDiv);
              const directMessage = `📅 **${scheduleResult.date}**: No appointments scheduled for this date.`;
              this.addMessageToChat(directMessage, 'bot', chatbox);
              return;
            }
            
            if (scheduleResult.success && scheduleResult.appointments && scheduleResult.appointments.length > 0) {
              scheduleData = scheduleResult;
              prompt = `Based on the appointment schedule for ${scheduleResult.date}, provide a comprehensive overview. Here's the data:

**${scheduleResult.date}**
**Total Appointments: ${scheduleResult.totalCount}**

**Scheduled Appointments:**
${scheduleResult.appointments.map((apt, index) => `
${index + 1}. **${apt.scheduledTime}** - ${apt.patientName} (${apt.patientId})
   - Category: ${apt.category}
   - Priority: ${apt.urgencyText}
   - Initial Diagnosis: ${apt.initialDiagnosis}
   - Contact: ${apt.patientPhone}
   - Summary: ${apt.summary}
`).join('')}

Please provide:
1. A summary of the workload and patient priorities
2. Any urgent cases that need immediate attention
3. Recommendations for managing the schedule efficiently
4. Patient preparation reminders for high-priority cases

Focus on clinical priorities and workflow optimization.`;
            }
          } catch (fetchError) {
            prompt = 'Unable to fetch the schedule from the system. Please provide general guidance for managing daily clinical workflow.';
          }
          break;
          
        case 'urgent cases':
          needsDatabase = true;
          
          try {
            const urgentResponse = await fetch("/get-urgent-cases", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ 
                podiatristId: "current_podiatrist"
              })
            });
            
            const urgentResult = await urgentResponse.json();
            
            if (urgentResult.success && urgentResult.urgentCases && urgentResult.urgentCases.length > 0) {
              scheduleData = { appointments: urgentResult.urgentCases };
              
              prompt = `Here are today's urgent cases requiring immediate attention:

**URGENT CASES (${urgentResult.urgentCases.length} total):**
${urgentResult.urgentCases.map((apt, index) => `
${index + 1}. **${apt.scheduledTime}** - ${apt.patientName}
   - Priority: ${apt.urgencyText}
   - Diagnosis: ${apt.initialDiagnosis}
   - Summary: ${apt.summary}
   - Contact: ${apt.patientPhone}
`).join('')}

Please provide clinical assessment and immediate care protocols.`;
            } else {
              prompt = 'No urgent cases are scheduled for today. Provide guidance on maintaining clinical readiness.';
            }
          } catch (fetchError) {
            prompt = 'Unable to access urgent case data. Please provide general protocols for urgent podiatric conditions.';
          }
          break;
          
        case 'patient summaries':
          needsDatabase = true;
          
          try {
            const summariesResponse = await fetch("/get-recent-summaries", {
              method: "POST", 
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ 
                podiatristId: "current_podiatrist"
              })
            });
            
            const summariesResult = await summariesResponse.json();
            
            if (summariesResult.success && summariesResult.summaries && summariesResult.summaries.length > 0) {
              scheduleData = { appointments: summariesResult.summaries };
              
              prompt = `Based on the actual patient data from our database, provide a well-structured summary of recent patient interactions:

**REAL PATIENT DATA FROM DATABASE:**
${summariesResult.summaries.map((summary, index) => `
${index + 1}. Patient ID: ${summary.patientId} - Name: ${summary.patientName}
   - Triage Date: ${summary.triageDate}
   - Category: ${summary.category} (Urgency Level: ${summary.urgencyLevel})
   - Initial Diagnosis: ${summary.initialDiagnosis}
   - Clinical Summary: ${summary.summary}
   - Current Status: ${summary.status}
   - Contact: ${summary.patientPhone}
`).join('')}

Please provide a clinical analysis covering current case load summary, priority assessment, follow-up requirements, and clinical recommendations.`;
            } else {
              prompt = 'No recent patient summaries available in the database.';
            }
          } catch (fetchError) {
            prompt = 'Unable to access patient summary data from the database.';
          }
          break;
          
        case 'clinical guidelines':
          prompt = 'What are the latest clinical guidelines for podiatry care, particularly for wound management and diabetic foot care?';
          break;
          
        case 'drug interactions':
          prompt = 'What are important drug interactions for treating foot conditions, especially for diabetic and elderly patients?';
          break;
          
        case 'treatment protocols':
          prompt = 'Provide current treatment protocols for common podiatric conditions.';
          break;
          
        case 'reschedule help':
          prompt = 'What factors should I consider when rescheduling patient appointments? Provide guidance on managing appointment changes effectively.';
          break;
          
        default:
          prompt = query;
          break;
      }
      
      // Update loading message to show AI is thinking
      this.updateLoadingMessage(loadingDiv, 'AI is analyzing your request...');
      
      // Send the prompt to the AI
      const response = await fetch("/podiatrist-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          message: prompt,
          podiatristId: "current_podiatrist",
          queryType: query
        })
      });
      
      const data = await response.json();
      
      // Remove loading indicator
      this.removeLoadingIndicator(loadingDiv);
      
      // Display the AI response
      this.addMessageToChat(data.reply, 'bot', chatbox);
      
      // Add schedule cards if we have appointment data
      if (scheduleData && scheduleData.appointments && scheduleData.appointments.length > 0) {
        this.addScheduleCards(scheduleData.appointments, chatbox);
      }
      
      // Add follow-up actions
      if (needsDatabase) {
        this.addFollowUpActions(query, chatbox);
      }

    } catch (error) {
      console.error("Quick query error:", error);
      this.removeLoadingIndicator(loadingDiv);
      this.addMessageToChat("Error processing your request. Please try again.", 'bot', chatbox);
    }
  }

  // LOADING INDICATOR FUNCTIONS
  addLoadingIndicator(chatbox) {
    const loadingDiv = document.createElement('div');
    loadingDiv.className = 'message-bot loading-indicator';
    loadingDiv.innerHTML = `
      <strong>Clinical Assistant:</strong><br>
      <div style="display: flex; align-items: center; gap: 8px; padding: 8px 0;">
        <div class="loading-spinner"></div>
        <span id="loading-text">Processing request...</span>
      </div>
    `;
    
    chatbox.appendChild(loadingDiv);
    chatbox.scrollTop = chatbox.scrollHeight;
    
    return loadingDiv;
  }

  updateLoadingMessage(loadingDiv, newMessage) {
    const textSpan = loadingDiv.querySelector('#loading-text');
    if (textSpan) {
      textSpan.textContent = newMessage;
    }
  }

  removeLoadingIndicator(indicator) {
    if (indicator && indicator.parentNode) {
      indicator.parentNode.removeChild(indicator);
    }
  }

  // SEND MESSAGE FROM FLOATING CHAT
  async sendFloatingMessage() {
    const input = document.getElementById('aiMessage');
    if (!input) return;
    
    const message = input.value.trim();
    input.value = '';
    
    await this.sendMessage(message);
  }

  // ADD SCHEDULE CARDS
  addScheduleCards(appointments, chatbox) {
    const cardsDiv = document.createElement('div');
    cardsDiv.className = 'schedule-cards-container';
    cardsDiv.style.cssText = `
      margin: 16px 0;
      display: grid;
      gap: 12px;
      max-height: 400px;
      overflow-y: auto;
    `;
    
    cardsDiv.innerHTML = `
      <h4 style="color: #1d4ed8; margin: 0 0 12px 0; font-size: 1rem;">📅 Appointments (${appointments.length})</h4>
    `;
    
    appointments.forEach((appointment, index) => {
      const cardDiv = document.createElement('div');
      cardDiv.className = 'appointment-card';
      
      let cardColor = '#f8f9fa';
      let borderColor = '#e5e7eb';
      
      if (appointment.urgencyLevel === 1) {
        cardColor = '#fef2f2';
        borderColor = '#fecaca';
      } else if (appointment.urgencyLevel === 2) {
        cardColor = '#fffbeb';
        borderColor = '#fed7aa';
      } else if (appointment.urgencyLevel === 3) {
        cardColor = '#f0f9ff';
        borderColor = '#bfdbfe';
      }
      
      cardDiv.style.cssText = `
        padding: 12px;
        background: ${cardColor};
        border: 1px solid ${borderColor};
        border-radius: 8px;
        margin-bottom: 8px;
      `;
      
      cardDiv.innerHTML = `
        <div style="font-weight: 600; color: #374151; margin-bottom: 4px;">
          ⏰ ${appointment.scheduledTime || 'TBD'} - ${appointment.patientName}
        </div>
        <div style="font-size: 0.875rem; color: #6b7280; margin-bottom: 4px;">
          ${appointment.urgencyText} | ${appointment.category}
        </div>
        <div style="font-size: 0.875rem; color: #374151; margin-bottom: 8px;">
          📋 ${appointment.initialDiagnosis}
        </div>
        
        <div style="display: flex; gap: 8px; flex-wrap: wrap;">
          <button class="medical-btn medical-btn-primary medical-btn-sm" onclick="podiatristAI.querySpecificPatient('${appointment.patientId}', 'detailed appointment preparation')">
            👁️ View Details
          </button>
          <button class="medical-btn medical-btn-secondary medical-btn-sm" onclick="podiatristAI.querySpecificPatient('${appointment.patientId}', 'current condition updates')">
            📝 Care Notes
          </button>
          <button class="medical-btn medical-btn-secondary medical-btn-sm" onclick="podiatristAI.showPatientContact('${appointment.patientName}', '${appointment.patientPhone}', '${appointment.patientEmail}')">
            📞 Contact
          </button>
        </div>
      `;
      
      cardsDiv.appendChild(cardDiv);
    });
    
    chatbox.appendChild(cardsDiv);
    chatbox.scrollTop = chatbox.scrollHeight;
  }

  // PATIENT CONTACT INFO
  showPatientContact(patientName, phone, email) {
    const chatbox = document.getElementById('aiChatbox');
    if (!chatbox) return;
    
    const contactDiv = document.createElement('div');
    contactDiv.className = 'patient-contact-info';
    contactDiv.style.cssText = `
      margin: 16px 0;
      padding: 16px;
      background: #f0f9ff;
      border-radius: 12px;
      border: 1px solid #bfdbfe;
    `;
    
    contactDiv.innerHTML = `
      <h4 style="color: #1d4ed8; margin: 0 0 12px 0; font-size: 1rem;">📞 Contact Information</h4>
      <div style="margin-bottom: 8px;"><strong>Patient:</strong> ${patientName}</div>
      <div style="margin-bottom: 8px;"><strong>Phone:</strong> <a href="tel:${phone}" style="color: #1d4ed8;">${phone}</a></div>
      <div style="margin-bottom: 12px;"><strong>Email:</strong> <a href="mailto:${email}" style="color: #1d4ed8;">${email}</a></div>
    `;
    
    chatbox.appendChild(contactDiv);
    chatbox.scrollTop = chatbox.scrollHeight;
  }

  // ADD FOLLOW-UP ACTIONS
  addFollowUpActions(queryType, chatbox) {
    const actionsDiv = document.createElement('div');
    actionsDiv.className = 'query-follow-up-actions';
    actionsDiv.style.cssText = `
      margin: 16px 0;
      padding: 16px;
      background: #f8f9fa;
      border-radius: 12px;
      border: 1px solid #e5e7eb;
    `;
    
    let actionsHTML = '';
    
    switch(queryType) {
      case 'today schedule':
      case 'schedule':
        actionsHTML = `
          <p style="font-weight: 600; margin-bottom: 12px; color: #374151;">📅 Schedule Actions:</p>
          <div style="display: flex; gap: 8px; flex-wrap: wrap;">
            <button class="medical-btn medical-btn-secondary medical-btn-sm" onclick="podiatristAI.sendQuickQuery('urgent cases')">
              🚨 View Urgent Cases
            </button>
            <button class="medical-btn medical-btn-secondary medical-btn-sm" onclick="podiatristAI.startAppointmentEdit()">
              ✏️ Edit Appointment
            </button>
          </div>
        `;
        break;
        
      case 'urgent cases':
        actionsHTML = `
          <p style="font-weight: 600; margin-bottom: 12px; color: #374151;">🚨 Urgent Case Actions:</p>
          <div style="display: flex; gap: 8px; flex-wrap: wrap;">
            <button class="medical-btn medical-btn-secondary medical-btn-sm" onclick="podiatristAI.querySpecificPatient('patient_1', 'risk assessment')">
              🩹 Risk Assessment
            </button>
            <button class="medical-btn medical-btn-secondary medical-btn-sm" onclick="podiatristAI.sendQuickQuery('treatment protocols')">
              💊 Treatment Protocols
            </button>
          </div>
        `;
        break;
    }
    
    if (actionsHTML) {
      actionsDiv.innerHTML = actionsHTML;
      chatbox.appendChild(actionsDiv);
      chatbox.scrollTop = chatbox.scrollHeight;
    }
  }

  // PATIENT-SPECIFIC QUERIES
  async querySpecificPatient(patientId, question) {
    const chatbox = document.getElementById('aiChatbox');
    if (!chatbox) return;
    
    this.addMessageToChat(`Tell me about Patient ${patientId}: ${question}`, 'user', chatbox);
    
    try {
      const response = await fetch("/podiatrist-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          message: `Tell me about Patient ${patientId}: ${question}`,
          podiatristId: "current_podiatrist"
        })
      });

      const data = await response.json();
      this.addMessageToChat(data.reply, 'bot', chatbox);
      
      if (data.patientData) {
        this.addPatientQuickActions(patientId, chatbox);
      }

    } catch (error) {
      console.error("Patient query error:", error);
      this.addMessageToChat("Error retrieving patient information. Please try again.", 'bot', chatbox);
    }
  }

  // ADD PATIENT QUICK ACTIONS
  addPatientQuickActions(patientId, chatbox) {
    const actionsDiv = document.createElement('div');
    actionsDiv.className = 'patient-quick-actions';
    actionsDiv.style.cssText = `
      margin: 16px 0;
      padding: 16px;
      background: #fefdf8;
      border-radius: 12px;
      border: 1px solid #e5e7eb;
    `;
    
    actionsDiv.innerHTML = `
      <p style="font-weight: 600; margin-bottom: 12px; color: #374151;">
        Quick actions for Patient ${patientId}:
      </p>
      <div style="display: flex; gap: 8px; flex-wrap: wrap;">
        <button class="medical-btn medical-btn-secondary medical-btn-sm" onclick="podiatristAI.querySpecificPatient('${patientId}', 'risk assessment')">
          🩹 Risk Assessment
        </button>
        <button class="medical-btn medical-btn-secondary medical-btn-sm" onclick="podiatristAI.querySpecificPatient('${patientId}', 'treatment recommendations')">
          💊 Treatment Plan
        </button>
        <button class="medical-btn medical-btn-secondary medical-btn-sm" onclick="podiatristAI.querySpecificPatient('${patientId}', 'care coordination')">
          📋 Care Plan
        </button>
      </div>
    `;
    
    chatbox.appendChild(actionsDiv);
    chatbox.scrollTop = chatbox.scrollHeight;
  }

  // ADD MESSAGE TO CHAT
  addMessageToChat(message, sender, chatbox) {
    if (!chatbox) return;
    
    const messageDiv = document.createElement('div');
    messageDiv.className = sender === 'user' ? 'message-user' : 'message-bot';
    
    if (sender === 'user') {
      messageDiv.innerHTML = `<strong>Dr. [NAME]:</strong> ${message}`;
    } else {
      const formattedMessage = this.formatAIResponse(message);
      messageDiv.innerHTML = `<strong>Clinical Assistant:</strong><br>${formattedMessage}`;
    }
    
    chatbox.appendChild(messageDiv);
    chatbox.scrollTop = chatbox.scrollHeight;
  }

  // FORMAT AI RESPONSE FUNCTION
  formatAIResponse(message) {
    let formatted = message
      // Handle markdown headers
      .replace(/^###\s+(.+)$/gm, '<h4 style="color: #1d4ed8; margin: 16px 0 8px 0; font-size: 1.1rem; font-weight: 600;">$1</h4>')
      .replace(/^##\s+(.+)$/gm, '<h3 style="color: #1d4ed8; margin: 18px 0 10px 0; font-size: 1.2rem; font-weight: 600;">$1</h3>')
      .replace(/^#\s+(.+)$/gm, '<h2 style="color: #1d4ed8; margin: 20px 0 12px 0; font-size: 1.3rem; font-weight: 600;">$1</h2>')
      
      // Handle bold text
      .replace(/\*\*(.*?)\*\*/g, '<strong style="color: #374151;">$1</strong>')
      
      // Handle bullet points
      .replace(/^[-•·]\s+(.+)$/gm, '<li style="margin-bottom: 4px;">$1</li>')
      
      // Handle numbered lists
      .replace(/^\d+\.\s+(.+)$/gm, '<li style="margin-bottom: 4px;">$1</li>')
      
      // Handle line breaks
      .replace(/\n\n/g, '</p><p>')
      .replace(/\n/g, '<br>');
      
    // Wrap in paragraph tags
    formatted = '<p>' + formatted + '</p>';
    
    // Fix lists by wrapping consecutive <li> items in <ul>
    formatted = formatted.replace(/(<li[^>]*>.*?<\/li>)(\s*<br>\s*<li[^>]*>.*?<\/li>)*/g, function(match) {
      const listItems = match.match(/<li[^>]*>.*?<\/li>/g);
      return '<ul style="margin: 8px 0; padding-left: 20px; list-style-type: disc;">' + listItems.join('') + '</ul>';
    });
    
    // Clean up empty paragraphs and extra breaks
    formatted = formatted
      .replace(/<p><\/p>/g, '')
      .replace(/<p><br><\/p>/g, '')
      .replace(/<br><\/p>/g, '</p>')
      .replace(/<p><br>/g, '<p>')
      .replace(/<br>\s*<h([1-6])/g, '<h$1')
      .replace(/<\/h([1-6])>\s*<br>/g, '</h$1>')
      .replace(/<br>\s*<ul/g, '<ul')
      .replace(/<\/ul>\s*<br>/g, '</ul>');
    
    return formatted;
  }

  // GET STATUS FOR DEBUGGING
  getStatus() {
    return {
      initialized: this.isInitialized,
      patientCacheSize: this.patientCache.size,
      selectedAppointment: this.selectedAppointment
    };
  }
}

// Create global instance
const podiatristAI = new PodiatristAIChat();

// GLOBAL FUNCTION EXPORTS
window.sendAIMessage = function() {
  podiatristAI.sendFloatingMessage();
};

window.sendQuickQuery = function(query) {
  podiatristAI.sendQuickQuery(query);
};

window.querySpecificPatient = function(patientId, question) {
  podiatristAI.querySpecificPatient(patientId, question);
};

window.refreshFloatingChat = function() {
  podiatristAI.refreshChat();
};

window.showPatientContact = function(patientName, phone, email) {
  podiatristAI.showPatientContact(patientName, phone, email);
};

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
  setTimeout(() => {
    podiatristAI.init();
  }, 100);
});

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = PodiatristAIChat;
}