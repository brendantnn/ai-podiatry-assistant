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
  init() {
    console.log('🗓️ Initializing Podiatrist Calendar...');
    
    if (this.isInitialized) {
      console.log('⚠️ Calendar already initialized');
      return;
    }

    try {
      this.loadSampleAppointments();
      this.setupEventListeners();
      this.setInitialState();
      this.isInitialized = true;
      console.log('✅ Calendar initialization completed successfully');
    } catch (error) {
      console.error('❌ Calendar initialization failed:', error);
    }
  }

  // Load sample appointment data (UPDATED with more diverse dates)
  loadSampleAppointments() {
    this.appointments = [
      // January 2025
      {
        id: 'apt001',
        date: '2025-01-21',
        time: '09:00',
        patient: 'John Doe',
        type: 'consultation',
        title: '👨‍⚕️ 09:00 - John Doe'
      },
      {
        id: 'apt002',
        date: '2025-01-21',
        time: '14:30',
        patient: 'Mary Chen',
        type: 'follow-up',
        title: '🔄 14:30 - Mary Chen'
      },
      {
        id: 'apt003',
        date: '2025-01-22',
        time: '10:00',
        patient: 'Robert Kim',
        type: 'surgery',
        title: '🏥 10:00 - Robert Kim'
      },
      {
        id: 'apt004',
        date: '2025-01-22',
        time: '16:00',
        patient: 'Lisa Wong',
        type: 'wound-care',
        title: '🩹 16:00 - Lisa Wong'
      },
      {
        id: 'apt005',
        date: '2025-01-23',
        time: '11:00',
        patient: 'David Lee',
        type: 'consultation',
        title: '👨‍⚕️ 11:00 - David Lee'
      },
      {
        id: 'apt006',
        date: '2025-01-24',
        time: '09:30',
        patient: 'Sarah Tan',
        type: 'follow-up',
        title: '🔄 09:30 - Sarah Tan'
      },
      {
        id: 'apt007',
        date: '2025-01-25',
        time: '08:00',
        patient: 'Michael Lim',
        type: 'surgery',
        title: '🏥 08:00 - Michael Lim'
      },
      {
        id: 'apt008',
        date: '2025-01-26',
        time: '15:00',
        patient: 'Jennifer Ho',
        type: 'wound-care',
        title: '🩹 15:00 - Jennifer Ho'
      },
      
      // February 2025
      {
        id: 'apt009',
        date: '2025-02-03',
        time: '09:00',
        patient: 'Alex Johnson',
        type: 'consultation',
        title: '👨‍⚕️ 09:00 - Alex Johnson'
      },
      {
        id: 'apt010',
        date: '2025-02-05',
        time: '14:00',
        patient: 'Emma Wilson',
        type: 'follow-up',
        title: '🔄 14:00 - Emma Wilson'
      },
      {
        id: 'apt011',
        date: '2025-02-07',
        time: '10:30',
        patient: 'Daniel Brown',
        type: 'surgery',
        title: '🏥 10:30 - Daniel Brown'
      },
      {
        id: 'apt012',
        date: '2025-02-12',
        time: '13:00',
        patient: 'Sophie Davis',
        type: 'wound-care',
        title: '🩹 13:00 - Sophie Davis'
      },
      
      // March 2025
      {
        id: 'apt013',
        date: '2025-03-10',
        time: '11:00',
        patient: 'James Miller',
        type: 'consultation',
        title: '👨‍⚕️ 11:00 - James Miller'
      },
      {
        id: 'apt014',
        date: '2025-03-15',
        time: '09:30',
        patient: 'Olivia Garcia',
        type: 'follow-up',
        title: '🔄 09:30 - Olivia Garcia'
      },
      {
        id: 'apt015',
        date: '2025-03-20',
        time: '14:00',
        patient: 'Lucas Martinez',
        type: 'surgery',
        title: '🏥 14:00 - Lucas Martinez'
      },
      
      // June 2025 (current month shown in static HTML)
      {
        id: 'apt016',
        date: '2025-06-05',
        time: '10:00',
        patient: 'Ava Anderson',
        type: 'consultation',
        title: '👨‍⚕️ 10:00 - Ava Anderson'
      },
      {
        id: 'apt017',
        date: '2025-06-12',
        time: '15:30',
        patient: 'Noah Taylor',
        type: 'wound-care',
        title: '🩹 15:30 - Noah Taylor'
      }
    ];
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

  // Reset all calendar filters - Now properly updates calendar display
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
    
    // Generate calendar for current month
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
        eventDiv.textContent = appointment.title;
        eventDiv.addEventListener('click', () => {
          this.showAppointmentDetails(appointment.title);
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
}

// Create global calendar instance
const podiatristCalendar = new PodiatristCalendar();

// Global functions that the HTML can call (SIMPLIFIED - removed unnecessary functions)
window.filterAppointmentsByType = function() {
  podiatristCalendar.filterAppointmentsByType();
};

window.navigateCalendar = function(direction) {
  podiatristCalendar.navigateCalendar(direction);
};

window.goToToday = function() {
  podiatristCalendar.goToToday();
};

window.resetCalendarFilters = function() {
  podiatristCalendar.resetCalendarFilters();
};

window.testCalendarFunctions = function() {
  podiatristCalendar.testAllFunctions();
};

window.getCalendarStatus = function() {
  return podiatristCalendar.getStatus();
};

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
  // Small delay to ensure all elements are ready
  setTimeout(() => {
    podiatristCalendar.init();
  }, 100);
});

// Initialize immediately if DOM is already loaded
if (document.readyState === 'loading') {
  // Still loading, wait for DOMContentLoaded
} else {
  // DOM already loaded
  setTimeout(() => {
    podiatristCalendar.init();
  }, 100);
}

// Export for module usage if needed
if (typeof module !== 'undefined' && module.exports) {
  module.exports = PodiatristCalendar;
}