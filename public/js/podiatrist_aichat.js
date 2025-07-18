// ========================================
// COMPLETE WORKING AI CHAT - FLOATING ASSISTANT WITH MODAL APPOINTMENT EDITING
// ========================================

class PodiatristAIChat {
  constructor() {
    this.isInitialized = false;
    this.patientCache = new Map();
    this.selectedAppointment = null;
    this.currentAppointmentData = null;
    this.sessionData = null;
    this.bookedSlots = new Set(); // ← ADD THIS LINE
    
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

  // Load session data for personalization
loadSessionData() {
  try {
    this.sessionData = {
      userId: sessionStorage.getItem('userId') || 'pod_1',
      firstName: sessionStorage.getItem('firstName') || 'Doctor',
      role: sessionStorage.getItem('role') || 'podiatrist',
      email: sessionStorage.getItem('email') || ''
    };
    
    console.log('✅ AI Chat session data loaded:', this.sessionData);
    return true;
  } catch (error) {
    console.error('❌ Failed to load session data:', error);
    this.sessionData = {
      userId: 'pod_1',
      firstName: 'Doctor',
      role: 'podiatrist',
      email: ''
    };
    return false;
  }
}

  // Initialize AI chat system
init() {
  console.log('🤖 Initializing Podiatrist AI Chat (Floating Only)...');
  
  if (this.isInitialized) {
    console.log('⚠️ AI Chat already initialized');
    return;
  }

  try {
    // ADD THIS LINE - Load session data first
    this.loadSessionData();
    
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
  // Get doctor name from session - FIXED TO HANDLE UNDEFINED CASE
  const doctorName = this.sessionData && this.sessionData.firstName ? 
    `${this.sessionData.firstName}`.trim() : 
    'Doctor';
    
  const welcomeDiv = document.createElement('div');
  welcomeDiv.className = 'message-bot';
  welcomeDiv.innerHTML = `
    <strong>🤖 Clinical Assistant:</strong> 
    <p>Hello ${doctorName}! I'm your AI support assistant. I can help you with:</p>
    
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
          days: 14,
          limit: 10
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

 async showDirectAppointmentEdit(patientId, suggestedDateTime = null) {
  try {
    console.log('🔍 Fetching appointments for specific patient:', patientId);
    console.log('🗓️ Suggested date/time:', suggestedDateTime);
    
    // Fetch appointments for this specific patient
    const response = await fetch("/get-patient-appointments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        patientId: patientId,
        suggestedDateTime: suggestedDateTime,
        podiatristId: "current_podiatrist"
      })
    });
    
    const result = await response.json();
    
    if (result.success && result.appointments && result.appointments.length > 0) {
      console.log('✅ Found', result.appointments.length, 'appointments for', patientId);
      
      // If only one appointment, go directly to edit form
      if (result.appointments.length === 1) {
        const appointment = result.appointments[0];
        this.selectedAppointment = {
          patientId: appointment.patientId,
          appointmentId: appointment.appointmentId,
          patientName: appointment.patientName,
          currentDateTime: appointment.scheduledDateTime
        };
        
        // Show edit form directly
        this.showDirectEditForm(appointment, suggestedDateTime);
      } else {
        // Multiple appointments - show selection modal but filtered
        this.showAppointmentModal(result.appointments, result.appointments.length);
      }
    } else {
      console.log('❌ No appointments found for', patientId);
      const chatbox = document.getElementById('aiChatbox');
      this.addMessageToChat(`❌ No appointments found for ${patientId}${suggestedDateTime ? ' on ' + suggestedDateTime : ''}. Please check the patient name/ID and date.`, 'bot', chatbox);
    }
    
  } catch (error) {
    console.error("❌ Error fetching patient appointments:", error);
    const chatbox = document.getElementById('aiChatbox');
    this.addMessageToChat("❌ Error loading appointments. Please try again.", 'bot', chatbox);
  }
}

// // SHOW EDIT FORM DIRECTLY (BYPASS APPOINTMENT SELECTION)
// showDirectEditForm(appointment, suggestedDateTime = null) {
//   console.log('📝 Showing direct edit form for appointment:', appointment);
  
//   // Store the current appointment data for later use
//   this.currentAppointmentData = {
//     patientId: appointment.patientId,
//     appointmentId: appointment.appointmentId,
//     patientName: appointment.patientName,
//     currentDateTime: appointment.scheduledDateTime,
//     category: appointment.category,
//     initialDiagnosis: appointment.initialDiagnosis
//   };
  
//   console.log('💾 Stored appointment data:', this.currentAppointmentData);
  
//   // Remove existing modal if any
//   const existingModal = document.getElementById('appointmentEditModal');
//   if (existingModal) {
//     existingModal.remove();
//   }
  
//   // Create modal with edit form directly
//   const modal = document.createElement('div');
//   modal.id = 'appointmentEditModal';
//   modal.style.cssText = `
//     position: fixed;
//     top: 0;
//     left: 0;
//     width: 100%;
//     height: 100%;
//     background: rgba(0, 0, 0, 0.5);
//     display: flex;
//     justify-content: center;
//     align-items: center;
//     z-index: 10000;
//     animation: fadeIn 0.2s ease-out;
//   `;
  
//   const modalContent = document.createElement('div');
//   modalContent.style.cssText = `
//     background: white;
//     border-radius: 12px;
//     padding: 20px;
//     max-width: 500px;
//     max-height: 80vh;
//     width: 90%;
//     box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
//     overflow-y: auto;
//     animation: slideInScale 0.2s ease-out;
//   `;
  
//   // Pre-fill suggested date/time if provided
//   let preFillDate = '';
//   let preFillTime = '';
  
//   if (suggestedDateTime) {
//     console.log('🕐 Suggested date/time:', suggestedDateTime);
    
//     if (suggestedDateTime.includes('july')) {
//       const year = new Date().getFullYear();
//       const match = suggestedDateTime.match(/(\d{1,2})\s*july/i);
//       if (match) {
//         const day = match[1].padStart(2, '0');
//         preFillDate = `${year}-07-${day}`;
//       }
//     }
//   }
  
//   modalContent.innerHTML = `
//     <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; border-bottom: 1px solid #e5e7eb; padding-bottom: 15px;">
//       <h3 style="margin: 0; color: #1d4ed8; font-size: 1.2rem;">✏️ Edit Appointment</h3>
//       <button onclick="podiatristAI.closeAppointmentModal()" style="
//         background: none;
//         border: none;
//         font-size: 1.5rem;
//         cursor: pointer;
//         color: #6b7280;
//         padding: 5px;
//         border-radius: 4px;
//         transition: background-color 0.2s;
//       " onmouseover="this.style.backgroundColor='#f3f4f6'" onmouseout="this.style.backgroundColor='transparent'">✕</button>
//     </div>
    
//     <div style="margin-bottom: 20px;">
//       <div style="background: #f0f9ff; padding: 15px; border-radius: 8px; border: 1px solid #bfdbfe; margin-bottom: 20px;">
//         <h4 style="margin: 0 0 10px 0; color: #1d4ed8;">📋 Current Appointment</h4>
//         <div style="font-size: 0.9rem; color: #374151;">
//           <div><strong>Patient:</strong> ${appointment.patientName}</div>
//           <div><strong>Appointment ID:</strong> ${appointment.appointmentId}</div>
//           <div><strong>Current Date/Time:</strong> ${appointment.scheduledDateTime}</div>
//           <div><strong>Category:</strong> ${appointment.category}</div>
//           <div><strong>Diagnosis:</strong> ${appointment.initialDiagnosis}</div>
//         </div>
//       </div>
      
//       <div style="background: #fefdf8; padding: 20px; border-radius: 8px; border: 1px solid #e5e7eb;">
//         <h4 style="margin: 0 0 15px 0; color: #374151;">📅 New Date & Time</h4>
        
//         <div style="margin-bottom: 15px;">
//           <label style="display: block; margin-bottom: 5px; font-weight: 600; color: #374151;">Date:</label>
//           <input type="date" id="newAppointmentDate" value="${preFillDate}" style="
//             width: 100%;
//             padding: 10px;
//             border: 1px solid #d1d5db;
//             border-radius: 6px;
//             font-size: 1rem;
//           " min="${new Date().toISOString().split('T')[0]}">
//         </div>
        
//         <div style="margin-bottom: 20px;">
//           <label style="display: block; margin-bottom: 5px; font-weight: 600; color: #374151;">Time:</label>
//           <select id="newAppointmentTime" style="
//             width: 100%;
//             padding: 10px;
//             border: 1px solid #d1d5db;
//             border-radius: 6px;
//             font-size: 1rem;
//           ">
//             <option value="">Select time</option>
//             <option value="08:00">8:00 AM</option>
//             <option value="08:30">8:30 AM</option>
//             <option value="09:00">9:00 AM</option>
//             <option value="09:30">9:30 AM</option>
//             <option value="10:00">10:00 AM</option>
//             <option value="10:30">10:30 AM</option>
//             <option value="11:00">11:00 AM</option>
//             <option value="11:30">11:30 AM</option>
//             <option value="12:00">12:00 PM</option>
//             <option value="12:30">12:30 PM</option>
//             <option value="13:00">1:00 PM</option>
//             <option value="13:30">1:30 PM</option>
//             <option value="14:00">2:00 PM</option>
//             <option value="14:30">2:30 PM</option>
//             <option value="15:00">3:00 PM</option>
//             <option value="15:30">3:30 PM</option>
//             <option value="16:00">4:00 PM</option>
//             <option value="16:30">4:30 PM</option>
//             <option value="17:00">5:00 PM</option>
//           </select>
//         </div>
        
//         <div style="display: flex; gap: 10px; justify-content: flex-end;">
//           <button onclick="podiatristAI.closeAppointmentModal()" style="
//             background: #6b7280;
//             color: white;
//             border: none;
//             padding: 10px 20px;
//             border-radius: 6px;
//             cursor: pointer;
//             font-size: 0.9rem;
//             transition: background-color 0.2s;
//           " onmouseover="this.style.backgroundColor='#4b5563'" onmouseout="this.style.backgroundColor='#6b7280'">
//             Cancel
//           </button>
//           <button onclick="podiatristAI.submitAppointmentEditFixed('${appointment.patientId}', '${appointment.appointmentId}', '${appointment.patientName}')" style="
//             background: #3b82f6;
//             color: white;
//             border: none;
//             padding: 10px 20px;
//             border-radius: 6px;
//             cursor: pointer;
//             font-size: 0.9rem;
//             transition: background-color 0.2s;
//           " onmouseover="this.style.backgroundColor='#2563eb'" onmouseout="this.style.backgroundColor='#3b82f6'">
//             ✅ Update Appointment
//           </button>
//         </div>
//       </div>
//     </div>
//   `;
  
//   modal.appendChild(modalContent);
//   document.body.appendChild(modal);
  
//   // Add animation styles
//   const style = document.createElement('style');
//   style.textContent = `
//     @keyframes fadeIn {
//       from { opacity: 0; }
//       to { opacity: 1; }
//     }
//     @keyframes slideInScale {
//       from { opacity: 0; transform: translateY(-20px) scale(0.95); }
//       to { opacity: 1; transform: translateY(0) scale(1); }
//     }
//   `;
//   document.head.appendChild(style);
  
//   // Close modal when clicking outside
//   modal.addEventListener('click', (e) => {
//     if (e.target === modal) {
//       this.closeAppointmentModal();
//     }
//   });
  
//   console.log('✅ Direct edit form displayed for', appointment.patientName, 'with appointment ID:', appointment.appointmentId);
// }

// SHOW EDIT FORM DIRECTLY - ORIGINAL FORMAT WITH AVAILABILITY FILTERING
async showDirectEditForm(appointment, suggestedDateTime = null) {
  console.log('📝 Showing direct edit form for appointment:', appointment);
  
  // Store the current appointment data for later use
  this.currentAppointmentData = {
    patientId: appointment.patientId,
    appointmentId: appointment.appointmentId,
    patientName: appointment.patientName,
    currentDateTime: appointment.scheduledDateTime,
    category: appointment.category,
    initialDiagnosis: appointment.initialDiagnosis
  };
  
  console.log('💾 Stored appointment data:', this.currentAppointmentData);
  
  // Remove existing modal if any
  const existingModal = document.getElementById('appointmentEditModal');
  if (existingModal) {
    existingModal.remove();
  }
  
  // LOAD BOOKED SLOTS TO FILTER OUT
  console.log('🔄 Loading booked slots to filter out...');
  await this.loadBookedSlotsForFiltering();
  
  // Create modal with edit form directly
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
  
  // Pre-fill suggested date/time if provided
  let preFillDate = '';
  
  if (suggestedDateTime) {
    console.log('🕐 Suggested date/time:', suggestedDateTime);
    
    if (suggestedDateTime.includes('july')) {
      const year = new Date().getFullYear();
      const match = suggestedDateTime.match(/(\d{1,2})\s*july/i);
      if (match) {
        const day = match[1].padStart(2, '0');
        preFillDate = `${year}-07-${day}`;
      }
    }
  }
  
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
          <div><strong>Patient:</strong> ${appointment.patientName}</div>
          <div><strong>Appointment ID:</strong> ${appointment.appointmentId}</div>
          <div><strong>Current Date/Time:</strong> ${appointment.scheduledDateTime}</div>
          <div><strong>Category:</strong> ${appointment.category}</div>
          <div><strong>Diagnosis:</strong> ${appointment.initialDiagnosis}</div>
        </div>
      </div>
      
      <div style="background: #fefdf8; padding: 20px; border-radius: 8px; border: 1px solid #e5e7eb;">
        <h4 style="margin: 0 0 15px 0; color: #374151;">📅 New Date & Time</h4>
        
        <div style="margin-bottom: 15px;">
          <label style="display: block; margin-bottom: 5px; font-weight: 600; color: #374151;">Date:</label>
          <input type="date" id="newAppointmentDate" value="${preFillDate}" style="
            width: 100%;
            padding: 10px;
            border: 1px solid #d1d5db;
            border-radius: 6px;
            font-size: 1rem;
          " min="${new Date().toISOString().split('T')[0]}" onchange="podiatristAI.updateAvailableTimesForDate()">
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
            <option value="">Select date first</option>
          </select>
          <p id="availabilityStatus" style="font-size: 0.875rem; margin-top: 8px; color: #6b7280;">
            Select a date to see available times
          </p>
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
          <button onclick="podiatristAI.submitAppointmentEditFixed('${appointment.patientId}', '${appointment.appointmentId}', '${appointment.patientName}')" style="
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
  
  console.log('✅ Direct edit form displayed for', appointment.patientName);
}

// FIXED SUBMIT APPOINTMENT EDIT - USES CORRECT APPOINTMENT ID
async submitAppointmentEditFixed(patientId, appointmentId, patientName) {
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
  
  console.log('🔄 Updating appointment with correct ID:', {
    appointmentId: appointmentId,
    patientId: patientId,
    newDateTime: newDateTime
  });
  
  // Get the ACTUAL current appointment data we stored earlier
  const currentAppointmentInfo = this.currentAppointmentData || {
    currentDateTime: 'Previous appointment date not available'
  };
  
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
    
    // Send edit request to server with CORRECT appointment ID
    const response = await fetch("/podiatrist-update-appointment", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        apptId: appointmentId,  // Use the correct appointment ID
        updateData: newDateTime
      })
    });
    
    const result = await response.json();
    
    if (result.success) {
      // Format the new date for display
      const newDateFormatted = new Date(`${newDate}T${newTime}:00`).toLocaleDateString("en-SG", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
        timeZone: "Asia/Singapore"
      });
      
      // Show success message with CORRECT previous date
      modal.querySelector('div').innerHTML = `
        <div style="text-align: center; padding: 40px;">
          <div style="font-size: 3rem; margin-bottom: 15px;">✅</div>
          <h3 style="color: #059669; margin-bottom: 15px;">Appointment Updated Successfully!</h3>
          <div style="background: #f0fdf4; padding: 15px; border-radius: 8px; margin-bottom: 20px; text-align: left;">
            <div><strong>Patient:</strong> ${patientName}</div>
            <div><strong>Appointment ID:</strong> ${appointmentId}</div>
            <div><strong>New Date & Time:</strong> ${newDateFormatted}</div>
            <div><strong>Previous:</strong> ${currentAppointmentInfo.currentDateTime}</div>
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
        this.addMessageToChat(`✅ **Appointment Updated**: ${patientName}'s appointment (ID: ${appointmentId}) has been successfully rescheduled from ${currentAppointmentInfo.currentDateTime} to ${newDateFormatted}`, 'bot', chatbox);
      }
      
