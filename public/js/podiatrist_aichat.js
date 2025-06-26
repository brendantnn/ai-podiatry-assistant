// ========================================
// PODIATRIST AI CHATBOT - DEDICATED MODULE
// Handles all AI assistant functionality for podiatrists
// ========================================

class PodiatristAIChat {
  constructor() {
    this.isInitialized = false;
    this.currentChatbox = null;
    this.patientCache = new Map(); // Cache patient data
    
    // Bind methods
    this.init = this.init.bind(this);
    this.sendMessage = this.sendMessage.bind(this);
    this.sendQuickQuery = this.sendQuickQuery.bind(this);
    this.querySpecificPatient = this.querySpecificPatient.bind(this);
  }

  // Initialize AI chat system
  init() {
    console.log('🤖 Initializing Podiatrist AI Chat...');
    
    if (this.isInitialized) {
      console.log('⚠️ AI Chat already initialized');
      return;
    }

    try {
      this.setupEventListeners();
      this.setupChatboxes();
      this.isInitialized = true;
      console.log('✅ AI Chat initialization completed');
    } catch (error) {
      console.error('❌ AI Chat initialization failed:', error);
    }
  }

  // Setup event listeners
  setupEventListeners() {
    // Main chat input listener
    const mainInput = document.getElementById('podiatristMessage');
    if (mainInput) {
      mainInput.addEventListener('keypress', (event) => {
        if (event.key === 'Enter') {
          this.sendMainMessage();
        }
      });
    }

    // Floating chat input listener
    const floatingInput = document.getElementById('aiMessage');
    if (floatingInput) {
      floatingInput.addEventListener('keypress', (event) => {
        if (event.key === 'Enter') {
          this.sendFloatingMessage();
        }
      });
    }
  }

  // Setup chatboxes
  setupChatboxes() {
    this.currentChatbox = document.getElementById('podiatristChatbox') || document.getElementById('aiChatbox');
    
    if (this.currentChatbox) {
      console.log('✅ Chatbox found and connected');
    } else {
      console.warn('⚠️ No chatbox found');
    }
  }

  // PREPROCESS PATIENT QUERIES TO FIX ID DETECTION
  preprocessPatientQuery(message) {
    let processedMessage = message;
    
    // Enhanced patient ID detection patterns
    const patientIdPatterns = [
      // Match various patient ID formats: patient_1, P001, etc.
      /\b(patient_\w+)\b/gi,
      /\b(p\d+)\b/gi,
      /\b(pt\d+)\b/gi
    ];
    
    // Find all potential patient IDs in the message
    const foundPatientIds = [];
    patientIdPatterns.forEach(pattern => {
      const matches = processedMessage.match(pattern);
      if (matches) {
        foundPatientIds.push(...matches);
      }
    });
    
    // Remove duplicates
    const uniquePatientIds = [...new Set(foundPatientIds)];
    
    // For each found patient ID, ensure it's properly formatted
    uniquePatientIds.forEach(patientId => {
      // Check if it's already properly formatted (preceded by "Patient ")
      const properFormat = new RegExp(`\\bPatient\\s+${patientId}\\b`, 'i');
      
      if (!properFormat.test(processedMessage)) {
        // Replace standalone patient ID with "Patient patientId"
        const standalonePattern = new RegExp(`\\b${patientId}\\b(?!\\s*:)`, 'gi');
        processedMessage = processedMessage.replace(standalonePattern, `Patient ${patientId}`);
      }
    });
    
    // Clean up any duplicate "Patient Patient" occurrences
    processedMessage = processedMessage.replace(/\bPatient\s+Patient\s+/gi, 'Patient ');
    
    // Log for debugging
    if (processedMessage !== message) {
      console.log('🔄 Message preprocessing:', {
        original: message,
        processed: processedMessage,
        foundPatientIds: uniquePatientIds
      });
    }
    
    return processedMessage;
  }

