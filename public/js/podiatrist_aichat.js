// ========================================
// COMPLETE WORKING AI CHAT - FLOATING ASSISTANT WITH FIXED DATE FUNCTIONALITY
// ========================================

class PodiatristAIChat {
  constructor() {
    this.isInitialized = false;
    this.patientCache = new Map();
    
    this.init = this.init.bind(this);
    this.sendMessage = this.sendMessage.bind(this);
    this.sendQuickQuery = this.sendQuickQuery.bind(this);
    this.querySpecificPatient = this.querySpecificPatient.bind(this);
    this.refreshChat = this.refreshChat.bind(this);
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
    
    console.log('✅ Floating chat refreshed successfully');
  }

  // ADD COMPLETE WELCOME MESSAGE
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
          💡 <strong>Tip:</strong> You can also ask about specific patients using "Patient [ID]" or ask about schedules for any date like "What's my schedule tomorrow?"
        </p>
      </div>
    `;
    chatbox.appendChild(welcomeDiv);
    chatbox.scrollTop = chatbox.scrollHeight;
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
  // ENHANCED sendMessage function with DATE DETECTION AND DIRECT NO APPOINTMENTS RESPONSE
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

// FIXED detectScheduleQuery function - REPLACE ENTIRE FUNCTION
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
    
    console.log('🎯 FOUND: DAY+MONTH+YEAR pattern');
    console.log('Parsed values:', { day, monthName, year });
    
    const monthNames = ['january', 'february', 'march', 'april', 'may', 'june', 
                       'july', 'august', 'september', 'october', 'november', 'december'];
    const monthIndex = monthNames.indexOf(monthName);
    
    console.log('Month index (0-based):', monthIndex, 'for', monthName);
    
    if (monthIndex !== -1) {
      // FIXED: Use timezone-safe date creation
      targetDate = createTimezoneSafeDate(year, monthIndex, day);
      console.log('📅 TIMEZONE-SAFE RESULT: DAY+MONTH+YEAR ->', `${day} ${monthName} ${year} = ${targetDate}`);
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
    
    console.log('🎯 FOUND: MONTH+DAY+YEAR pattern');
    
    const monthNames = ['january', 'february', 'march', 'april', 'may', 'june', 
                       'july', 'august', 'september', 'october', 'november', 'december'];
    const monthIndex = monthNames.indexOf(monthName);
    
    if (monthIndex !== -1) {
      targetDate = createTimezoneSafeDate(year, monthIndex, day);
      console.log('📅 TIMEZONE-SAFE RESULT: MONTH+DAY+YEAR ->', `${monthName} ${day} ${year} = ${targetDate}`);
      return { isScheduleQuery: true, targetDate };
    }
  }
  
  // 3. ISO format: YYYY-MM-DD or YYYY/MM/DD
  const isoPattern = /(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})/;
  const isoMatch = message.match(isoPattern);
  
  if (isoMatch) {
    const year = parseInt(isoMatch[1]);
    const month = parseInt(isoMatch[2]);
    const day = parseInt(isoMatch[3]);
    targetDate = createTimezoneSafeDate(year, month - 1, day);
    console.log('📅 TIMEZONE-SAFE RESULT: ISO YYYY-MM-DD ->', targetDate);
    return { isScheduleQuery: true, targetDate };
  }
  
  // 4. DD/MM/YYYY format
  const ddmmyyyyPattern = /(\d{1,2})\/(\d{1,2})\/(\d{4})/;
  const ddmmyyyyMatch = message.match(ddmmyyyyPattern);
  
  if (ddmmyyyyMatch) {
    const day = parseInt(ddmmyyyyMatch[1]);
    const month = parseInt(ddmmyyyyMatch[2]);
    const year = parseInt(ddmmyyyyMatch[3]);
    targetDate = createTimezoneSafeDate(year, month - 1, day);
    console.log('📅 TIMEZONE-SAFE RESULT: DD/MM/YYYY ->', `${day}/${month}/${year} = ${targetDate}`);
    return { isScheduleQuery: true, targetDate };
  }
  
  // 5. "today", "tomorrow", "yesterday"
  if (lowerMessage.includes('today')) {
    targetDate = 'today';
    console.log('📅 FINAL RESULT: TODAY');
    return { isScheduleQuery: true, targetDate };
  } else if (lowerMessage.includes('tomorrow')) {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const year = tomorrow.getFullYear();
    const month = tomorrow.getMonth();
    const day = tomorrow.getDate();
    targetDate = createTimezoneSafeDate(year, month, day);
    console.log('📅 TIMEZONE-SAFE RESULT: TOMORROW ->', targetDate);
    return { isScheduleQuery: true, targetDate };
  } else if (lowerMessage.includes('yesterday')) {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const year = yesterday.getFullYear();
    const month = yesterday.getMonth();
    const day = yesterday.getDate();
    targetDate = createTimezoneSafeDate(year, month, day);
    console.log('📅 TIMEZONE-SAFE RESULT: YESTERDAY ->', targetDate);
    return { isScheduleQuery: true, targetDate };
  }
  
  // 6. "1st July", "2nd August" (current year)
  const dayMonthPattern = /(\d{1,2})(st|nd|rd|th)?\s+(january|february|march|april|may|june|july|august|september|october|november|december)/i;
  const dayMonthMatch = message.match(dayMonthPattern);
  
  if (dayMonthMatch) {
    const day = parseInt(dayMonthMatch[1]);
    const monthName = dayMonthMatch[3].toLowerCase();
    const currentYear = new Date().getFullYear();
    
    const monthNames = ['january', 'february', 'march', 'april', 'may', 'june', 
                       'july', 'august', 'september', 'october', 'november', 'december'];
    const monthIndex = monthNames.indexOf(monthName);
    
    if (monthIndex !== -1) {
      targetDate = createTimezoneSafeDate(currentYear, monthIndex, day);
      console.log('📅 TIMEZONE-SAFE RESULT: DAY+MONTH (current year) ->', `${day} ${monthName} = ${targetDate}`);
      return { isScheduleQuery: true, targetDate };
    }
  }
  
  // 7. "July 1st", "August 2nd" (current year)
  const monthDayPattern = /(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{1,2})(st|nd|rd|th)?/i;
  const monthDayMatch = message.match(monthDayPattern);
  
  if (monthDayMatch) {
    const monthName = monthDayMatch[1].toLowerCase();
    const day = parseInt(monthDayMatch[2]);
    const currentYear = new Date().getFullYear();
    
    const monthNames = ['january', 'february', 'march', 'april', 'may', 'june', 
                       'july', 'august', 'september', 'october', 'november', 'december'];
    const monthIndex = monthNames.indexOf(monthName);
    
    if (monthIndex !== -1) {
      targetDate = createTimezoneSafeDate(currentYear, monthIndex, day);
      console.log('📅 TIMEZONE-SAFE RESULT: MONTH+DAY (current year) ->', `${monthName} ${day} = ${targetDate}`);
      return { isScheduleQuery: true, targetDate };
    }
  }
  
  // 8. Day names (Monday, Tuesday, etc.)
  const dayNames = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
  const today = new Date();
  
  for (let i = 0; i < dayNames.length; i++) {
    if (lowerMessage.includes(dayNames[i])) {
      const targetDay = (i + 1) % 7;
      const currentDay = today.getDay();
      let daysToAdd = targetDay - currentDay;
      
      if (lowerMessage.includes('next') || daysToAdd <= 0) {
        daysToAdd += (daysToAdd <= 0 ? 7 : 0);
      }
      
      const targetDateObj = new Date(today);
      targetDateObj.setDate(today.getDate() + daysToAdd);
      const year = targetDateObj.getFullYear();
      const month = targetDateObj.getMonth();
      const day = targetDateObj.getDate();
      targetDate = createTimezoneSafeDate(year, month, day);
      console.log('📅 TIMEZONE-SAFE RESULT: DAY NAME ->', `${dayNames[i]} = ${targetDate}`);
      return { isScheduleQuery: true, targetDate };
    }
  }
  
  // Fallback
  console.log('🎯 Using fallback: today');
  return { isScheduleQuery: true, targetDate: 'today' };
}

  // ========================================
  // ENHANCED QUICK QUERY WITH DIRECT NO APPOINTMENTS RESPONSE
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
          
          console.log('📅 Fetching schedule from database...');
          
          try {
            // Use flexible date route
            const scheduleResponse = await fetch("/get-schedule-by-date", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ 
                podiatristId: "current_podiatrist",
                targetDate: specificDate || 'today'
              })
            });
            
            const scheduleResult = await scheduleResponse.json();
            console.log('📊 Schedule response received:', scheduleResult);
            
            // DIRECT HANDLING OF EMPTY SCHEDULE - NO AI PROCESSING
            if (scheduleResult.success && (scheduleResult.isEmpty || !scheduleResult.appointments || scheduleResult.appointments.length === 0)) {
              console.log('📅 Empty schedule detected in quick query - sending direct response');
              
              // Remove loading indicator immediately
              this.removeLoadingIndicator(loadingDiv);
              
              // Direct response without AI processing
              const directMessage = `📅 **${scheduleResult.date}**: No appointments scheduled for this date.`;
              this.addMessageToChat(directMessage, 'bot', chatbox);
              
              console.log('✅ Direct "no appointments" message sent from quick query');
              return; // Exit early, don't send to AI
            }
            
            if (scheduleResult.success && scheduleResult.appointments && scheduleResult.appointments.length > 0) {
              scheduleData = scheduleResult;
              console.log('✅ Schedule data prepared:', scheduleData);
              
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

            } else {
              console.log('⚠️ No appointments found or empty response');
              // This should not reach here due to direct handling above, but keep as fallback
              this.removeLoadingIndicator(loadingDiv);
              const directMessage = `📅 **${scheduleResult.date}**: No appointments scheduled for this date.`;
              this.addMessageToChat(directMessage, 'bot', chatbox);
              return;
            }
          } catch (fetchError) {
            console.error('❌ Error fetching schedule:', fetchError);
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
            console.error('❌ Error fetching urgent cases:', fetchError);
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
            console.log('📋 Patient summaries result:', summariesResult);
            
            if (summariesResult.success && summariesResult.summaries && summariesResult.summaries.length > 0) {
              // Store the real data for display
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

FORMATTING INSTRUCTIONS: Use clean, professional formatting. Use **bold** for important terms, and organize with clear sections. Avoid using # markdown headers.

Please provide a clinical analysis covering:

**Current Case Load Summary**
Summarize the patient's multiple conditions and their priority levels.

**Priority Assessment** 
Identify which conditions need immediate attention and why.

**Follow-up Requirements**
List specific follow-up actions needed for each condition.

**Clinical Recommendations**
Provide care coordination recommendations and next steps.

IMPORTANT: Only discuss these REAL patients from our database. Do not create fictional patients. Keep formatting clean and professional.`;

            } else {
              prompt = 'No recent patient summaries available in the database. The system shows no patient interactions in the recent period.';
            }
          } catch (fetchError) {
            console.error('❌ Error fetching patient summaries:', fetchError);
            prompt = 'Unable to access patient summary data from the database. Please check system connectivity.';
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
          
        case 'scheduling help':
          prompt = 'What factors should I consider when prioritizing patient appointments based on condition severity?';
          break;
          
        default:
          prompt = query;
          break;
      }
      
      // Update loading message to show AI is thinking
      this.updateLoadingMessage(loadingDiv, 'AI is analyzing your request...');
      
      // Send the prompt to the AI
      console.log('📤 Sending request to server');
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
      console.log('📥 Received response from server');
      
      // Remove loading indicator
      this.removeLoadingIndicator(loadingDiv);
      
      // Display the AI response
      this.addMessageToChat(data.reply, 'bot', chatbox);
      console.log('✅ Added AI response to chat');
      
      // Add schedule cards if we have appointment data
      if (scheduleData && scheduleData.appointments && scheduleData.appointments.length > 0) {
        console.log('📋 Adding schedule cards for', scheduleData.appointments.length, 'appointments');
        this.addScheduleCards(scheduleData.appointments, chatbox);
      }
      
      // Add follow-up actions
      if (needsDatabase) {
        console.log('🔧 Adding follow-up actions...');
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
    console.log('📋 Creating schedule cards container...');
    
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
    
    console.log('✅ Schedule cards added successfully');
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
            <button class="medical-btn medical-btn-secondary medical-btn-sm" onclick="podiatristAI.querySpecificPatient('patient_1', 'appointment preparation')">
              📋 Check Next Patient
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

  // FIXED FORMAT AI RESPONSE FUNCTION
  formatAIResponse(message) {
    let formatted = message
      // Handle markdown headers (### becomes h4, ## becomes h3, # becomes h2)
      .replace(/^###\s+(.+)$/gm, '<h4 style="color: #1d4ed8; margin: 16px 0 8px 0; font-size: 1.1rem; font-weight: 600;">$1</h4>')
      .replace(/^##\s+(.+)$/gm, '<h3 style="color: #1d4ed8; margin: 18px 0 10px 0; font-size: 1.2rem; font-weight: 600;">$1</h3>')
      .replace(/^#\s+(.+)$/gm, '<h2 style="color: #1d4ed8; margin: 20px 0 12px 0; font-size: 1.3rem; font-weight: 600;">$1</h2>')
      
      // Handle bold text (**text** becomes <strong>)
      .replace(/\*\*(.*?)\*\*/g, '<strong style="color: #374151;">$1</strong>')
      
      // Handle bullet points (- text becomes <li>)
      .replace(/^[-•·]\s+(.+)$/gm, '<li style="margin-bottom: 4px;">$1</li>')
      
      // Handle numbered lists (1. text becomes <li>)
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
      // Remove breaks before/after headers
      .replace(/<br>\s*<h([1-6])/g, '<h$1')
      .replace(/<\/h([1-6])>\s*<br>/g, '</h$1>')
      // Remove breaks before/after lists
      .replace(/<br>\s*<ul/g, '<ul')
      .replace(/<\/ul>\s*<br>/g, '</ul>');
    
    return formatted;
  }

  // GET STATUS FOR DEBUGGING
  getStatus() {
    return {
      initialized: this.isInitialized,
      patientCacheSize: this.patientCache.size
    };
  }
}

// Create global instance
const podiatristAI = new PodiatristAIChat();

// SIMPLIFIED: Only floating AI functions
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