      // Enhanced real-time updates
      setTimeout(async () => {
        try {
          console.log('🔄 Starting enhanced real-time updates after appointment edit...');
          
          // CLEAR ALL SCHEDULE CACHES
          if (typeof scheduleCache !== 'undefined') {
            scheduleCache.clear();
            console.log('✅ Cleared main schedule cache');
          }
          
          if (typeof scheduleCache2 !== 'undefined') {
            scheduleCache2.data = null;
            scheduleCache2.timestamp = null;
            console.log('✅ Cleared scheduleCache2');
          }
          
          // CLEAR AI CHATBOT INTERNAL CACHE (if any)
          if (window.podiatristAI && window.podiatristAI.scheduleCache) {
            window.podiatristAI.scheduleCache.clear();
            console.log('✅ Cleared AI chatbot schedule cache');
          }
          
          if (typeof window.refreshPatientQueue === 'function') {
            console.log('🔄 Refreshing patient queue...');
            await window.refreshPatientQueue();
            console.log('✅ Patient queue refreshed');
          }
          
          if (window.podiatristCalendar && typeof window.podiatristCalendar.refreshCalendar === 'function') {
            await window.podiatristCalendar.refreshCalendar();
            console.log('✅ Calendar refresh completed');
          }
          
          if (typeof window.showUpdateNotification === 'function') {
            window.showUpdateNotification('📅 Calendar updated with latest appointment changes');
          }
          
          console.log('✅ All enhanced real-time updates completed successfully');
        } catch (error) {
          console.error('❌ Error during enhanced real-time update:', error);
        }
      }, 1000);
      
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
            <button onclick="podiatristAI.showDirectEditForm(podiatristAI.currentAppointmentData)" style="
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
  
