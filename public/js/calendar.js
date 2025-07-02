// ========================================
// DEDICATED CALENDAR MODULE
// Handles all calendar functionality separately
// ========================================

class PodiatristCalendar {
  constructor() {
    this.currentDate = new Date();
    this.currentView = 'month';
    this.appointments = [];
    this.isInitialized = false;
    
    // Bind methods to preserve 'this' context
    this.init = this.init.bind(this);
    this.filterAppointmentsByType = this.filterAppointmentsByType.bind(this);
    this.changeCalendarView = this.changeCalendarView.bind(this);
    this.navigateCalendar = this.navigateCalendar.bind(this);
    this.goToToday = this.goToToday.bind(this);
    this.resetCalendarFilters = this.resetCalendarFilters.bind(this);
  }

  // Initialize calendar when DOM is ready
  async init() {
    console.log('🗓️ Initializing Podiatrist Calendar...');
    
    if (this.isInitialized) {
      console.log('⚠️ Calendar already initialized');
      return;
    }

    try {
      await this.loadAppointments();
      this.setupEventListeners();
      this.setInitialState();
      this.isInitialized = true;
      console.log('✅ Calendar initialization completed successfully');
    } catch (error) {
      console.error('❌ Calendar initialization failed:', error);
    }
  }

  async loadAppointments() {
    const podId = "pod_1";//TODO: Make Id not fixed
    try {
      const res = await fetch("/podiatrist-get-calendar", { // Get patient queue
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ podId }) // Ensure podId is defined
      });

