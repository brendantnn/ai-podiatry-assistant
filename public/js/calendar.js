// ========================================
// DEDICATED CALENDAR MODULE
// Handles all calendar functionality separately
// ========================================

class PodiatristCalendar {
  constructor() {
    this.currentDate = new Date();
    this.currentView = 'month';
    this.appointments = [];
    this.availabilities = [];
    this.isInitialized = false;
    
    // Bind methods to preserve 'this' context
    this.init = this.init.bind(this);
    this.filterAppointmentsByType = this.filterAppointmentsByType.bind(this);
    this.changeCalendarView = this.changeCalendarView.bind(this);
    this.navigateCalendar = this.navigateCalendar.bind(this);
    this.goToToday = this.goToToday.bind(this);
    this.resetCalendarFilters = this.resetCalendarFilters.bind(this);
  }

  // // FUNCTION TO GET CURRENT USER'S POD ID
  // getCurrentPodId() {
  //   // First try to get from sessionStorage (manual login)
  //   const sessionPodId = sessionStorage.getItem('currentPodId');
  //   if (sessionPodId) {
  //     console.log('✅ Calendar using pod ID from session:', sessionPodId);
  //     return sessionPodId;
  //   }
    
  //   // Fallback to check if stored during login
  //   const storedUser = sessionStorage.getItem('currentUser');
  //   if (storedUser) {
  //     try {
  //       const userData = JSON.parse(storedUser);
  //       if (userData.podId) {
  //         console.log('✅ Calendar using pod ID from stored user:', userData.podId);
  //         return userData.podId;
  //       }
  //     } catch (e) {
  //       console.error('Error parsing stored user data:', e);
  //     }
  //   }
    