  // ALSO STORE IN currentAppointmentData for consistency
  this.currentAppointmentData = {
    patientId: patientId,
    appointmentId: appointmentId,
    patientName: patientName,
    currentDateTime: currentDateTime,
    category: 'General',
    initialDiagnosis: 'Assessment pending'
  };
  
  // Transform the modal into an editing interface
  this.showAppointmentEditForm(patientId, appointmentId, patientName, currentDateTime);
}

// // SHOW APPOINTMENT EDIT FORM IN MODAL
// showAppointmentEditForm(patientId, appointmentId, patientName, currentDateTime) {
//   const modal = document.getElementById('appointmentEditModal');
//   if (!modal) return;
  
//   // STORE THE CURRENT APPOINTMENT DATA HERE TOO
//   this.currentAppointmentData = {
//     patientId: patientId,
//     appointmentId: appointmentId,
//     patientName: patientName,
//     currentDateTime: currentDateTime,
//     category: 'General', // Default since we don't have it here
//     initialDiagnosis: 'Assessment pending' // Default since we don't have it here
//   };
  
//   const modalContent = modal.querySelector('div');
  
//   // Replace modal content with edit form
//   modalContent.innerHTML = `
//     <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; border-bottom: 1px solid #e5e7eb; padding-bottom: 15px;">
//       <h3 style="margin: 0; color: #1d4ed8; font-size: 1.2rem;">✏️ Edit Appointment</h3>
//       <button onclick="podiatristAI.closeAppointmentModal()" style="
//         background: none;
//         border: none;
//         font-size: 1.5rem;
//         cursor: pointer;
//         color: #6b7280;
//         padding: 5px;
//         border-radius: 4px;
//         transition: background-color 0.2s;
//       " onmouseover="this.style.backgroundColor='#f3f4f6'" onmouseout="this.style.backgroundColor='transparent'">✕</button>
//     </div>
    