  // MAIN MESSAGE SENDING FUNCTION
  async sendMessage(message, chatboxId = null) {
    const chatbox = chatboxId ? document.getElementById(chatboxId) : this.currentChatbox;
    
    if (!chatbox) {
      console.error('❌ No chatbox available');
      return;
    }

    if (!message || !message.trim()) {
      console.warn('⚠️ Empty message');
      return;
    }

    // Preprocess message to fix patient ID detection
    const processedMessage = this.preprocessPatientQuery(message);

    // Add user message (display original message to user)
    this.addMessageToChat(message, 'user', chatbox);

    try {
      const response = await fetch("/podiatrist-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          message: processedMessage, // Send processed message to backend
          podiatristId: "current_podiatrist"
        })
      });

      const data = await response.json();
      
      // Add AI response
      this.addMessageToChat(data.reply, 'bot', chatbox);
      
      // If patient data was found, show quick actions
      if (data.patientData) {
        this.addPatientQuickActions(data.patientData.name || 'Unknown', chatbox);
      }

    } catch (error) {
      console.error("AI chat error:", error);
      this.addMessageToChat("I'm currently unable to connect. Please try again.", 'bot', chatbox);
    }
  }

  // SEND MESSAGE FROM MAIN CHAT
  async sendMainMessage() {
    const input = document.getElementById('podiatristMessage');
    if (!input) return;
    
    const message = input.value.trim();
    input.value = '';
    
    await this.sendMessage(message, 'podiatristChatbox');
  }

  // SEND MESSAGE FROM FLOATING CHAT
  async sendFloatingMessage() {
    const input = document.getElementById('aiMessage');
    if (!input) return;
    
    const message = input.value.trim();
    input.value = '';
    
    await this.sendMessage(message, 'aiChatbox');
  }

  // SIMPLIFIED QUICK QUERY SYSTEM
  async sendQuickQuery(query) {
    console.log('🔍 Quick query triggered:', query);
    
    const chatbox = this.currentChatbox;
    if (!chatbox) {
      console.error('❌ No chatbox available for quick query');
      return;
    }
    
    // Add user message
    this.addMessageToChat(`Quick query: ${query}`, 'user', chatbox);
    
    try {
      // Handle specific medical queries only - no database operations
      const prompts = {
        'clinical guidelines': 'What are the latest clinical guidelines for podiatry care, particularly for wound management, diabetic foot care, and nail surgery protocols?',
        'drug interactions': 'What are important drug interactions I should be aware of when treating foot conditions, especially for diabetic and elderly patients?',
        'scheduling help': 'What factors should I consider when prioritizing patient appointments based on condition severity and urgency levels?'
      };
      
      const prompt = prompts[query] || query;
      
      const response = await fetch("/podiatrist-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          message: prompt,
          podiatristId: "current_podiatrist"
        })
      });
      
      const data = await response.json();
      this.addMessageToChat(data.reply, 'bot', chatbox);

    } catch (error) {
      console.error("Quick query error:", error);
      this.addMessageToChat("Error processing your request. Please try again.", 'bot', chatbox);
    }
  }

  // PATIENT-SPECIFIC QUERIES
  async querySpecificPatient(patientId, question) {
    const chatbox = this.currentChatbox;
    if (!chatbox) return;
    
    // Show user query
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
      
      // Add quick actions if patient found
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
      margin: var(--space-3) 0;
      padding: var(--space-3);
      background: var(--cream-50);
      border-radius: var(--radius-lg);
      border: 1px solid var(--cream-200);
    `;
    
    actionsDiv.innerHTML = `
      <p style="font-weight: var(--font-weight-semibold); margin-bottom: var(--space-2); color: var(--gray-700);">
        Quick actions for Patient ${patientId}:
      </p>
      <div style="display: flex; gap: var(--space-2); flex-wrap: wrap;">
        <button class="medical-btn medical-btn-secondary medical-btn-sm" onclick="podiatristAI.querySpecificPatient('${patientId}', 'current condition and risk assessment')">
          🩹 Risk Assessment
        </button>
        <button class="medical-btn medical-btn-secondary medical-btn-sm" onclick="podiatristAI.querySpecificPatient('${patientId}', 'treatment recommendations based on medical alerts')">
          💊 Treatment Plan
        </button>
        <button class="medical-btn medical-btn-secondary medical-btn-sm" onclick="podiatristAI.querySpecificPatient('${patientId}', 'care coordination and follow-up needs')">
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

  // FORMAT AI RESPONSE
  formatAIResponse(message) {
    let formatted = message
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/^## (.+)$/gm, '<h4 style="color: var(--blue-700); margin: var(--space-4) 0 var(--space-2) 0; font-size: 1.1rem;">$1</h4>')
      .replace(/^[•·]\s+(.+)$/gm, '<li>$1</li>')
      .replace(/^\d+\.\s+(.+)$/gm, '<li>$1</li>')
      .replace(/\n\n/g, '</p><p>')
      .replace(/\n/g, '<br>');
      
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

  // GET STATUS FOR DEBUGGING
  getStatus() {
    return {
      initialized: this.isInitialized,
      chatboxConnected: !!this.currentChatbox,
      patientCacheSize: this.patientCache.size
    };
  }
}

// Create global instance
const podiatristAI = new PodiatristAIChat();

// Global functions for HTML onclick handlers
window.sendPodiatristMessage = function() {
  podiatristAI.sendMainMessage();
};

window.sendAIMessage = function() {
  podiatristAI.sendFloatingMessage();
};

window.sendQuickQuery = function(query) {
  podiatristAI.sendQuickQuery(query);
};

window.querySpecificPatient = function(patientId, question) {
  podiatristAI.querySpecificPatient(patientId, question);
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