  //   // Last fallback to pod_1 (for backward compatibility)
  //   console.log('⚠️ Calendar: No pod ID found, falling back to pod_1');
  //   return "pod_1";
  // }
  // REPLACE the getCurrentPodId() method in your PodiatristCalendar class with this FIXED version

// FUNCTION TO GET CURRENT USER'S POD ID
getCurrentPodId() {
  console.log('🔍 Calendar getCurrentPodId() called');
  
  // Method 1: Check for directly stored pod ID
  const sessionPodId = sessionStorage.getItem('currentPodId');
  console.log('Method 1 - Calendar sessionStorage currentPodId:', sessionPodId);
  if (sessionPodId) {
    console.log('✅ Calendar using pod ID from session:', sessionPodId);
    return sessionPodId;
  }
  
  // Method 2: Check stored user data (JSON format)
  const storedUser = sessionStorage.getItem('currentUser');
  console.log('Method 2 - Calendar sessionStorage currentUser:', storedUser);
  if (storedUser && storedUser !== 'null') {
    try {
      const userData = JSON.parse(storedUser);
      console.log('Calendar parsed user data:', userData);
      if (userData.podId) {
        console.log('✅ Calendar using pod ID from stored user:', userData.podId);
        return userData.podId;
      }
      if (userData.userId) {
        console.log('✅ Calendar using userId as pod ID:', userData.userId);
        return userData.userId;
      }
    } catch (e) {
      console.error('Calendar error parsing stored user data:', e);
    }
  }
  
  // Method 3: Check for userId stored as individual key (YOUR CASE!)
  const userIdFromSession = sessionStorage.getItem('userId');
  console.log('Method 3 - Calendar direct userId from session:', userIdFromSession);
  if (userIdFromSession && userIdFromSession.includes('pod_')) {
    console.log('✅ Calendar found pod ID in userId session key:', userIdFromSession);
    return userIdFromSession;
  }
  
  // Method 4: Check if there's any login info stored under different keys
  console.log('Method 4 - Calendar checking all sessionStorage keys for pod info:');
  for (let i = 0; i < sessionStorage.length; i++) {
    const key = sessionStorage.key(i);
    const value = sessionStorage.getItem(key);
    
    // Check specific keys that might contain pod info
    if (key === 'userId' && value && value.includes('pod_')) {
      console.log(`✅ Calendar found pod ID in ${key}:`, value);
      return value;
    }
    
    // Check if any key contains pod information
    if (key.toLowerCase().includes('pod')) {
      console.log(`Calendar checking pod-related key: ${key} = ${value}`);
      if (value && value.includes('pod_')) {
        console.log(`✅ Calendar found pod ID in ${key}:`, value);
        return value;
      }
    }
    
    // Check for JSON values that might contain pod info
    if (value && value.includes('pod_')) {
      try {
        const parsedValue = JSON.parse(value);
        if (parsedValue.podId) {
          console.log(`✅ Calendar found podId in ${key}:`, parsedValue.podId);
          return parsedValue.podId;
        }
        if (parsedValue.userId && parsedValue.userId.includes('pod_')) {
          console.log(`✅ Calendar found pod in userId from ${key}:`, parsedValue.userId);
          return parsedValue.userId;
        }
      } catch (e) {
        // Not JSON, check if it's a direct pod ID
        if (value.includes('pod_')) {
          console.log(`✅ Calendar found pod ID in ${key}:`, value);
          return value;
        }
      }
    }
  }
  
  // Method 5: Check URL parameters (if pod ID is passed in URL)
  const urlParams = new URLSearchParams(window.location.search);
  const urlPodId = urlParams.get('podId') || urlParams.get('pod');
  console.log('Method 5 - Calendar URL params pod ID:', urlPodId);
  if (urlPodId) {
    console.log('✅ Calendar using pod ID from URL:', urlPodId);
    // Store it for future use
    sessionStorage.setItem('currentPodId', urlPodId);
    return urlPodId;
  }
  
  // Last fallback
  console.log('⚠️ Calendar: No pod ID found anywhere, falling back to pod_1');
  return "pod_1";
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
      // await this.loadAvailabilities();
      this.setupEventListeners();
      this.setInitialState();
      this.isInitialized = true;
      console.log('✅ Calendar initialization completed successfully');
    } catch (error) {
      console.error('❌ Calendar initialization failed:', error);
    }
  }

  async loadAppointments() {
    const podId = this.getCurrentPodId();//TODO: Make Id not fixed
    try {
      const res = await fetch("/podiatrist-get-appointments-scheduled", { // Get patient queue
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

  async loadAvailabilities() {//If need can add the pre edit datetime as argument to put in list as a default
    const podId = this.getCurrentPodId();//TODO: Make Id not fixed
    try {
      const res = await fetch("/podiatrist-get-availability", { // Get patient queue
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ podId }) // Ensure podId is defined
      });

      // Get queue from database and assign to variable
      const data = await res.json();
      this.availabilities = data.availabilities || [];

    } catch (err) {
      console.error("❌ Failed to fetch patient details:", err);
    }
    console.log(`📅 Loaded ${this.availabilities.length} sample appointments across multiple months`);
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
        eventDiv.className = `calendar-event ${appointment.category}`;
        eventDiv.textContent = appointment.time + " " + appointment.patient;
        eventDiv.addEventListener('click', () => {
        // Store additional appointment data for the popup
        const appointmentDataForPopup = {
          urgencyLevel: appointment.urgencyLevel || 3,
          category: appointment.category || 'General',
          summary: appointment.summary || appointment.initialDiagnosis || 'No case summary available',
          initialDiagnosis: appointment.initialDiagnosis || 'Assessment pending'
        };
        
        // Temporarily store this data on the calendar instance
        this.currentAppointmentData = appointmentDataForPopup;
        
        this.showAppointmentDetailsWithEdit(
          appointment.patient, 
          appointment.date, 
          appointment.time, 
          appointment.patientId, 
          appointment.apptId
        );
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

  // // Show appointment details with edit option
  // showAppointmentDetailsWithEdit(appointmentPatient, appointmentDate, appointmentTime, patientId, appointmentId) {
  //   const detailsModal = `
  //     <div id="appointmentDetailsModal" class="edit-modal-overlay">
  //       <div class="edit-modal-content">
  //         <div class="edit-modal-header">
  //           <h3>📋 Appointment Details</h3>
  //           <button class="edit-modal-close" onclick="closeAppointmentDetailsModal()">✕</button>
  //         </div>
  //         <div class="edit-modal-body">
  //           <div class="appointment-details">
  //             <p><strong>📅 Appointment:</strong> ${appointmentPatient+": "+appointmentDate+" "+appointmentTime}</p>
  //             <p><strong>🆔 Patient ID:</strong> ${patientId || 'N/A'}</p>
  //           </div>
  //         </div>
  //         <div class="edit-modal-footer">
  //           <button class="medical-btn medical-btn-secondary" onclick="closeAppointmentDetailsModal()">❌ Close</button>
  //           <button class="medical-btn medical-btn-primary" onclick="editAppointment('${appointmentPatient}', '${appointmentDate}', '${appointmentTime}', '${patientId}', '${appointmentId}')">✏️ Edit Appointment</button>
  //         </div>
  //       </div>
  //     </div>
  //   `;
    
    
  //   document.body.insertAdjacentHTML('beforeend', detailsModal);
  // }

// Show appointment details with edit option
showAppointmentDetailsWithEdit(appointmentPatient, appointmentDate, appointmentTime, patientId, appointmentId) {
  // Get additional appointment data from stored data first
  let appointmentData = this.currentAppointmentData;

  // If no stored data, try to find from appointments array
  if (!appointmentData && this.appointments && this.appointments.length > 0) {
    const foundAppointment = this.appointments.find(apt => 
      apt.apptId === appointmentId || 
      (apt.patientId === patientId && apt.date === appointmentDate && apt.time === appointmentTime) ||
      (apt.patient === appointmentPatient && apt.date === appointmentDate && apt.time === appointmentTime)
    );
    
    if (foundAppointment) {
      appointmentData = {
        urgencyLevel: foundAppointment.urgencyLevel || 3,
        category: foundAppointment.category || 'General',
        summary: foundAppointment.summary || foundAppointment.initialDiagnosis || 'No case summary available',
        initialDiagnosis: foundAppointment.initialDiagnosis || 'Assessment pending'
      };
      console.log('✅ Found appointment data:', appointmentData);
    }
  }
  
  // Clear the stored data after use
  this.currentAppointmentData = null;
  
  // Fallback data if nothing found
  if (!appointmentData) {
    console.log('⚠️ Using fallback appointment data');
    appointmentData = {
      urgencyLevel: 3,
      category: 'General',
      summary: 'No case summary available from database',
      initialDiagnosis: 'Assessment pending'
    };
  }
  
  // Get urgency info
  const urgencyText = this.getUrgencyText(appointmentData.urgencyLevel || 3);
  const urgencyBadgeClass = this.getUrgencyBadgeClass(appointmentData.urgencyLevel || 3);
  
  const detailsModal = `
    <div id="appointmentDetailsModal" class="edit-modal-overlay">
      <div class="edit-modal-content">
        <div class="edit-modal-header">
          <h3>📋 Appointment Details</h3>
          <button class="edit-modal-close" onclick="closeAppointmentDetailsModal()">✕</button>
        </div>
        <div class="edit-modal-body">
          <div class="appointment-details">
            <!-- Patient Information -->
            <div style="background: var(--blue-50); padding: var(--space-4); border-radius: var(--radius-lg); border: 1px solid var(--blue-200); margin-bottom: var(--space-4);">
              <h4 style="color: var(--blue-700); margin: 0 0 var(--space-3) 0; font-size: 1rem;">👤 Patient Information</h4>
              <p style="margin: var(--space-2) 0;"><strong>Patient:</strong> ${appointmentPatient}</p>
              <p style="margin: var(--space-2) 0;"><strong>Patient ID:</strong> ${patientId || 'N/A'}</p>
            </div>
            
            <!-- Appointment Details -->
            <div style="background: var(--cream-50); padding: var(--space-4); border-radius: var(--radius-lg); border: 1px solid var(--cream-200); margin-bottom: var(--space-4);">
              <h4 style="color: var(--gray-700); margin: 0 0 var(--space-3) 0; font-size: 1rem;">📅 Appointment Schedule</h4>
              <p style="margin: var(--space-2) 0;"><strong>Date:</strong> ${appointmentDate}</p>
              <p style="margin: var(--space-2) 0;"><strong>Time:</strong> ${appointmentTime}</p>
            </div>
            
            <!-- Clinical Information -->
            <div style="background: var(--gray-50); padding: var(--space-4); border-radius: var(--radius-lg); border: 1px solid var(--gray-200); margin-bottom: var(--space-4);">
              <h4 style="color: var(--gray-700); margin: 0 0 var(--space-3) 0; font-size: 1rem;">🩺 Clinical Details</h4>
              <div style="margin: var(--space-2) 0;">
                <strong>Priority Level:</strong>
                <span class="medical-badge badge-${urgencyBadgeClass}" style="margin-left: var(--space-2);">${urgencyText}</span>
              </div>
              <p style="margin: var(--space-2) 0;"><strong>Category:</strong> ${appointmentData.category || 'General'}</p>
              <p style="margin: var(--space-2) 0;"><strong>Initial Diagnosis:</strong> ${appointmentData.initialDiagnosis || 'Assessment pending'}</p>
              <div style="margin: var(--space-3) 0;">
                <strong>Case Summary:</strong>
                <div style="background: white; padding: var(--space-3); border-radius: var(--radius-md); border: 1px solid var(--gray-200); margin-top: var(--space-2); line-height: 1.5; min-height: 60px;">
                  ${appointmentData.summary || 'No case summary available'}
                </div>
              </div>
            </div>
          </div>
        </div>
        <div class="edit-modal-footer">
          <button class="medical-btn medical-btn-secondary" onclick="closeAppointmentDetailsModal()">❌ Close</button>
          <button class="medical-btn medical-btn-primary" onclick="editAppointment('${appointmentPatient}', '${appointmentDate}', '${appointmentTime}', '${patientId}', '${appointmentId}')">✏️ Edit Appointment</button>
        </div>
      </div>
    </div>
  `;
  
  document.body.insertAdjacentHTML('beforeend', detailsModal);
}

// Helper function to get urgency badge class
getUrgencyBadgeClass(urgencyLevel) {
  switch (urgencyLevel) {
    case 1: return "danger";
    case 2: return "warning"; 
    case 3: return "info";
    case 4: return "secondary";
    default: return "secondary";
  }
}

// Helper function to get urgency text
getUrgencyText(urgencyLevel) {
  switch (urgencyLevel) {
    case 1: return "🚨 Urgent - Wound Care";
    case 2: return "⚠️ High - Nail Surgery";
    case 3: return "📋 Medium - High Risk Footcare";
    case 4: return "📝 Low - MSK";
    default: return "📋 Standard";
  }
}

  // Close appointment details modal
  closeAppointmentDetailsModal() {
    const modal = document.getElementById('appointmentDetailsModal');
    if (modal) {
      modal.remove();
    }
  }

  // Edit appointment function
  editAppointment(appointmentPatient, appointmentDate, appointmentTime, patientId, appointmentId) {
    this.closeAppointmentDetailsModal();
    this.showEditAppointmentModal(appointmentPatient, appointmentDate, appointmentTime, patientId, appointmentId);
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

// // Show appointment edit modal
// async showEditAppointmentModal(appointmentPatient, appointmentDate, appointmentTime, patientId, appointmentId) {
//   console.log('📝 Opening edit modal for:', appointmentId);

//     await this.loadAvailabilities();

//   // Create option for original slot
//   const original = `<option value="original">${appointmentDate} at ${appointmentTime} (Original)</option>`;
  
//   //TODO: Create tmp value for original slot, pass on to save functions, use that to reopen slot etc in firebase
//   //Reformat original date to proper form if neede [done]

//   // Create the time slots dropdown
//   const timeSlotsHTML = this.availabilities.map(slot => `
//     <option value="${slot}">${new Date(slot).toLocaleString('en-SG', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true })}</option>
//   `).join('');
//   //NEED TO use new DATE() here, now just need to do saving to db logic, ensure value is a valid format to be updated with

//   const originalSlot = formatDate(appointmentDate) + "T" + formatTime(appointmentTime); // Use T for datetime format

  // function formatDate(dateString) { //Convert Date to HTML Readable 
  //   const [day, month, year] = dateString.split(' ');
  //   const months = {
  //     January: '01', February: '02', March: '03', April: '04',
  //     May: '05', June: '06', July: '07', August: '08',
  //     September: '09', October: '10', November: '11', December: '12'
  //   };
  //   return `${year}-${months[month]}-${String(day).padStart(2, '0')}`;
  // }

  // function formatTime(timeString) { //Convert Date to HTML Readable 
  //   const timeParts = timeString.split(' ');
  //   let [hours, minutes] = timeParts[0].split(':');
  //   if (timeParts[1] === 'pm' && hours !== '12') {
  //     hours = String(Number(hours) + 12);
  //   } else if (timeParts[1] === 'am' && hours === '12') {
  //     hours = '00';
  //   }
  //   return hours+":"+minutes;
    
  // }
  
//   const modalHTML = `
//     <div id="editAppointmentModal" class="edit-modal-overlay">
//       <div class="edit-modal-content">
//         <div class="edit-modal-header">
//           <h3>📝 Edit Appointment For: ${appointmentPatient}</h3>
//           <button class="edit-modal-close" onclick="closeEditAppointmentModal()">✕</button>
//         </div>
//         <div class="edit-modal-body">
//           <div class="form-group">
//             <label class="medical-label">📅 New Slot:</label>
//             <select id="editAppointmentSlot" class"medical-input" required>
//               ${original}
//               ${timeSlotsHTML}
//             </select>
//           </div>
//           <div class="edit-modal-footer">
//             <button class="medical-btn medical-btn-secondary" onclick="closeEditAppointmentModal()">❌ Cancel</button>
//             <button class="medical-btn medical-btn-primary" id="saveChangesButton" onclick="saveAppointmentChanges('${appointmentId || 'unknown'}', '${originalSlot || 'unknown'}')" disabled>💾 Save Changes</button>
//           </div>
//         </div>
//       </div>
//     </div>
//   `;
  
//   document.body.insertAdjacentHTML('beforeend', modalHTML);

//   const saveButton = document.getElementById('saveChangesButton');
//   const timeSelect = document.getElementById('editAppointmentSlot');

//   timeSelect.addEventListener('change', () => {
//     if (timeSelect.value === 'original') {
//       saveButton.disabled = true;
//     } else {
//       saveButton.disabled = false;
//     }
//   });
  
//   // Focus on date field
//   setTimeout(() => {
//     document.getElementById('editAppointmentSlot').focus();
//   }, 100);
// }

// Show appointment edit modal with INSTANT DISPLAY + background loading
async showEditAppointmentModal(appointmentPatient, appointmentDate, appointmentTime, patientId, appointmentId) {
  console.log('📝 Opening edit modal for:', appointmentId);

  // Store the current appointment data
  this.currentAppointmentData = {
    patientId: patientId,
    appointmentId: appointmentId,
    patientName: appointmentPatient,
    currentDateTime: `${appointmentDate} ${appointmentTime}`,
    category: 'General',
    initialDiagnosis: 'Assessment pending'
  };

  const originalSlot = this.formatDateTimeForServer(appointmentDate, appointmentTime);

  // SHOW MODAL IMMEDIATELY - NO WAITING FOR DATABASE
  const modalHTML = `
    <div id="editAppointmentModal" class="edit-modal-overlay">
      <div class="edit-modal-content">
        <div class="edit-modal-header">
          <h3>📝 Edit Appointment For: ${appointmentPatient}</h3>
          <button class="edit-modal-close" onclick="closeEditAppointmentModal()">✕</button>
        </div>
        <div class="edit-modal-body">
          <div style="background: #f0f9ff; padding: 15px; border-radius: 8px; border: 1px solid #bfdbfe; margin-bottom: 20px;">
            <h4 style="margin: 0 0 10px 0; color: #1d4ed8;">📋 Current Appointment</h4>
            <div style="font-size: 0.9rem; color: #374151;">
              <div><strong>Patient:</strong> ${appointmentPatient}</div>
              <div><strong>Appointment ID:</strong> ${appointmentId}</div>
              <div><strong>Current Date/Time:</strong> ${appointmentDate} ${appointmentTime}</div>
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
              " min="${new Date().toISOString().split('T')[0]}" onchange="window.podiatristCalendar.updateAvailableTimesForDate()">
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
                <option value="">Loading available times...</option>
              </select>
              <p id="availabilityStatus" style="font-size: 0.875rem; margin-top: 8px; color: #6b7280;">
                <span class="loading-dots">Loading availability data</span>
              </p>
            </div>
            
            <div class="edit-modal-footer">
              <button class="medical-btn medical-btn-secondary" onclick="closeEditAppointmentModal()">❌ Cancel</button>
              <button class="medical-btn medical-btn-primary" id="saveChangesButton" onclick="window.podiatristCalendar.saveAppointmentChangesNew('${appointmentId || 'unknown'}', '${originalSlot || 'unknown'}')" disabled>💾 Save Changes</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
  
  // INSTANT MODAL DISPLAY
  document.body.insertAdjacentHTML('beforeend', modalHTML);

  const saveButton = document.getElementById('saveChangesButton');
  const dateInput = document.getElementById('newAppointmentDate');
  const timeSelect = document.getElementById('newAppointmentTime');
  const statusText = document.getElementById('availabilityStatus');

  // Add loading animation CSS
  const loadingStyle = document.createElement('style');
  loadingStyle.textContent = `
    .loading-dots::after {
      content: '';
      animation: dots 1.5s steps(5, end) infinite;
    }
    @keyframes dots {
      0%, 20% { content: '.'; }
      40% { content: '..'; }
      60% { content: '...'; }
      80%, 100% { content: ''; }
    }
  `;
  document.head.appendChild(loadingStyle);

  // Enable save button when both date and time are selected
  function checkFormValidity() {
    if (dateInput.value && timeSelect.value && timeSelect.value !== "" && !timeSelect.value.includes('Loading')) {
      saveButton.disabled = false;
    } else {
      saveButton.disabled = true;
    }
  }

  dateInput.addEventListener('change', checkFormValidity);
  timeSelect.addEventListener('change', checkFormValidity);
  
  // BACKGROUND LOADING - Start immediately but don't block modal
  this.loadAvailabilityDataInBackground();
  
  // Focus on date field
  setTimeout(() => {
    document.getElementById('newAppointmentDate').focus();
  }, 100);
}

// NEW: Load availability data in background without blocking UI
async loadAvailabilityDataInBackground() {
  try {
    console.log('🔄 Loading availability data in background...');
    
    // Show user that data is loading
    const statusText = document.getElementById('availabilityStatus');
    if (statusText) {
      statusText.innerHTML = '<span class="loading-dots">Loading availability data</span>';
      statusText.style.color = '#6b7280';
    }
    
    // Load data in background
    await this.loadBookedSlotsForFiltering();
    
    // Update UI to show data is ready
    if (statusText) {
      statusText.textContent = 'Select a date to see available times';
      statusText.style.color = '#6b7280';
    }
    
    const timeSelect = document.getElementById('newAppointmentTime');
    if (timeSelect) {
      timeSelect.innerHTML = '<option value="">Select date first</option>';
    }
    
    console.log('✅ Availability data loaded in background');
    
  } catch (error) {
    console.error('❌ Error loading availability data:', error);
    
    // Show error but don't block the user
    const statusText = document.getElementById('availabilityStatus');
    if (statusText) {
      statusText.textContent = 'Error loading availability - showing all times';
      statusText.style.color = '#dc2626';
    }
    
    // Fallback: show all time slots
    this.showAllTimeSlots();
  }
}

// NEW: Fallback function to show all time slots if availability loading fails
showAllTimeSlots() {
  const timeSelect = document.getElementById('newAppointmentTime');
  if (!timeSelect) return;
  
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
  
  timeSelect.innerHTML = '<option value="">Select time</option>';
  allTimeSlots.forEach(slot => {
    timeSelect.innerHTML += `<option value="${slot.value}">${slot.label}</option>`;
  });
}

// Helper function to format date and time for server
formatDateTimeForServer(appointmentDate, appointmentTime) {
  try {
    const [day, month, year] = appointmentDate.split(' ');
    const months = {
      January: '01', February: '02', March: '03', April: '04',
      May: '05', June: '06', July: '07', August: '08',
      September: '09', October: '10', November: '11', December: '12'
    };
    
    const timeParts = appointmentTime.split(' ');
    let [hours, minutes] = timeParts[0].split(':');
    if (timeParts[1] === 'pm' && hours !== '12') {
      hours = String(Number(hours) + 12);
    } else if (timeParts[1] === 'am' && hours === '12') {
      hours = '00';
    }
    
    return `${year}-${months[month]}-${String(day).padStart(2, '0')}T${hours}:${minutes}`;
  } catch (error) {
    console.error('Error formatting date/time:', error);
    return null;
  }
}

// Load booked slots to filter out from time options
async loadBookedSlotsForFiltering() {
  try {
    console.log("🔍 Loading booked slots for filtering...");
    
    const response = await fetch("/get-schedule-by-date", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
       podiatristId: this.getCurrentPodId(), // 🔧 FIXED: Get podId using the class method
        targetDate: "all",
        cacheBuster: Date.now()
      })
    });
    
    if (response.ok) {
      const result = await response.json();
      
      this.bookedSlots = new Set();
      
      if (result.success && result.appointments) {
        result.appointments.forEach(apt => {
          const aptDateTime = new Date(apt.scheduledDateTime);
          const dateKey = aptDateTime.toISOString().split('T')[0];
          const timeKey = aptDateTime.toTimeString().split(' ')[0].substring(0, 5);
          const slotKey = `${dateKey}_${timeKey}`;
          this.bookedSlots.add(slotKey);
        });
      }
      
      console.log(`📅 Loaded ${this.bookedSlots.size} booked slots for filtering`);
    } else {
      this.bookedSlots = new Set();
    }
    
  } catch (error) {
    console.error("❌ Error loading booked slots:", error);
    this.bookedSlots = new Set();
  }
}


// updateAvailableTimesForDate() {
//   const dateInput = document.getElementById('newAppointmentDate');
//   const timeSelect = document.getElementById('newAppointmentTime');
//   const statusText = document.getElementById('availabilityStatus');
  
//   if (!dateInput || !timeSelect || !statusText) return;
  
//   const selectedDate = dateInput.value;
  
//   if (!selectedDate) {
//     timeSelect.innerHTML = '<option value="">Select date first</option>';
//     statusText.textContent = 'Select a date to see available times';
//     statusText.style.color = '#6b7280';
//     return;
//   }
  
//   console.log('🔄 Updating available times for date:', selectedDate);
  
//   // Define all possible time slots (8 AM to 5 PM, 30-min intervals)
//   const allTimeSlots = [
//     { value: "08:00", label: "8:00 AM" },
//     { value: "08:30", label: "8:30 AM" },
//     { value: "09:00", label: "9:00 AM" },
//     { value: "09:30", label: "9:30 AM" },
//     { value: "10:00", label: "10:00 AM" },
//     { value: "10:30", label: "10:30 AM" },
//     { value: "11:00", label: "11:00 AM" },
//     { value: "11:30", label: "11:30 AM" },
//     { value: "12:00", label: "12:00 PM" },
//     { value: "12:30", label: "12:30 PM" },
//     { value: "13:00", label: "1:00 PM" },
//     { value: "13:30", label: "1:30 PM" },
//     { value: "14:00", label: "2:00 PM" },
//     { value: "14:30", label: "2:30 PM" },
//     { value: "15:00", label: "3:00 PM" },
//     { value: "15:30", label: "3:30 PM" },
//     { value: "16:00", label: "4:00 PM" },
//     { value: "16:30", label: "4:30 PM" },
//     { value: "17:00", label: "5:00 PM" }
//   ];
  
//   // Filter out booked slots
//   const availableSlots = allTimeSlots.filter(slot => {
//     const slotKey = `${selectedDate}_${slot.value}`;
//     const isBooked = this.bookedSlots && this.bookedSlots.has(slotKey);
//     return !isBooked;
//   });
  
//   // Update the time dropdown
//   timeSelect.innerHTML = '<option value="">Select time</option>';
  
//   if (availableSlots.length === 0) {
//     timeSelect.innerHTML += '<option value="" disabled>No available times for this date</option>';
//     statusText.textContent = `❌ No available times on ${selectedDate}`;
//     statusText.style.color = '#dc2626';
//   } else {
//     availableSlots.forEach(slot => {
//       timeSelect.innerHTML += `<option value="${slot.value}">${slot.label}</option>`;
//     });
    
//     statusText.textContent = `✅ ${availableSlots.length} available times on ${selectedDate}`;
//     statusText.style.color = '#059669';
//   }
  
//   console.log(`📅 Date ${selectedDate}: ${availableSlots.length} available slots out of ${allTimeSlots.length} total`);
// }

// Update available times when date is selected - OPTIMIZED VERSION
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
  
  // Check if we have booked slots data yet
  if (!this.bookedSlots) {
    console.log('⚠️ Availability data not loaded yet, showing all times');
    statusText.textContent = 'Availability data loading - showing all times';
    statusText.style.color = '#f59e0b';
    this.showAllTimeSlots();
    return;
  }
  
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

// New save function for the updated format
async saveAppointmentChangesNew(appointmentId, originalSlot) {
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
  
  console.log('🔄 Updating appointment:', {
    appointmentId: appointmentId,
    newDateTime: newDateTime
  });
  
  // Show loading state
  const saveBtn = document.getElementById('saveChangesButton');
  const originalText = saveBtn.textContent;
  saveBtn.textContent = '⏳ Saving...';
  saveBtn.disabled = true;
  
  try {
    const response = await fetch("/podiatrist-update-appointment", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        apptId: appointmentId, 
        updateData: newDateTime,
        originalSlot: originalSlot 
      })
    });
    
    const result = await response.json();
    
    if (result.success) {
      console.log('✅ Database update successful:', result);
      
      // Close modal
      this.closeEditAppointmentModal();
      
      // Refresh calendar to show changes
      setTimeout(async () => {
        await this.refreshCalendar();
        if (typeof window.refreshPatientQueue === 'function') {
          await window.refreshPatientQueue();
        }
      }, 500);
      
    } else {
      console.error('❌ Database update failed:', result);
      alert('❌ Failed to update appointment. Please try again.');
    }

  } catch (err) {
    console.error("❌ Failed to update appointment:", err);
    alert('❌ Failed to update appointment. Please try again.');
  } finally {
    // Restore button state
    saveBtn.textContent = originalText;
    saveBtn.disabled = false;
  }
}

// Close edit modal
closeEditAppointmentModal() {
  const modal = document.getElementById('editAppointmentModal');
  if (modal) {
    modal.remove();
  }
}

// Save appointment changes
async saveAppointmentChanges(appointmentId, originalSlot) {

  //Retreive Date and Time and put in proper format for updating
  const newSlot = document.getElementById('editAppointmentSlot').value;
  
  console.log('💾 Saving appointment changes:', {
    appointmentId,
    newSlot,
  });
  
  // Show loading state
  const saveBtn = event.target;
  const originalText = saveBtn.textContent;
  saveBtn.textContent = '⏳ Saving...';
  saveBtn.disabled = true;
  
  try {
    // Here you would call your backend API to update the appointment
    // For now, we'll simulate the API call
    await this.updateAppointmentInDatabase(appointmentId, newSlot, originalSlot);

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

// Update in DB
async updateAppointmentInDatabase(appointmentId, updateData, originalSlot) {
  //Send update request to server
  try {
    const res = await fetch("/podiatrist-update-appointment", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ "apptId": appointmentId, "updateData": updateData, "originalSlot": originalSlot })
    });

    const result = await res.json();
    
    if (result.success) {
      console.log('✅ Database update successful:', result);
      
      // IMMEDIATE: Trigger calendar refresh right after successful update
      setTimeout(async () => {
        console.log('🔄 IMMEDIATE: Triggering calendar refresh...');
        await this.refreshCalendar();
        
        // Also refresh patient queue if available
        if (typeof window.refreshPatientQueue === 'function') {
          await window.refreshPatientQueue();
        }
      }, 500); // Short delay to ensure DB update is complete
      
    } else {
      console.error('❌ Database update failed:', result);
    }

  } catch (err) {
    console.error("❌ Failed to update appt:", err);
    throw err; // Re-throw to handle in calling function
  }
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

// Enhanced refresh calendar data and redraw
async refreshCalendar() {
  try {
    console.log('🔄 Enhanced calendar refresh starting...');
    
    // 1. Clear any existing cache
    if (typeof scheduleCache !== 'undefined') {
      scheduleCache.clear();
    }
    
    // 2. Show loading indicator
    const calendarGrid = document.getElementById('calendarGrid');
    if (calendarGrid) {
      const originalContent = calendarGrid.innerHTML;
      calendarGrid.innerHTML = `
        <div style="
          grid-column: 1 / -1;
          text-align: center;
          padding: 40px;
          color: #6b7280;
          font-size: 1rem;
        ">
          <div style="display: flex; align-items: center; justify-content: center; gap: 10px;">
            <div class="loading-spinner"></div>
            <span>Updating calendar...</span>
          </div>
        </div>
      `;
    }
    
    // 3. Reload appointments from server with cache busting
    await this.loadAppointments();
    console.log('✅ Appointments reloaded from server');
    
    // 4. Get current view settings
    const currentMonth = this.currentDate.getMonth();
    const currentYear = this.currentDate.getFullYear();
    
    console.log(`🔄 Regenerating calendar for ${this.getMonthName(currentMonth)} ${currentYear}`);
    
    // 5. Regenerate calendar for current month/year
    this.generateCalendarForMonth(currentMonth, currentYear);
    
    // 6. Reapply any active filters
    const appointmentTypeSelect = document.getElementById('appointmentType');
    if (appointmentTypeSelect && appointmentTypeSelect.value) {
      console.log('🔍 Reapplying appointment type filter:', appointmentTypeSelect.value);
      this.filterAppointmentsByType();
    }
    
    console.log('✅ Enhanced calendar refresh completed successfully');
    
    // 7. Show success notification
    this.showCalendarUpdateNotification('📅 Calendar updated with latest changes');
    
  } catch (error) {
    console.error('❌ Error in enhanced calendar refresh:', error);
    
    // Show error notification
    this.showCalendarUpdateNotification('❌ Error updating calendar - please refresh manually');
    
    // Restore calendar if possible
    const currentMonth = this.currentDate.getMonth();
    const currentYear = this.currentDate.getFullYear();
    this.generateCalendarForMonth(currentMonth, currentYear);
  }
}

// Enhanced loadAppointments with cache busting
async loadAppointments() {
  const podId = this.getCurrentPodId(); // 🔧 FIXED: Use dynamic pod ID
  try {
    console.log('📅 Loading fresh appointments from server...');
    
    // Add cache busting parameter
    const cacheBuster = Date.now();
    
    const res = await fetch(`/podiatrist-get-appointments-scheduled?cb=${cacheBuster}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ podId })
    });

    const data = await res.json();
    this.appointments = data.appointments || [];
    
    console.log(`📅 Loaded ${this.appointments.length} fresh appointments`);

  } catch (err) {
    console.error("❌ Failed to fetch fresh appointment details:", err);
    throw err; // Re-throw to handle in refresh function
  }
}

// Show calendar update notification
showCalendarUpdateNotification(message) {
  // Create notification element
  const notification = document.createElement('div');
  notification.style.cssText = `
    position: fixed;
    top: 70px;
    right: 20px;
    background: #059669;
    color: white;
    padding: 10px 18px;
    border-radius: 6px;
    box-shadow: 0 3px 10px rgba(0, 0, 0, 0.2);
    z-index: 9999;
    font-size: 0.85rem;
    font-weight: 500;
    animation: slideInRight 0.3s ease-out;
  `;
  notification.innerHTML = `📅 ${message}`;
  
  // Add to page
  document.body.appendChild(notification);
  
  // Remove after 2.5 seconds
  setTimeout(() => {
    notification.style.animation = 'slideOutRight 0.3s ease-in';
    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    }, 300);
  }, 2500);
}

}