//     <div style="margin-bottom: 20px;">
//       <div style="background: #f0f9ff; padding: 15px; border-radius: 8px; border: 1px solid #bfdbfe; margin-bottom: 20px;">
//         <h4 style="margin: 0 0 10px 0; color: #1d4ed8;">📋 Current Appointment</h4>
//         <div style="font-size: 0.9rem; color: #374151;">
//           <div><strong>Patient:</strong> ${patientName}</div>
//           <div><strong>Current Date/Time:</strong> ${currentDateTime}</div>
//         </div>
//       </div>
      
//       <div style="background: #fefdf8; padding: 20px; border-radius: 8px; border: 1px solid #e5e7eb;">
//         <h4 style="margin: 0 0 15px 0; color: #374151;">📅 New Date & Time</h4>
        
//         <div style="margin-bottom: 15px;">
//           <label style="display: block; margin-bottom: 5px; font-weight: 600; color: #374151;">Date:</label>
//           <input type="date" id="newAppointmentDate" style="
//             width: 100%;
//             padding: 10px;
//             border: 1px solid #d1d5db;
//             border-radius: 6px;
//             font-size: 1rem;
//           " min="${new Date().toISOString().split('T')[0]}">
//         </div>
        
//         <div style="margin-bottom: 20px;">
//           <label style="display: block; margin-bottom: 5px; font-weight: 600; color: #374151;">Time:</label>
//           <select id="newAppointmentTime" style="
//             width: 100%;
//             padding: 10px;
//             border: 1px solid #d1d5db;
//             border-radius: 6px;
//             font-size: 1rem;
//           ">
//             <option value="">Select time</option>
//             <option value="08:00">8:00 AM</option>
//             <option value="08:30">8:30 AM</option>
//             <option value="09:00">9:00 AM</option>
//             <option value="09:30">9:30 AM</option>
//             <option value="10:00">10:00 AM</option>
//             <option value="10:30">10:30 AM</option>
//             <option value="11:00">11:00 AM</option>
//             <option value="11:30">11:30 AM</option>
//             <option value="12:00">12:00 PM</option>
//             <option value="12:30">12:30 PM</option>
//             <option value="13:00">1:00 PM</option>
//             <option value="13:30">1:30 PM</option>
//             <option value="14:00">2:00 PM</option>
//             <option value="14:30">2:30 PM</option>
//             <option value="15:00">3:00 PM</option>
//             <option value="15:30">3:30 PM</option>
//             <option value="16:00">4:00 PM</option>
//             <option value="16:30">4:30 PM</option>
//             <option value="17:00">5:00 PM</option>
//           </select>
//         </div>
        
//         <div style="display: flex; gap: 10px; justify-content: flex-end;">
//           <button onclick="podiatristAI.closeAppointmentModal()" style="
//             background: #6b7280;
//             color: white;
//             border: none;
//             padding: 10px 20px;
//             border-radius: 6px;
//             cursor: pointer;
//             font-size: 0.9rem;
//             transition: background-color 0.2s;
//           " onmouseover="this.style.backgroundColor='#4b5563'" onmouseout="this.style.backgroundColor='#6b7280'">
//             Cancel
//           </button>
//           <button onclick="podiatristAI.submitAppointmentEditFixed('${patientId}', '${appointmentId}', '${patientName}')" style="
//             background: #3b82f6;
//             color: white;
//             border: none;
//             padding: 10px 20px;
//             border-radius: 6px;
//             cursor: pointer;
//             font-size: 0.9rem;
//             transition: background-color 0.2s;
//           " onmouseover="this.style.backgroundColor='#2563eb'" onmouseout="this.style.backgroundColor='#3b82f6'">
//             ✅ Update Appointment
//           </button>
//         </div>
//       </div>
//     </div>
//   `;
// }

