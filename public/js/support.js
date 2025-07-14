// support-chat.js - AI FAQ Support Chat System

// FAQ Knowledge Base - easily expandable
const faqKnowledge = {
    // Login & Password Issues
    "password": {
        keywords: ["password", "reset", "forgot", "change", "update"],
        response: "🔐 **Password Help:**\n\n**To reset your password:**\n1. Click 'Forgot Password?' on the login page\n2. Enter your registered email address\n3. Check your email for reset instructions\n4. Follow the link to create a new password\n\n**Password Requirements:**\n• At least 8 characters\n• One uppercase letter\n• One symbol (!@#$%^&*)\n• Letters and numbers\n\n**Still having issues?** Contact our support team for immediate assistance."
    },
    
    "login": {
        keywords: ["login", "sign in", "access", "enter", "authenticate"],
        response: "🚪 **Login Help:**\n\n**Common Solutions:**\n1. **Check your user type** - Select 'Patient' or 'Podiatrist' correctly\n2. **Verify email format** - Must be valid email address\n3. **Clear browser cache** - Try Ctrl+F5 to refresh\n4. **Check caps lock** - Passwords are case-sensitive\n5. **Try incognito mode** - This bypasses browser issues\n\n**Account locked?** Wait 15 minutes or contact support to unlock immediately."
    },

    "registration": {
        keywords: ["register", "signup", "create account", "new account", "join"],
        response: "👤 **Account Registration:**\n\n**Steps to Register:**\n1. Click 'Register' on the login page\n2. Choose your user type (Patient/Podiatrist)\n3. Fill in all required information\n4. Use a strong password (see requirements)\n5. Verify your email address\n\n**Registration Issues:**\n• Email already exists? Try logging in instead\n• Invalid phone format? Use +65 for Singapore numbers\n• Form not submitting? Check all required fields\n\n**Need help?** Our support team can guide you through registration."
    },

    "email": {
        keywords: ["email", "forgot email", "email address", "username"],
        response: "📧 **Email Recovery:**\n\n**If you forgot your email:**\n1. Check common email accounts you use\n2. Look for previous SGH emails in your inbox\n3. Try variations of your usual email\n4. Contact support with your full name and phone number\n\n**Email not receiving messages?**\n• Check spam/junk folder\n• Verify email address spelling\n• Ensure your email service is working\n\n**Our support team can help locate your account using your personal details.**"
    },

    "browser": {
        keywords: ["browser", "chrome", "firefox", "safari", "edge", "compatibility"],
        response: "🌐 **Browser Compatibility:**\n\n**Recommended Browsers:**\n• Chrome (latest version)\n• Firefox (latest version)\n• Safari (latest version)\n• Edge (latest version)\n\n**Troubleshooting Steps:**\n1. Update your browser to latest version\n2. Clear browser cache and cookies\n3. Disable browser extensions temporarily\n4. Try incognito/private browsing mode\n5. Check if JavaScript is enabled\n\n**Still having issues?** Contact support for advanced troubleshooting."
    },

    "usertype": {
        keywords: ["user type", "patient", "podiatrist", "role", "account type"],
        response: "🔄 **User Type Selection:**\n\n**Choose the correct option:**\n• **Patient** - If you're seeking podiatry care\n• **Podiatrist** - If you're a medical professional\n\n**Wrong user type selected?**\n• Logout and login with correct type\n• Cannot change type after registration\n• Contact support to modify account type\n\n**Account type mismatch?** This means your account is registered differently than your selection. Use the correct type or contact support."
    },

    "system": {
        keywords: ["system", "technical", "error", "bug", "not working", "broken"],
        response: "⚙️ **System Technical Issues:**\n\n**Basic Troubleshooting:**\n1. Refresh the page (Ctrl+F5)\n2. Clear browser cache and cookies\n3. Try different browser or incognito mode\n4. Check internet connection\n5. Restart browser\n\n**Common Error Solutions:**\n• **Network errors** - Check internet connection\n• **Page not loading** - Clear cache or try different browser\n• **Features not working** - Enable JavaScript\n\n**For complex technical issues, please contact our support team immediately.**"
    },

    "appointment": {
        keywords: ["appointment", "booking", "schedule", "reschedule", "cancel"],
        response: "📅 **Appointment Help:**\n\n**Booking Appointments:**\n1. Log into your patient account\n2. Navigate to 'Book Appointment'\n3. Select available time slots\n4. Confirm your appointment details\n\n**Managing Appointments:**\n• **Reschedule** - Use 'Manage Appointments' in your dashboard\n• **Cancel** - Cancel at least 24 hours in advance\n• **View upcoming** - Check your dashboard\n\n**Need immediate appointment?** Call our clinic directly at +65 6321 4377."
    },

    "account": {
        keywords: ["account", "profile", "information", "update", "details"],
        response: "👤 **Account Management:**\n\n**Updating Your Profile:**\n1. Log into your account\n2. Go to 'Profile Settings'\n3. Edit your information\n4. Save changes\n\n**Common Updates:**\n• Personal information (name, phone, address)\n• Emergency contacts\n• Medical history\n• Communication preferences\n\n**Can't access account settings?** Contact support for assistance with account modifications."
    }
};

// Chat functionality
let chatHistory = [];

/**
 * Add a message to the chat interface
 * @param {string} message - The message content
 * @param {boolean} isUser - Whether the message is from user or bot
 */