// Make refresh function globally available
window.refreshCalendar = function() {
  if (window.podiatristCalendar && window.podiatristCalendar.isInitialized) {
    return podiatristCalendar.refreshCalendar();
  } else {
    console.error('❌ Calendar not initialized yet');
    return Promise.resolve();
  }
};

window.refreshCalendarView = function() {
  if (window.podiatristCalendar && window.podiatristCalendar.isInitialized) {
    return podiatristCalendar.refreshCalendar();
  } else {
    console.error('❌ Calendar not initialized yet');
    return Promise.resolve();
  }
};

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

window.saveAppointmentChangesNew = function(appointmentId, originalSlot) {
  if (window.podiatristCalendar && window.podiatristCalendar.isInitialized) {
    podiatristCalendar.saveAppointmentChangesNew(appointmentId, originalSlot);
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

window.saveAppointmentChanges = function(appointmentId, originalSlot) {
  if (window.podiatristCalendar && window.podiatristCalendar.isInitialized) {
    podiatristCalendar.saveAppointmentChanges(appointmentId, originalSlot);
  }
};

window.closeAppointmentDetailsModal = function() {
  if (window.podiatristCalendar && window.podiatristCalendar.isInitialized) {
    podiatristCalendar.closeAppointmentDetailsModal();
  }
};

window.editAppointment = function(appointmentPatient, appointmentDate, appointmentTime, patientId, appointmentId) {
  if (window.podiatristCalendar && window.podiatristCalendar.isInitialized) {
    podiatristCalendar.editAppointment(appointmentPatient, appointmentDate, appointmentTime, patientId, appointmentId);
  }
};

window.closeSuccessModal = function() {
  if (window.podiatristCalendar && window.podiatristCalendar.isInitialized) {
    podiatristCalendar.closeSuccessModal();
  }
};