// SHOW APPOINTMENT EDIT FORM IN MODAL - ORIGINAL FORMAT WITH AVAILABILITY FILTERING
async showAppointmentEditForm(patientId, appointmentId, patientName, currentDateTime) {
  const modal = document.getElementById('appointmentEditModal');
  if (!modal) return;
  
  // STORE THE CURRENT APPOINTMENT DATA HERE TOO
  this.currentAppointmentData = {
    patientId: patientId,
    appointmentId: appointmentId,
    patientName: patientName,
    currentDateTime: currentDateTime,
    category: 'General',
    initialDiagnosis: 'Assessment pending'
  };
  
  // LOAD BOOKED SLOTS TO FILTER OUT
  console.log('🔄 Loading booked slots for filtering...');
  await this.loadBookedSlotsForFiltering();
  
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
          " min="${new Date().toISOString().split('T')[0]}" onchange="podiatristAI.updateAvailableTimesForDate()">
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
            <option value="">Select date first</option>
          </select>
          <p id="availabilityStatus" style="font-size: 0.875rem; margin-top: 8px; color: #6b7280;">
            Select a date to see available times
          </p>
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
          <button onclick="podiatristAI.submitAppointmentEditFixed('${patientId}', '${appointmentId}', '${patientName}')" style="
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
      
      // ✨ ENHANCED: REAL-TIME UPDATES - Refresh patient queue and calendar
      setTimeout(async () => {
        try {
          console.log('🔄 Starting enhanced real-time updates after appointment edit...');
          
          // 1. Clear any existing cache
          if (typeof scheduleCache !== 'undefined') {
            scheduleCache.clear();
          }
          
          // 2. Refresh patient queue
          if (typeof window.refreshPatientQueue === 'function') {
            console.log('🔄 Refreshing patient queue...');
            await window.refreshPatientQueue();
            console.log('✅ Patient queue refreshed');
          }
          
          // 3. FORCE CALENDAR REFRESH - Multiple methods for reliability
          console.log('🔄 Force refreshing calendar with multiple methods...');
          
          // Method 1: Direct calendar refresh
          if (window.podiatristCalendar && typeof window.podiatristCalendar.refreshCalendar === 'function') {
            await window.podiatristCalendar.refreshCalendar();
            console.log('✅ Method 1: Direct calendar refresh completed');
          }
          
          // Method 2: Global calendar refresh
          if (typeof window.refreshCalendarView === 'function') {
            await window.refreshCalendarView();
            console.log('✅ Method 2: Global calendar refresh completed');
          }
          
          // Method 3: Manual calendar regeneration
          if (window.podiatristCalendar && typeof window.podiatristCalendar.generateCalendarForMonth === 'function') {
            const currentDate = window.podiatristCalendar.currentDate || new Date();
            await window.podiatristCalendar.loadAppointments(); // Reload data first
            window.podiatristCalendar.generateCalendarForMonth(currentDate.getMonth(), currentDate.getFullYear());
            console.log('✅ Method 3: Manual calendar regeneration completed');
          }
          
          // 4. Show success notification
          if (typeof window.showUpdateNotification === 'function') {
            window.showUpdateNotification('📅 Calendar updated with latest appointment changes');
          }
          
          console.log('✅ All enhanced real-time updates completed successfully');
        } catch (error) {
          console.error('❌ Error during enhanced real-time update:', error);
        }
      }, 1000);
      
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

  // ========================================
// AVAILABILITY FILTERING FOR ORIGINAL DATE/TIME FORMAT
// ========================================

// Load booked slots to filter out from time options
async loadBookedSlotsForFiltering() {
  try {
    console.log("🔍 Loading booked slots for filtering...");
    
    // Get all scheduled appointments to know what's booked
    const response = await fetch("/get-schedule-by-date", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        podiatristId: "current_podiatrist",
        targetDate: "all", // Special flag to get all dates
        cacheBuster: Date.now()
      })
    });
    
    if (response.ok) {
      const result = await response.json();
      
      // Create a set of booked time slots
      this.bookedSlots = new Set();
      
      if (result.success && result.appointments) {
        result.appointments.forEach(apt => {
          // Create a date-time key for comparison
          const aptDateTime = new Date(apt.scheduledDateTime);
          const dateKey = aptDateTime.toISOString().split('T')[0]; // YYYY-MM-DD
          const timeKey = aptDateTime.toTimeString().split(' ')[0].substring(0, 5); // HH:MM
          const slotKey = `${dateKey}_${timeKey}`;
          this.bookedSlots.add(slotKey);
        });
      }
      
      console.log(`📅 Loaded ${this.bookedSlots.size} booked slots for filtering`);
    } else {
      // Fallback: get from appointments directly
      await this.loadBookedSlotsFromAppointments();
    }
    
  } catch (error) {
    console.error("❌ Error loading booked slots:", error);
    this.bookedSlots = new Set();
    
    // Try fallback method
    await this.loadBookedSlotsFromAppointments();
  }
}

// Fallback method to load booked slots directly from appointments
async loadBookedSlotsFromAppointments() {
  try {
    const podId = "pod_1";
    const response = await fetch("/podiatrist-get-calendar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ podId })
    });
    
    const result = await response.json();
    this.bookedSlots = new Set();
    
    if (result.appointments) {
      result.appointments.forEach(apt => {
        // Parse the date and time from the appointment
        const [day, month, year] = apt.date.split(' ');
        const monthNum = {
          'January': '01', 'February': '02', 'March': '03', 'April': '04',
          'May': '05', 'June': '06', 'July': '07', 'August': '08',
          'September': '09', 'October': '10', 'November': '11', 'December': '12'
        }[month];
        
        if (monthNum) {
          const dateKey = `${year}-${monthNum}-${day.padStart(2, '0')}`;
          
          // Parse time "3:30 pm" -> "15:30"
          const timeParts = apt.time.toLowerCase().split(' ');
          let [hours, minutes] = timeParts[0].split(':');
          
          if (timeParts[1] === 'pm' && hours !== '12') {
            hours = String(Number(hours) + 12);
          } else if (timeParts[1] === 'am' && hours === '12') {
            hours = '00';
          }
          
          const timeKey = `${hours.padStart(2, '0')}:${minutes.padStart(2, '0')}`;
          const slotKey = `${dateKey}_${timeKey}`;
          this.bookedSlots.add(slotKey);
        }
      });
    }
    
    console.log(`📅 Fallback: Loaded ${this.bookedSlots.size} booked slots`);
  } catch (error) {
    console.error("❌ Fallback method failed:", error);
    this.bookedSlots = new Set();
  }
}