function addMessage(message, isUser = false) {
    const chatMessages = document.getElementById('supportChatMessages');
    const messageDiv = document.createElement('div');
    messageDiv.className = `support-message ${isUser ? 'user' : 'bot'}`;
    
    if (isUser) {
        messageDiv.textContent = message;
    } else {
        // Convert markdown-style formatting to HTML
        const formattedMessage = message
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\n/g, '<br>');
        messageDiv.innerHTML = formattedMessage;
    }
    
    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
    
    return messageDiv;
}

/**
 * Show typing indicator
 */
function showTyping() {
    document.getElementById('supportTypingIndicator').style.display = 'block';
    document.getElementById('supportChatMessages').scrollTop = document.getElementById('supportChatMessages').scrollHeight;
}

/**
 * Hide typing indicator
 */
function hideTyping() {
    document.getElementById('supportTypingIndicator').style.display = 'none';
}

/**
 * Find the best response based on user message
 * @param {string} userMessage - The user's message
 * @returns {object} Response object with message and escalation flag
 */
function findBestResponse(userMessage) {
    const message = userMessage.toLowerCase();
    let bestMatch = null;
    let highestScore = 0;

    // Check each knowledge category
    for (const [category, data] of Object.entries(faqKnowledge)) {
        let score = 0;
        
        // Calculate relevance score based on keyword matches
        for (const keyword of data.keywords) {
            if (message.includes(keyword.toLowerCase())) {
                score += keyword.length; // Longer keywords get higher scores
            }
        }

        if (score > highestScore) {
            highestScore = score;
            bestMatch = data.response;
        }
    }

    // If no good match found, provide escalation response
    if (highestScore === 0) {
        return {
            response: "🤔 I understand you need help, but I'm not sure about the specific issue you're describing.\n\n**I can help with:**\n• Login and password problems\n• Account registration issues\n• Browser compatibility\n• System technical errors\n• Email recovery\n• Appointment booking\n\n**For immediate assistance with complex issues, please call our support team at +65 6321 4377.**\n\nCould you try describing your issue using different words, or select one of the quick help topics above?",
            needsEscalation: true
        };
    }

    // Check if this might need escalation based on complexity indicators
    const escalationKeywords = ['emergency', 'urgent', 'immediate', 'critical', 'broken', 'crash', 'severe', 'important', 'asap'];
    const needsEscalation = escalationKeywords.some(keyword => message.includes(keyword));

    if (needsEscalation) {
        return {
            response: bestMatch + "\n\n⚠️ **This seems urgent!** For immediate assistance, please call our support line: **+65 6321 4377**",
            needsEscalation: true
        };
    }

    return {
        response: bestMatch,
        needsEscalation: false
    };
}

/**
 * Send a message in the chat
 */
async function sendMessage() {
    const input = document.getElementById('supportMessageInput');
    const message = input.value.trim();
    
    if (!message) return;

    // Disable send button temporarily
    const sendBtn = document.getElementById('supportSendBtn');
    sendBtn.disabled = true;

    // Add user message
    addMessage(message, true);
    chatHistory.push({ role: 'user', content: message });
    
    // Clear input
    input.value = '';
    input.style.height = 'auto';

    // Show typing indicator
    showTyping();

    // Simulate AI thinking time (1-2 seconds)
    const thinkingTime = Math.random() * 1000 + 1000;
    await new Promise(resolve => setTimeout(resolve, thinkingTime));

    // Get response
    const result = findBestResponse(message);
    
    // Hide typing and add bot response
    hideTyping();
    addMessage(result.response);
    chatHistory.push({ role: 'assistant', content: result.response });

    // Re-enable send button
    sendBtn.disabled = false;
    input.focus();
}

/**
 * Ask a predefined question
 * @param {string} question - The question to ask
 */
function askQuestion(question) {
    const input = document.getElementById('supportMessageInput');
    input.value = question;
    sendMessage();
}

/**
 * Handle key press events in the input
 * @param {Event} event - The keyboard event
 */
function handleKeyPress(event) {
    const input = event.target;
    
    // Auto-resize textarea
    input.style.height = 'auto';
    input.style.height = input.scrollHeight + 'px';
    
    // Send on Enter (but not Shift+Enter)
    if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        sendMessage();
    }

    // Close on Escape
    if (event.key === 'Escape') {
        closeSupport();
    }
}

/**
 * Close the support chat and navigate back
 */
function closeSupport() {
    // Always navigate back to login page
    window.location.href = 'login.html';
}

/**
 * Navigate back to login page
 */
function goBackToLogin() {
    window.location.href = 'login.html';
}

/**
 * Initialize the chat when page loads
 */
document.addEventListener('DOMContentLoaded', function() {
    // Focus on input field
    const input = document.getElementById('supportMessageInput');
    if (input) {
        input.focus();
    }

    // Add welcome interaction after a short delay
    setTimeout(() => {
        addMessage("Feel free to ask me anything or click one of the quick help topics above to get started! 😊");
    }, 1000);
});

/**
 * Handle messages from parent window (if opened as popup)
 */
window.addEventListener('message', function(event) {
    if (event.data === 'focusChat') {
        document.getElementById('supportMessageInput').focus();
    }
});

// Export functions for potential external use
window.supportChat = {
    sendMessage,
    askQuestion,
    addMessage,
    closeSupport,
    goBackToLogin
};