      // Get queue from database and assign to variable
      const data = await res.json();
      this.appointments = data.appointments || [];

    } catch (err) {
      console.error("❌ Failed to fetch patient details:", err);
    }
  console.log(`📅 Loaded ${this.appointments.length} sample appointments across multiple months`);
}

  // Setup all event listeners (SIMPLIFIED - removed unnecessary view controls)
  setupEventListeners() {
    console.log('🔗 Setting up calendar event listeners...');

    // Appointment type filter
    const appointmentTypeSelect = document.getElementById('appointmentType');
    if (appointmentTypeSelect) {
      appointmentTypeSelect.addEventListener('change', () => {
        console.log('🔍 Appointment type filter changed to:', appointmentTypeSelect.value);
        this.filterAppointmentsByType();
      });
      console.log('✅ Appointment type filter listener added');
    } else {
      console.error('❌ Appointment type selector not found');
    }

    // Month selector
    const monthSelector = document.getElementById('monthSelector');
    if (monthSelector) {
      monthSelector.addEventListener('change', () => {
        console.log('📅 Month changed to:', monthSelector.value);
        this.changeMonth();
      });
      console.log('✅ Month selector listener added');
    }

    // Year selector
    const yearSelector = document.getElementById('yearSelector');
    if (yearSelector) {
      yearSelector.addEventListener('change', () => {
        console.log('📅 Year changed to:', yearSelector.value);
        this.changeYear();
      });
      console.log('✅ Year selector listener added');
    }

    // Setup appointment click handlers
    this.setupAppointmentHandlers();
  }

  // Set initial state and generate initial calendar
  setInitialState() {
    const now = new Date();
    
    // Set current month and year in selectors
    const monthSelector = document.getElementById('monthSelector');
    const yearSelector = document.getElementById('yearSelector');
    
    if (monthSelector) {
      monthSelector.value = now.getMonth();
      console.log('✅ Month selector set to:', now.getMonth());
    }
    
    if (yearSelector) {
      yearSelector.value = now.getFullYear();
      console.log('✅ Year selector set to:', now.getFullYear());
    }

    this.currentDate = new Date(now);
    
    // Generate initial calendar
    this.generateCalendarForMonth(now.getMonth(), now.getFullYear());
  }

  // Setup appointment click handlers
  setupAppointmentHandlers() {
    console.log('🖱️ Setting up appointment click handlers...');
    
    // Add click handlers for existing calendar events
    const events = document.querySelectorAll('.calendar-event');
    console.log(`Found ${events.length} existing appointment events`);
    
    events.forEach((event, index) => {
      event.addEventListener('click', () => {
        const appointmentInfo = event.textContent;
        console.log(`Appointment ${index} clicked:`, appointmentInfo);
        this.showAppointmentDetails(appointmentInfo);
      });
    });
    
    // Add click handler for placeholder cells
    const placeholders = document.querySelectorAll('.calendar-placeholder');
    console.log(`Found ${placeholders.length} placeholder cells`);
    
    placeholders.forEach(placeholder => {
      placeholder.addEventListener('click', () => {
        console.log('Create new appointment clicked');
        this.showCreateAppointmentModal();
      });
    });
  }

  // MAIN FILTERING FUNCTION - COMPLETELY REWRITTEN
  filterAppointmentsByType() {
    const selectedType = document.getElementById('appointmentType')?.value || '';
    const events = document.querySelectorAll('.calendar-event');
    
    console.log(`🔍 FILTERING APPOINTMENTS:`);
    console.log(`  Selected type: "${selectedType}"`);
    console.log(`  Found ${events.length} calendar events to filter`);
    
    if (events.length === 0) {
      console.warn('⚠️ No calendar events found to filter');
      return;
    }
    
    let visibleCount = 0;
    let hiddenCount = 0;
    
    events.forEach((event, index) => {
      // Get all classes for debugging
      const classList = Array.from(event.classList);
      const eventText = event.textContent.trim();
      
      // Determine if this event should be visible
      let shouldShow = false;
      
      if (selectedType === '') {
        // Show all if no filter selected
        shouldShow = true;
      } else {
        // Check if event has the selected type class
        shouldShow = event.classList.contains(selectedType);
      }
      
      console.log(`Event ${index}: "${eventText}"`);
      console.log(`  Classes: [${classList.join(', ')}]`);
      console.log(`  Should show (${selectedType}): ${shouldShow}`);
      
      // Apply visibility
      if (shouldShow) {
        event.style.display = 'block';
        event.style.opacity = '1';
        visibleCount++;
        console.log(`  ✅ VISIBLE`);
      } else {
        event.style.display = 'none';
        event.style.opacity = '0';
        hiddenCount++;
        console.log(`  ❌ HIDDEN`);
      }
    });
    
    console.log(`🔍 FILTER RESULTS: ${visibleCount} visible, ${hiddenCount} hidden`);
    
    // Update UI feedback
    this.updateFilterFeedback(selectedType, visibleCount);
  }

  // Update filter feedback in UI
  updateFilterFeedback(filterType, visibleCount) {
    // You can add a feedback element to show filter results
    console.log(`📊 Filter applied: ${filterType || 'All'} (${visibleCount} appointments shown)`);
  }

  // Change calendar view
  changeCalendarView() {
    const view = document.getElementById('calendarView')?.value || 'month';
    const calendarGrid = document.getElementById('calendarGrid');
    
    if (!calendarGrid) {
      console.error('❌ Calendar grid not found');
      return;
    }
    
    console.log(`👁️ CHANGING VIEW to: ${view}`);
    
    // Remove existing view classes
    calendarGrid.classList.remove('week-view', 'day-view');
    
    // Apply new view styles
    switch (view) {
      case 'week':
        calendarGrid.classList.add('week-view');
        calendarGrid.style.gridAutoRows = 'minmax(200px, auto)';
        console.log('✅ Applied week view');
        break;
      case 'day':
        calendarGrid.classList.add('day-view');
        calendarGrid.style.gridTemplateColumns = '1fr';
        calendarGrid.style.gridAutoRows = 'minmax(300px, auto)';
        console.log('✅ Applied day view');
        break;
      default: // month
        calendarGrid.style.gridTemplateColumns = 'repeat(7, 1fr)';
        calendarGrid.style.gridAutoRows = 'minmax(140px, auto)';
        console.log('✅ Applied month view');
        break;
    }
    
    this.currentView = view;
  }

  // Change month - Now properly updates calendar display
  changeMonth() {
    const selectedMonth = parseInt(document.getElementById('monthSelector')?.value || '0');
    const selectedYear = parseInt(document.getElementById('yearSelector')?.value || '2025');
    
    this.currentDate = new Date(selectedYear, selectedMonth, 1);
    console.log(`📅 Changed to: ${this.getMonthName(selectedMonth)} ${selectedYear}`);
    
    // Update the calendar display
    this.generateCalendarForMonth(selectedMonth, selectedYear);
    this.onDateChange();
  }

  // Change year - Now properly updates calendar display
  changeYear() {
    const selectedMonth = parseInt(document.getElementById('monthSelector')?.value || '0');
    const selectedYear = parseInt(document.getElementById('yearSelector')?.value || '2025');
    
    this.currentDate = new Date(selectedYear, selectedMonth, 1);
    console.log(`📅 Changed to: ${this.getMonthName(selectedMonth)} ${selectedYear}`);
    
    // Update the calendar display
    this.generateCalendarForMonth(selectedMonth, selectedYear);
    this.onDateChange();
  }

  // Navigate calendar (prev/next) - Now properly updates calendar display
  navigateCalendar(direction) {
    console.log(`🧭 Navigating ${direction}`);
    
    if (direction === 'prev') {
      this.currentDate.setMonth(this.currentDate.getMonth() - 1);
    } else if (direction === 'next') {
      this.currentDate.setMonth(this.currentDate.getMonth() + 1);
    }
    
    // Update selectors
    const monthSelector = document.getElementById('monthSelector');
    const yearSelector = document.getElementById('yearSelector');
    
    if (monthSelector) monthSelector.value = this.currentDate.getMonth();
    if (yearSelector) yearSelector.value = this.currentDate.getFullYear();
    
    console.log(`🧭 Navigated to: ${this.getMonthName(this.currentDate.getMonth())} ${this.currentDate.getFullYear()}`);
    
    // Update the calendar display
    this.generateCalendarForMonth(this.currentDate.getMonth(), this.currentDate.getFullYear());
    this.onDateChange();
  }

  // Go to today - Now properly updates calendar display
  goToToday() {
    this.currentDate = new Date();
    
    // Update selectors
    const monthSelector = document.getElementById('monthSelector');
    const yearSelector = document.getElementById('yearSelector');
    
    if (monthSelector) monthSelector.value = this.currentDate.getMonth();
    if (yearSelector) yearSelector.value = this.currentDate.getFullYear();
    
    console.log('📅 Navigated to today:', this.currentDate.toDateString());
    
    // Update the calendar display
    this.generateCalendarForMonth(this.currentDate.getMonth(), this.currentDate.getFullYear());
    this.onDateChange();
  }

  // Reset all calendar filters - FIXED to prevent infinite loop
  resetCalendarFilters() {
    console.log('🔄 RESETTING all calendar filters...');
    
    // Reset filter selectors
    const appointmentType = document.getElementById('appointmentType');
    
    if (appointmentType) appointmentType.value = '';
    
    // Reset to current date
    const now = new Date();
    const monthSelector = document.getElementById('monthSelector');
    const yearSelector = document.getElementById('yearSelector');
    
    if (monthSelector) monthSelector.value = now.getMonth();
    if (yearSelector) yearSelector.value = now.getFullYear();
    
    this.currentDate = new Date(now);
    
    // Generate calendar for current month (without calling resetCalendarFilters again)
    this.generateCalendarForMonth(now.getMonth(), now.getFullYear());
    
    // Show all appointments
    const events = document.querySelectorAll('.calendar-event');
    events.forEach(event => {
      event.style.display = 'block';
      event.style.opacity = '1';
    });
    
    console.log('✅ Calendar filters reset successfully');
  }

  // NEW: Generate calendar for specific month and year with month/year header
  generateCalendarForMonth(month, year) {
    console.log(`🗓️ Generating calendar for ${this.getMonthName(month)} ${year}`);
    
    const calendarGrid = document.getElementById('calendarGrid');
    if (!calendarGrid) {
      console.error('❌ Calendar grid not found');
      return;
    }
    
    // Update month/year header
    this.updateCalendarHeader(month, year);
    
    // Clear existing calendar
    calendarGrid.innerHTML = '';
    
    // Get first day of month and number of days
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay(); // 0 = Sunday, 1 = Monday, etc.
    
    // Adjust for Monday start (0 = Monday, 6 = Sunday)
    const mondayStartOffset = startingDayOfWeek === 0 ? 6 : startingDayOfWeek - 1;
    
    // Previous month days to fill beginning
    const prevMonth = month === 0 ? 11 : month - 1;
    const prevYear = month === 0 ? year - 1 : year;
    const prevMonthDays = new Date(prevYear, prevMonth + 1, 0).getDate();
    
    // Add previous month's trailing days
    for (let i = mondayStartOffset - 1; i >= 0; i--) {
      const dayNum = prevMonthDays - i;
      const cell = this.createCalendarCell(dayNum, prevMonth, prevYear, true);
      calendarGrid.appendChild(cell);
    }
    
    // Add current month days
    for (let day = 1; day <= daysInMonth; day++) {
      const cell = this.createCalendarCell(day, month, year, false);
      calendarGrid.appendChild(cell);
    }
    
    // Add next month days to fill the grid (complete weeks)
    const totalCells = calendarGrid.children.length;
    const cellsNeeded = 42; // 6 weeks * 7 days
    const nextMonth = month === 11 ? 0 : month + 1;
    const nextYear = month === 11 ? year + 1 : year;
    
    for (let day = 1; totalCells + day - 1 < cellsNeeded; day++) {
      const cell = this.createCalendarCell(day, nextMonth, nextYear, true);
      calendarGrid.appendChild(cell);
    }
    
    // Add appointments for this month
    this.addAppointmentsToCalendar(month, year);
    
    console.log(`✅ Calendar generated with ${calendarGrid.children.length} cells`);
  }
  
  // NEW: Update calendar header with month and year
  updateCalendarHeader(month, year) {
    // Try to find existing header or create one
    let headerElement = document.getElementById('calendarMonthHeader');
    
    if (!headerElement) {
      // Create header if it doesn't exist
      headerElement = document.createElement('div');
      headerElement.id = 'calendarMonthHeader';
      headerElement.className = 'calendar-month-header';
      
      // Insert before calendar container
      const calendarContainer = document.querySelector('.calendar-container');
      if (calendarContainer) {
        calendarContainer.insertBefore(headerElement, calendarContainer.firstChild);
      }
    }
    
    // Update header content
    const monthName = this.getMonthName(month);
    headerElement.innerHTML = `
      <h2 class="calendar-header-title">${monthName} ${year}</h2>
      <div class="calendar-header-info">
        <span class="today-indicator">📅 Today: ${new Date().toLocaleDateString('en-SG', { 
          weekday: 'long', 
          year: 'numeric', 
          month: 'long', 
          day: 'numeric' 
        })}</span>
      </div>
    `;
    
    console.log(`📅 Calendar header updated: ${monthName} ${year}`);
  }
  
  // NEW: Create a calendar cell with today highlighting
  createCalendarCell(day, month, year, isOtherMonth = false) {
    const cell = document.createElement('div');
    cell.className = 'calendar-cell';
    
    if (isOtherMonth) {
      cell.classList.add('month-transition');
    }
    
    const dateDiv = document.createElement('div');
    dateDiv.className = 'calendar-date';
    dateDiv.textContent = day;
    
    // Highlight today's date
    const today = new Date();
    const isToday = !isOtherMonth && 
                   day === today.getDate() && 
                   month === today.getMonth() && 
                   year === today.getFullYear();
    
    if (isToday) {
      cell.classList.add('today');
      dateDiv.classList.add('today-date');
      console.log(`🌟 Today highlighted: ${day}/${month + 1}/${year}`);
    }
    
    cell.appendChild(dateDiv);
    
    // Add month label for first day of month transitions
    if (day === 1 && isOtherMonth) {
      const monthLabel = document.createElement('div');
      monthLabel.className = 'month-label';
      monthLabel.textContent = this.getMonthName(month).substring(0, 3); // Short month name
      cell.appendChild(monthLabel);
    }
    
    return cell;
  }
  
  // NEW: Add appointments to calendar for specific month
  addAppointmentsToCalendar(month, year) {
    // Filter appointments for this month/year
    const monthlyAppointments = this.appointments.filter(apt => {
      const aptDate = new Date(apt.date);
      return aptDate.getMonth() === month && aptDate.getFullYear() === year;
    });
    
    console.log(`📅 Adding ${monthlyAppointments.length} appointments for ${this.getMonthName(month)} ${year}`);
    
    monthlyAppointments.forEach(appointment => {
      const aptDate = new Date(appointment.date);
      const dayOfMonth = aptDate.getDate();
      
      // Find the corresponding calendar cell
      const cells = document.querySelectorAll('.calendar-cell:not(.month-transition)');
      const targetCell = Array.from(cells).find(cell => {
        const dateDiv = cell.querySelector('.calendar-date');
        return dateDiv && parseInt(dateDiv.textContent) === dayOfMonth;
      });
      
      if (targetCell) {
        const eventDiv = document.createElement('div');
        eventDiv.className = `calendar-event ${appointment.type}`;
        eventDiv.textContent = appointment.time + " " + appointment.patient;
        eventDiv.addEventListener('click', () => {
        this.showAppointmentDetailsWithEdit(appointment.time + " " + appointment.patient, appointment.id);
      });
        
        targetCell.appendChild(eventDiv);
      }
    });
  }

  // Called when date changes to trigger any updates
  onDateChange() {
    // Here you can add logic to:
    // - Refresh appointments for the new date range
    // - Update calendar display
    // - Trigger any other date-dependent updates
    console.log('📅 Date changed, triggering updates...');
  }

  // Helper function to get month name
  getMonthName(monthIndex) {
    const months = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    return months[monthIndex] || 'Unknown';
  }

  // Show appointment details
  showAppointmentDetails(appointmentInfo) {
    alert(`Appointment Details:\n${appointmentInfo}\n\nFeatures coming soon:\n- View patient history\n- Reschedule appointment\n- Add notes`);
  }

  // Show appointment details with edit option
  showAppointmentDetailsWithEdit(appointmentInfo, appointmentId) {
    const detailsModal = `
      <div id="appointmentDetailsModal" class="edit-modal-overlay">
        <div class="edit-modal-content">
          <div class="edit-modal-header">
            <h3>📋 Appointment Details</h3>
            <button class="edit-modal-close" onclick="closeAppointmentDetailsModal()">✕</button>
          </div>
          <div class="edit-modal-body">
            <div class="appointment-details">
              <p><strong>📅 Appointment:</strong> ${appointmentInfo}</p>
              <p><strong>🆔 ID:</strong> ${appointmentId || 'N/A'}</p>
            </div>
          </div>
          <div class="edit-modal-footer">
            <button class="medical-btn medical-btn-secondary" onclick="closeAppointmentDetailsModal()">❌ Close</button>
            <button class="medical-btn medical-btn-primary" onclick="editAppointment('${appointmentInfo}', '${appointmentId}')">✏️ Edit Appointment</button>
          </div>
        </div>
      </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', detailsModal);
  }

  // Close appointment details modal
  closeAppointmentDetailsModal() {
    const modal = document.getElementById('appointmentDetailsModal');
    if (modal) {
      modal.remove();
    }
  }

  // Edit appointment function
  editAppointment(appointmentInfo, appointmentId) {
    this.closeAppointmentDetailsModal();
    this.showEditAppointmentModal(appointmentInfo, appointmentId);
  }
  // Show create appointment modal
  showCreateAppointmentModal() {
    alert('Create New Appointment\n\nFeatures coming soon:\n- Select patient\n- Choose time slot\n- Set appointment type\n- Add notes');
  }

  // Test all calendar functions
  testAllFunctions() {
    console.log('🧪 TESTING all calendar functions...');
    
    console.log('Testing filtering...');
    this.filterAppointmentsByType();
    
    console.log('Testing view changes...');
    this.changeCalendarView();
    
    console.log('Testing navigation...');
    // this.navigateCalendar('next');
    // this.navigateCalendar('prev');
    
    console.log('✅ Calendar testing completed');
  }

  // Get calendar status for debugging
  getStatus() {
    return {
      initialized: this.isInitialized,
      currentDate: this.currentDate.toDateString(),
      currentView: this.currentView,
      appointmentsCount: this.appointments.length,
      calendarGridExists: !!document.getElementById('calendarGrid'),
      selectorsExist: {
        month: !!document.getElementById('monthSelector'),
        year: !!document.getElementById('yearSelector'),
        appointmentType: !!document.getElementById('appointmentType'),
        calendarView: !!document.getElementById('calendarView')
      }
    };
  }
// ========================================
// APPOINTMENT EDITING FUNCTIONALITY
// Add this to calendar.js inside PodiatristCalendar class
// ========================================

// Show appointment edit modal
showEditAppointmentModal(appointmentInfo, appointmentId = null) {
  console.log('📝 Opening edit modal for:', appointmentInfo);
  
  // Extract appointment details if it's from a calendar event
  let patientName = '';
  let currentTime = '';
  let appointmentType = '';
  
  if (typeof appointmentInfo === 'string') {
    // Parse the appointment string format: "👨‍⚕️ 09:00 - John Doe"
    const match = appointmentInfo.match(/([🩹👨‍⚕️🔄🏥]+)\s*(\d{2}:\d{2})\s*-\s*(.+)/);
    if (match) {
      const emoji = match[1];
      currentTime = match[2];
      patientName = match[3];
      
      // Map emoji to appointment type
      if (emoji.includes('👨‍⚕️')) appointmentType = 'consultation';
      else if (emoji.includes('🔄')) appointmentType = 'follow-up';
      else if (emoji.includes('🏥')) appointmentType = 'surgery';
      else if (emoji.includes('🩹')) appointmentType = 'wound-care';
    }
  }
  
  // Create modal HTML
  const modalHTML = `
    <div id="editAppointmentModal" class="edit-modal-overlay">
      <div class="edit-modal-content">
        <div class="edit-modal-header">
          <h3>📝 Edit Appointment</h3>
          <button class="edit-modal-close" onclick="closeEditAppointmentModal()">✕</button>
        </div>
        <div class="edit-modal-body">
          <div class="form-group">
            <label class="medical-label">👤 Patient Name:</label>
            <input type="text" id="editPatientName" class="medical-input" value="${patientName}" readonly>
          </div>
          
          <div class="form-group">
            <label class="medical-label">📅 New Date:</label>
            <input type="date" id="editAppointmentDate" class="medical-input" required>
          </div>
          
          <div class="form-group">
            <label class="medical-label">⏰ New Time:</label>
            <input type="time" id="editAppointmentTime" class="medical-input" value="${currentTime}" required>
          </div>
          
          <div class="form-group">
            <label class="medical-label">📋 Appointment Type:</label>
            <select id="editAppointmentType" class="medical-select" required>
              <option value="consultation" ${appointmentType === 'consultation' ? 'selected' : ''}>👨‍⚕️ Consultation</option>
              <option value="follow-up" ${appointmentType === 'follow-up' ? 'selected' : ''}>🔄 Follow-up</option>
              <option value="surgery" ${appointmentType === 'surgery' ? 'selected' : ''}>🏥 Surgery</option>
              <option value="wound-care" ${appointmentType === 'wound-care' ? 'selected' : ''}>🩹 Wound Care</option>
            </select>
          </div>
          
          <div class="form-group">
            <label class="medical-label">💭 Reason for Change (Optional):</label>
            <textarea id="editReason" class="medical-input" rows="3" placeholder="Enter reason for rescheduling..."></textarea>
          </div>
        </div>
        <div class="edit-modal-footer">
          <button class="medical-btn medical-btn-secondary" onclick="closeEditAppointmentModal()">❌ Cancel</button>
          <button class="medical-btn medical-btn-primary" onclick="saveAppointmentChanges('${appointmentId || 'unknown'}', '${patientName}')">💾 Save Changes</button>
        </div>
      </div>
    </div>
  `;
  
  // Add modal to page
  document.body.insertAdjacentHTML('beforeend', modalHTML);
  
  // Set default date to today
  const today = new Date().toISOString().split('T')[0];
  document.getElementById('editAppointmentDate').value = today;
  
  // Focus on date field
  setTimeout(() => {
    document.getElementById('editAppointmentDate').focus();
  }, 100);
}

// Close edit modal
closeEditAppointmentModal() {
  const modal = document.getElementById('editAppointmentModal');
  if (modal) {
    modal.remove();
  }
}

// Save appointment changes
async saveAppointmentChanges(appointmentId, patientName) {
  const newDate = document.getElementById('editAppointmentDate').value;
  const newTime = document.getElementById('editAppointmentTime').value;
  const newType = document.getElementById('editAppointmentType').value;
  const reason = document.getElementById('editReason').value;
  
  if (!newDate || !newTime) {
    alert('⚠️ Please fill in all required fields (date and time)');
    return;
  }
  
  console.log('💾 Saving appointment changes:', {
    appointmentId,
    patientName,
    newDate,
    newTime,
    newType,
    reason
  });
  
  // Show loading state
  const saveBtn = event.target;
  const originalText = saveBtn.textContent;
  saveBtn.textContent = '⏳ Saving...';
  saveBtn.disabled = true;
  
  try {
    // Here you would call your backend API to update the appointment
    // For now, we'll simulate the API call
    await this.updateAppointmentInDatabase(appointmentId, {
      patientName,
      newDate,
      newTime,
      newType,
      reason
    });
    
    // Show success message
    this.showSuccessMessage(`✅ Appointment updated successfully!\n\nNew Details:\n📅 Date: ${newDate}\n⏰ Time: ${newTime}\n📋 Type: ${newType}`);
    
    // Close modal
    this.closeEditAppointmentModal();
    
    // Refresh calendar to show changes
    this.generateCalendarForMonth(this.currentDate.getMonth(), this.currentDate.getFullYear());
    
  } catch (error) {
    console.error('❌ Error updating appointment:', error);
    alert('❌ Failed to update appointment. Please try again.');
  } finally {
    // Restore button state
    saveBtn.textContent = originalText;
    saveBtn.disabled = false;
  }
}

// Simulate database update (replace with actual API call)
async updateAppointmentInDatabase(appointmentId, updateData) {
  console.log('🔄 Simulating database update...');
  
  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // Here you would make an actual API call to your server
  // Example:
  /*
  const response = await fetch('/api/update-appointment', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      appointmentId,
      ...updateData
    })
  });
  
  if (!response.ok) {
    throw new Error('Failed to update appointment');
  }
  
  return await response.json();
  */
  
  // For demo purposes, we'll just log the update
  console.log('📅 Appointment updated in database (not actually updated into db , no db logic yet):', updateData);
}

// Show success message
showSuccessMessage(message) {
  const successModal = `
    <div id="successModal" class="edit-modal-overlay">
      <div class="edit-modal-content success-modal">
        <div class="edit-modal-header success-header">
          <h3>✅ Success</h3>
        </div>
        <div class="edit-modal-body">
          <p style="white-space: pre-line;">${message}</p>
        </div>
        <div class="edit-modal-footer">
          <button class="medical-btn medical-btn-primary" onclick="closeSuccessModal()">👍 OK</button>
        </div>
      </div>
    </div>
  `;
  
  document.body.insertAdjacentHTML('beforeend', successModal);
  
  // Auto-close after 3 seconds
  setTimeout(() => {
    this.closeSuccessModal();
  }, 3000);
}

// Close success modal
closeSuccessModal() {
  const modal = document.getElementById('successModal');
  if (modal) {
    modal.remove();
  }
}

}

// Create global calendar instance and make it globally accessible
const podiatristCalendar = new PodiatristCalendar();
window.podiatristCalendar = podiatristCalendar;

// Global functions that the HTML can call - FIXED VERSION
window.filterAppointmentsByType = function() {
  console.log('🔍 filterAppointmentsByType called');
  if (window.podiatristCalendar && window.podiatristCalendar.isInitialized) {
    podiatristCalendar.filterAppointmentsByType();
  } else {
    console.error('❌ Calendar not initialized yet');
  }
};

window.navigateCalendar = function(direction) {
  console.log('🧭 navigateCalendar called with direction:', direction);
  if (window.podiatristCalendar && window.podiatristCalendar.isInitialized) {
    podiatristCalendar.navigateCalendar(direction);
  } else {
    console.error('❌ Calendar not initialized yet');
  }
};

window.goToToday = function() {
  console.log('📅 goToToday called');
  if (window.podiatristCalendar && window.podiatristCalendar.isInitialized) {
    podiatristCalendar.goToToday();
  } else {
    console.error('❌ Calendar not initialized yet');
  }
};

window.resetCalendarFilters = function() {
  console.log('🔄 resetCalendarFilters called');
  if (window.podiatristCalendar && window.podiatristCalendar.isInitialized) {
    podiatristCalendar.resetCalendarFilters();
  } else {
    console.error('❌ Calendar not initialized yet');
  }
};

window.testCalendarFunctions = function() {
  console.log('🧪 testCalendarFunctions called');
  if (window.podiatristCalendar && window.podiatristCalendar.isInitialized) {
    podiatristCalendar.testAllFunctions();
  } else {
    console.error('❌ Calendar not initialized yet');
  }
};

window.getCalendarStatus = function() {
  if (window.podiatristCalendar) {
    return podiatristCalendar.getStatus();
  } else {
    return { error: 'Calendar not initialized' };
  }
};

// Initialize when DOM is ready - IMPROVED VERSION
document.addEventListener('DOMContentLoaded', function() {
  console.log('📄 DOM Content Loaded - Starting calendar initialization...');
  
  // Small delay to ensure all elements are ready
  setTimeout(() => {
    if (window.podiatristCalendar) {
      podiatristCalendar.init();
      console.log('✅ Calendar initialization triggered from DOMContentLoaded');
    } else {
      console.error('❌ Calendar instance not found');
    }
  }, 100);
});

// Initialize immediately if DOM is already loaded - IMPROVED VERSION
if (document.readyState === 'loading') {
  console.log('📄 Document still loading, waiting for DOMContentLoaded...');
  // Still loading, wait for DOMContentLoaded
} else {
  console.log('📄 Document already loaded, initializing calendar immediately...');
  // DOM already loaded
  setTimeout(() => {
    if (window.podiatristCalendar) {
      podiatristCalendar.init();
      console.log('✅ Calendar initialization triggered immediately');
    } else {
      console.error('❌ Calendar instance not found');
    }
  }, 100);
}

// Add debugging function to test button functionality
window.debugCalendarButtons = function() {
  console.log('🔧 Testing calendar button functions...');
  
  console.log('Testing resetCalendarFilters...');
  try {
    window.resetCalendarFilters();
    console.log('✅ resetCalendarFilters works');
  } catch (error) {
    console.error('❌ resetCalendarFilters failed:', error);
  }
  
  console.log('Testing navigateCalendar(prev)...');
  try {
    window.navigateCalendar('prev');
    console.log('✅ navigateCalendar(prev) works');
  } catch (error) {
    console.error('❌ navigateCalendar(prev) failed:', error);
  }
  
  console.log('Testing goToToday...');
  try {
    window.goToToday();
    console.log('✅ goToToday works');
  } catch (error) {
    console.error('❌ goToToday failed:', error);
  }
  
  console.log('🔧 Calendar button testing complete');
};

// Export for module usage if needed
if (typeof module !== 'undefined' && module.exports) {
  module.exports = PodiatristCalendar;
}

// Make edit functions globally available
window.closeEditAppointmentModal = function() {
  if (window.podiatristCalendar && window.podiatristCalendar.isInitialized) {
    podiatristCalendar.closeEditAppointmentModal();
  }
};

window.saveAppointmentChanges = function(appointmentId, patientName) {
  if (window.podiatristCalendar && window.podiatristCalendar.isInitialized) {
    podiatristCalendar.saveAppointmentChanges(appointmentId, patientName);
  }
};

window.closeAppointmentDetailsModal = function() {
  if (window.podiatristCalendar && window.podiatristCalendar.isInitialized) {
    podiatristCalendar.closeAppointmentDetailsModal();
  }
};

window.editAppointment = function(appointmentInfo, appointmentId) {
  if (window.podiatristCalendar && window.podiatristCalendar.isInitialized) {
    podiatristCalendar.editAppointment(appointmentInfo, appointmentId);
  }
};

window.closeSuccessModal = function() {
  if (window.podiatristCalendar && window.podiatristCalendar.isInitialized) {
    podiatristCalendar.closeSuccessModal();
  }
};