// Update available times when date is selected
updateAvailableTimesForDate() {
  const dateInput = document.getElementById('newAppointmentDate');
  const timeSelect = document.getElementById('newAppointmentTime');
  const statusText = document.getElementById('availabilityStatus');
  
  if (!dateInput || !timeSelect || !statusText) return;
  
  const selectedDate = dateInput.value;
  
  if (!selectedDate) {
    timeSelect.innerHTML = '<option value="">Select date first</option>';
    statusText.textContent = 'Select a date to see available times';
    statusText.style.color = '#6b7280';
    return;
  }
  
  console.log('🔄 Updating available times for date:', selectedDate);
  
  // Define all possible time slots (8 AM to 5 PM, 30-min intervals)
  const allTimeSlots = [
    { value: "08:00", label: "8:00 AM" },
    { value: "08:30", label: "8:30 AM" },
    { value: "09:00", label: "9:00 AM" },
    { value: "09:30", label: "9:30 AM" },
    { value: "10:00", label: "10:00 AM" },
    { value: "10:30", label: "10:30 AM" },
    { value: "11:00", label: "11:00 AM" },
    { value: "11:30", label: "11:30 AM" },
    { value: "12:00", label: "12:00 PM" },
    { value: "12:30", label: "12:30 PM" },
    { value: "13:00", label: "1:00 PM" },
    { value: "13:30", label: "1:30 PM" },
    { value: "14:00", label: "2:00 PM" },
    { value: "14:30", label: "2:30 PM" },
    { value: "15:00", label: "3:00 PM" },
    { value: "15:30", label: "3:30 PM" },
    { value: "16:00", label: "4:00 PM" },
    { value: "16:30", label: "4:30 PM" },
    { value: "17:00", label: "5:00 PM" }
  ];
  
  // Filter out booked slots
  const availableSlots = allTimeSlots.filter(slot => {
    const slotKey = `${selectedDate}_${slot.value}`;
    const isBooked = this.bookedSlots && this.bookedSlots.has(slotKey);
    
    if (isBooked) {
      console.log(`❌ Slot ${slotKey} is booked, filtering out`);
    }
    
    return !isBooked;
  });
  
  // Update the time dropdown
  timeSelect.innerHTML = '<option value="">Select time</option>';
  
  if (availableSlots.length === 0) {
    timeSelect.innerHTML += '<option value="" disabled>No available times for this date</option>';
    statusText.textContent = `❌ No available times on ${selectedDate}`;
    statusText.style.color = '#dc2626';
  } else {
    availableSlots.forEach(slot => {
      timeSelect.innerHTML += `<option value="${slot.value}">${slot.label}</option>`;
    });
    
    statusText.textContent = `✅ ${availableSlots.length} available times on ${selectedDate}`;
    statusText.style.color = '#059669';
  }
  
  console.log(`📅 Date ${selectedDate}: ${availableSlots.length} available slots out of ${allTimeSlots.length} total`);
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
  
  console.log('🔍 Edit detection:', {
    message: lowerMessage,
    hasEditKeyword,
    hasTimeKeyword,
    result: hasEditKeyword && hasTimeKeyword
  });
  
  return hasEditKeyword && hasTimeKeyword;
}

parseEditRequest(message) {
  console.log('🔍 Parsing edit request:', message);
  
  // Extract patient ID - improved patterns
  const patientIdPatterns = [
    /patient[_\s]*(\d+)/i,                    // "patient_1" or "patient 1"
    /(\w+\s+\w+)'?s?\s+appointment/i,         // "John Lim's appointment"
    /edit\s+(\w+\s+\w+)/i,                    // "edit John Lim"
    /for\s+(\w+\s+\w+)/i,                     // "for John Lim"
    /(patient_\d+)/i                          // Direct "patient_1"
  ];
  
  let patientId = null;
  
  for (const pattern of patientIdPatterns) {
    const match = message.match(pattern);
    if (match) {
      console.log('🎯 Pattern matched:', pattern.source, 'result:', match);
      
      if (pattern.source.includes('patient')) {
        patientId = match[1].includes('patient_') ? match[1] : `patient_${match[1]}`;
      } else {
        // For name matches, convert to patient ID
        const name = match[1].toLowerCase().trim();
        
        // Known patient mappings (extend this as needed)
        const patientNameMap = {
          'john lim': 'patient_1',
          'mary tan': 'patient_2',
          'david wong': 'patient_3',
          'sarah lee': 'patient_4'
        };
        
        patientId = patientNameMap[name] || match[1]; // fallback to original name
      }
      console.log('✅ Found patient ID:', patientId);
      if (patientId) break;
    }
  }
  
  // FIXED DATE EXTRACTION - Handle ordinal numbers properly
  let newDateTime = null;
  
  // Enhanced date patterns with ordinal support
  const dateTimePatterns = [
    // "5th july 2025", "1st august 2025" etc. - WITH ORDINALS
    /(\d{1,2})(st|nd|rd|th)\s+(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{4})/i,
    // "july 5th 2025", "august 1st 2025" etc. - WITH ORDINALS
    /(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{1,2})(st|nd|rd|th)\s+(\d{4})/i,
    // "5 july 2025", "24 july 2025" etc. - WITHOUT ORDINALS
    /(\d{1,2})\s+(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{4})/i,
    // "july 5 2025", "july 24 2025" etc. - WITHOUT ORDINALS
    /(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{1,2})\s+(\d{4})/i,
    // "5/7/2025", "24/7/2025" etc.
    /(\d{1,2})\/(\d{1,2})\/(\d{4})/,
    // "2025-07-05" format
    /(\d{4})-(\d{2})-(\d{2})/,
    // "on 5th july", "on july 5th" etc. WITH ORDINALS
    /on\s+(?:the\s+)?(\d{1,2})(st|nd|rd|th)\s+(january|february|march|april|may|june|july|august|september|october|november|december)/i,
    /on\s+(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{1,2})(st|nd|rd|th)/i,
    // "on 5 july", "on july 5" etc. WITHOUT ORDINALS
    /on\s+(?:the\s+)?(\d{1,2})\s+(january|february|march|april|may|june|july|august|september|october|november|december)/i,
    /on\s+(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{1,2})/i,
    // Simple dates like "5th july", "july 5th" WITH ORDINALS
    /(\d{1,2})(st|nd|rd|th)\s+(january|february|march|april|may|june|july|august|september|october|november|december)/i,
    /(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{1,2})(st|nd|rd|th)/i,
    // Simple dates like "5 july", "july 5" WITHOUT ORDINALS
    /(\d{1,2})\s+(january|february|march|april|may|june|july|august|september|october|november|december)/i,
    /(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{1,2})/i,
    // Relative dates
    /(tomorrow|today|yesterday)/i,
    // Day names
    /(monday|tuesday|wednesday|thursday|friday|saturday|sunday)/i
  ];
  
  for (const pattern of dateTimePatterns) {
    const match = message.match(pattern);
    if (match) {
      console.log('📅 Date pattern matched:', pattern.source, 'result:', match);
      
      // Handle different date formats based on pattern structure
      if (pattern.source.includes('(st|nd|rd|th)')) {
        // Patterns with ordinals
        if (match[4]) {
          // "5th july 2025" format (day, ordinal, month, year)
          newDateTime = `${match[1]} ${match[3]} ${match[4]}`;
        } else if (match[5]) {
          // "july 5th 2025" format (month, day, ordinal, year)
          newDateTime = `${match[2]} ${match[1]} ${match[5]}`;
        } else if (match[3] && !match[4]) {
          // "5th july" format without year (day, ordinal, month)
          newDateTime = `${match[1]} ${match[3]} ${new Date().getFullYear()}`;
        } else if (match[1] && match[2] && !match[4]) {
          // "july 5th" format without year (month, day, ordinal)
          newDateTime = `${match[2]} ${match[1]} ${new Date().getFullYear()}`;
        }
      } else if (pattern.source.includes('january|february')) {
        // Month name patterns without ordinals
        if (match[3] && !isNaN(match[3])) {
          // "5 july 2025" format (day, month, year)
          newDateTime = `${match[1]} ${match[2]} ${match[3]}`;
        } else if (match[3] && isNaN(match[1])) {
          // "july 5 2025" format (month, day, year)
          newDateTime = `${match[2]} ${match[1]} ${match[3]}`;
        } else if (match[2] && !match[3]) {
          // "5 july" format without year
          if (isNaN(match[1])) {
            // "july 5" format
            newDateTime = `${match[2]} ${match[1]} ${new Date().getFullYear()}`;
          } else {
            // "5 july" format
            newDateTime = `${match[1]} ${match[2]} ${new Date().getFullYear()}`;
          }
        }
      } else if (pattern.source.includes('\\/')) {
        // Date slash format "5/7/2025"
        newDateTime = `${match[1]}/${match[2]}/${match[3]}`;
      } else if (pattern.source.includes('\\d{4}-\\d{2}-\\d{2}')) {
        // ISO format "2025-07-05"
        newDateTime = match[0];
      } else {
        // Other formats (relative dates, day names)
        newDateTime = match[0];
      }
      
      console.log('✅ Extracted date/time:', newDateTime);
      break;
    }
  }
  
  console.log('📊 Parse result:', { patientId, newDateTime });
  return { patientId, newDateTime };
}

 findPatientByName(name) {
  console.log('🔍 Looking for patient by name:', name);
  
  // Enhanced patient mapping
  const knownPatients = {
    'john lim': 'patient_1',
    'john': 'patient_1',
    'lim': 'patient_1',
    'j lim': 'patient_1',
    'johnlim': 'patient_1'
  };
  
  const lowerName = name.toLowerCase().trim();
  
  // Check hardcoded mappings first
  for (const [patientName, patientId] of Object.entries(knownPatients)) {
    if (lowerName.includes(patientName) || patientName.includes(lowerName)) {
      console.log('✅ Found patient via hardcoded mapping:', patientId, 'for name:', name);
      return patientId;
    }
  }
  
  // Try to access global patient queue
  try {
    if (window.patientQueue && window.patientQueue.length > 0) {
      console.log('🔍 Searching in patient queue...');
      
      for (const patient of window.patientQueue) {
        const patientName = patient.name ? patient.name.toLowerCase() : '';
        
        if (patientName.includes(lowerName) || lowerName.includes(patientName)) {
          console.log('✅ Found patient in queue:', patient.patientId, 'for name:', name);
          return patient.patientId;
        }
      }
    }
  } catch (error) {
    console.log('⚠️ Error accessing patient queue:', error);
  }
  
  console.log('❌ No patient found for name:', name);
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
    // CHECK FOR EDIT/RESCHEDULE REQUESTS FIRST - ENHANCED VERSION
    if (this.detectEditRequest(processedMessage)) {
      console.log('📝 Detected edit/reschedule request');
      
      const editInfo = this.parseEditRequest(processedMessage);
      console.log('🔍 Parsed edit info:', editInfo);
      
      this.removeLoadingIndicator(thinkingDiv);
      
      if (editInfo.patientId && editInfo.newDateTime) {
        // SPECIFIC PATIENT + DATE - Go directly to filtered appointments
        console.log('🎯 Specific patient and date provided:', editInfo.patientId, editInfo.newDateTime);
        this.addMessageToChat(`🔍 Looking up appointments for ${editInfo.patientId} on ${editInfo.newDateTime}...`, 'bot', chatbox);
        await this.showDirectAppointmentEdit(editInfo.patientId, editInfo.newDateTime);
        return;
      } else if (editInfo.patientId) {
        // SPECIFIC PATIENT ONLY - Show all appointments for this patient
        console.log('🎯 Specific patient provided:', editInfo.patientId);
        this.addMessageToChat(`🔍 Looking up all appointments for ${editInfo.patientId}...`, 'bot', chatbox);
        await this.showDirectAppointmentEdit(editInfo.patientId, null);
        return;
      } else {
        // NO SPECIFIC INFO - Show general appointment selection modal
        console.log('🎯 No specific patient info, showing general selection');
        this.addMessageToChat("Let me show you the available appointments to edit...", 'bot', chatbox);
        await this.startAppointmentEdit();
        return;
      }
    }

    // CHECK FOR DATE-SPECIFIC SCHEDULE QUERIES
    const scheduleQuery = this.detectScheduleQuery(processedMessage);
    
    if (scheduleQuery.isScheduleQuery) {
      console.log('📅 Detected schedule query for date:', scheduleQuery.targetDate);
      
      // FORCE CLEAR ALL CACHES BEFORE FETCHING
      console.log('🧹 FORCE: Clearing all caches before schedule fetch...');
      
      if (typeof scheduleCache !== 'undefined') {
        scheduleCache.clear();
      }
      
      if (typeof scheduleCache2 !== 'undefined') {
        scheduleCache2.data = null;
        scheduleCache2.timestamp = null;
      }
      
      // Update loading message
      this.updateLoadingMessage(thinkingDiv, 'Fetching fresh schedule data...');
      
      // Fetch schedule for specific date
      const scheduleResponse = await fetch("/get-schedule-by-date", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          podiatristId: "current_podiatrist",
          targetDate: scheduleQuery.targetDate,
          cacheBuster: Date.now() // Force fresh data
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
        podiatristId: this.sessionData?.userId || "current_podiatrist",
        // ADD THESE LINES - Include session context
        podiatristName: this.sessionData ? 
          `${this.sessionData.firstName} ${this.sessionData.lastName}`.trim() : 
          'Unknown Doctor',
        sessionContext: {
          role: this.sessionData?.role || 'podiatrist',
          email: this.sessionData?.email || ''
        }
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
  
  // IMMEDIATE CACHE CLEARING FOR ANY SCHEDULE QUERY
  console.log('🧹 Pre-emptively clearing ALL schedule caches...');
  
  if (typeof scheduleCache !== 'undefined') {
    scheduleCache.clear();
    console.log('✅ Cleared main scheduleCache');
  }
  
  if (typeof scheduleCache2 !== 'undefined') {
    scheduleCache2.data = null;
    scheduleCache2.timestamp = null;
    console.log('✅ Cleared scheduleCache2');
  }
  
  // Clear any global window caches
  if (window.scheduleCache) {
    window.scheduleCache.clear();
    console.log('✅ Cleared window.scheduleCache');
  }
  
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
  
  // 1. "today", "tomorrow", "yesterday" - HIGHEST PRIORITY
  if (lowerMessage.includes('today')) {
    targetDate = 'today';
    console.log('✅ Detected "today"');
    return { isScheduleQuery: true, targetDate };
  } else if (lowerMessage.includes('tomorrow') || lowerMessage.includes('tmr')) {
    // FIXED: Use Singapore timezone
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const year = tomorrow.getFullYear();
    const month = tomorrow.getMonth();
    const day = tomorrow.getDate();
    targetDate = createTimezoneSafeDate(year, month, day);
    console.log('✅ Detected "tomorrow", calculated date:', targetDate);
    return { isScheduleQuery: true, targetDate };
  } else if (lowerMessage.includes('yesterday')) {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const year = yesterday.getFullYear();
    const month = yesterday.getMonth();
    const day = yesterday.getDate();
    targetDate = createTimezoneSafeDate(year, month, day);
    console.log('✅ Detected "yesterday", calculated date:', targetDate);
    return { isScheduleQuery: true, targetDate };
  }
  
  // 2. "1st July 2025", "2nd August 2025" with YEAR
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
      console.log('✅ Detected specific date with year:', targetDate);
      return { isScheduleQuery: true, targetDate };
    }
  }
  
  // 3. "July 1st 2025", "August 2nd 2025" with YEAR
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
      console.log('✅ Detected specific date with year (month first):', targetDate);
      return { isScheduleQuery: true, targetDate };
    }
  }
  
  // Fallback for general schedule queries
  console.log('✅ General schedule query, using today as default');
  return { isScheduleQuery: true, targetDate: 'today' };
}

// ========================================
// ENHANCED QUICK QUERY
// ========================================
async sendQuickQuery(query, specificDate = null) {
  console.log('🔍 Quick query triggered:', query, 'for date:', specificDate);
  
  // IMMEDIATE CACHE CLEARING FOR SCHEDULE QUERIES
  if (query === 'today schedule' || query === 'schedule') {
    console.log('🧹 Clearing all schedule caches for fresh data...');
    
    if (typeof scheduleCache !== 'undefined') {
      scheduleCache.clear();
    }
    
    if (typeof scheduleCache2 !== 'undefined') {
      scheduleCache2.data = null;
      scheduleCache2.timestamp = null;
    }
    
    console.log('✅ Schedule caches cleared for fresh query');
  }
  
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
              targetDate: specificDate || 'today',
              cacheBuster: Date.now() // Force fresh data
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
          console.log('🚨 Fetching urgent cases from database...');
          const urgentResponse = await fetch("/get-urgent-cases", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ 
              podiatristId: "current_podiatrist"
            })
          });
          const urgentResult = await urgentResponse.json();
          console.log('🚨 Urgent cases response:', urgentResult);
          if (urgentResult.success && urgentResult.urgentCases && urgentResult.urgentCases.length > 0) {
            scheduleData = { appointments: urgentResult.urgentCases };
            prompt = `**Upcoming Urgent Cases (${urgentResult.urgentCases.length} found):**\n\nFor each case, always include both the initial diagnosis and the case summary. The case summary must be shown word-for-word exactly as it appears in the database, with no changes or substitutions.\n\n${urgentResult.urgentCases.map((apt, index) => {
              let dateTime = apt.scheduledDate || apt.scheduledTime || 'N/A';
              let caseSummary = (typeof apt.summary === 'string' && apt.summary.trim() !== '') ? apt.summary : 'N/A';
              return `${index + 1}. **Patient:** ${apt.patientName || 'N/A'} (${apt.patientId || 'N/A'})\n   - **Scheduled:** ${dateTime}\n   - **Urgency:** ${apt.urgencyText || apt.urgencyLevel || 'N/A'}\n   - **Category:** ${apt.category || 'N/A'}\n   - **Diagnosis:** ${apt.initialDiagnosis || 'N/A'}\n   - **Case Summary:** ${caseSummary}`;
            }).join('\n')}\n\n---\nThis is a list of all upcoming urgent cases (urgency level 1 or 2, status: scheduled).`;
            console.log('✅ Generated prompt with real urgent cases data (summary is word-for-word from DB)');
          } else {
            console.log('✅ No urgent cases found in database');
            prompt = `No upcoming urgent cases (urgency level 1 or 2) are currently scheduled.`;
          }
        } catch (fetchError) {
          console.error('❌ Error fetching urgent cases:', fetchError);
          prompt = 'Unable to access urgent case data from the database. Please check system connectivity and try again.';
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
        podiatristId: this.sessionData?.userId || "current_podiatrist",
        podiatristName: this.sessionData ? 
          `${this.sessionData.firstName} ${this.sessionData.lastName}`.trim() : 
          'Unknown Doctor',
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

 // ADD MESSAGE TO CHAT - FIXED TO USE DYNAMIC DOCTOR NAME
addMessageToChat(message, sender, chatbox) {
  if (!chatbox) return;
  
  const messageDiv = document.createElement('div');
  messageDiv.className = sender === 'user' ? 'message-user' : 'message-bot';
  
  if (sender === 'user') {
    // GET DYNAMIC DOCTOR NAME FROM SESSION DATA
    const doctorName = this.sessionData ? 
      `${this.sessionData.firstName}`.trim() : 
      '[NAME]';
    
    messageDiv.innerHTML = `<strong>${doctorName}:</strong> ${message}`;
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