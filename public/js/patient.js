window.onload = async () => {
    const loadingScreen = document.getElementById("loading-screen");
    loadingScreen.style.display = "flex"; // show loading

    const patientId = sessionStorage.getItem("userId");
    const chatbox = document.getElementById("chatbox");
  
    try {
        const res = await fetch("/patient/chat-patient-details", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ patientId })
        });

        console.log("✅ Raw response:", res);

        // Get patient name, appointment from database and assign to variables
        const data = await res.json();
        console.log("✅ JSON data received:", data);

        const name = data.name; 
        const appointment = data.appointment;

        // Set patient name at top bar
        document.getElementById("patient-name").textContent = name || "no patient name";

        // Set user's language preference from database
        const userLanguage = data.language || "en"; // Default to English if not set
        const languageSelect = document.getElementById("language-select");
        if (languageSelect) {
            languageSelect.value = userLanguage;
            console.log("🇸🇬 User's saved language preference:", userLanguage);
        }
          
        // Set patient id at top bar
        //document.getElementById("patient-id").textContent = patientId || "no patient id";

        let appointmentText = "You have no upcoming confirmed appointments.";
        let appointmentTextTwo = "You have no upcoming confirmed appointments.";

        const appointmentListContainer = document.getElementById("appointment-list");

        // Get all upcoming appointments
        if (data.allAppointments && Array.isArray(data.allAppointments)) {
            appointmentListContainer.innerHTML = ""; // Clear placeholder

            data.allAppointments.forEach(appt => {
                const dateObj = new Date(appt.date);
                const formattedDate = dateObj.toLocaleString("en-SG", {
                    weekday: "long",
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                    hour12: true,
                    timeZone: "Asia/Singapore"
                });

                const doctor = appt.podiatrist || appt.doctor || "your podiatrist";
                const type = appt.type || "Consultation";

                const html = `
                    <div class="medical-card" style="
                        padding: 1.25rem 1.5rem;
                        margin-bottom: 1rem;
                        border-radius: 12px;
                        background-color: white;
                        box-shadow: 0 2px 6px rgba(0, 0, 0, 0.05);
                    ">
                        <div class="flex justify-between items-center">
                            <div>
                                <p class="text-primary font-semibold" style="margin: 0;">${formattedDate}</p>
                                <p class="text-muted" style="font-size: 0.85rem; margin-top: 0.25rem;">${doctor} - ${type}</p>
                            </div>
                            <span class="medical-badge badge-success">CONFIRMED</span>
                        </div>
                    </div>
                `;

                appointmentListContainer.innerHTML += html;
            });
        } else {
            appointmentListContainer.innerHTML = "<p class='text-muted'>No upcoming appointments.</p>";
        }

        if (appointment && appointment.date) {
            const formattedDate = new Date(appointment.date).toLocaleString("en-SG", {
                weekday: "long",
                year: "numeric",
                month: "long",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
                hour12: true,
                timeZone: "Asia/Singapore"
            });

            const doctor = appointment.podiatrist || appointment.doctor || "your podiatrist";
            appointmentText = `🗓️ You have an upcoming appointment on <b>${formattedDate}</b> with <b>${doctor}</b>.`;
            appointmentTextTwo = `📅 Next appointment: ${formattedDate} with ${doctor}`;
      
            document.getElementById("appointment").textContent = appointmentTextTwo;
        }

        // Show combined message
        chatbox.innerHTML += `
            <div class="bot">
                <b>🤖 Digital Nurse Assistant:</b> <br>Hello <b>${name}</b>! I'm here to help you with anything related to your foot health.
                <br><br>
                ${appointmentText}
                <br><br>
                Would you like help checking any foot concerns today — or would you prefer to just view your upcoming appointment details?
            </div>
        `;

        chatbox.scrollTop = chatbox.scrollHeight;
        loadingScreen.style.display = "none"; // hide loading screen

    } catch (err) {
        console.error("❌ Failed to fetch patient details:", err);
        chatbox.innerHTML += `
            <div class="bot">
                <b>🤖 Digital Nurse Assistant:</b><br>⚠️ Unable to fetch patient details.
            </div>
        `;
    }
};

// ************** SENDING AND DISPLAYING MESSAGES IN CHATBOT *****************************

// Called when user clicks send button in HTML page
async function sendMessage() {
    // store input and chatbox values
    const input = document.getElementById("message");
    const userText = input.value.trim(); 
    const chatbox = document.getElementById("chatbox");
 
    // if user input is empty, stop function 
    if (!userText) return;

    // Adds user message into chatbox, then clear input box so user can type new message
    chatbox.innerHTML += `<div class="user"><b>You:</b> ${userText}</div>`;
    input.value = "";

    const patientId = sessionStorage.getItem("userId");

    try {
        // Send user text via HTTP POST request to /chat route, which is read in server.js
        const response = await fetch("/patient/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ message: userText, patientId }) //user text sent in JSON so server can read
        });

        // Wait for server reply, and convert it from JSON to javascript object
        const data = await response.json();

        // Display the chatbot's reply in chatbox, then scroll chatbot down to show latest message
        chatbox.innerHTML += `<div class="bot"><b>🤖 Digital Nurse Assistant:</b><br> ${data.reply}</div>`;
        chatbox.scrollTop = chatbox.scrollHeight;

    } 
    // Catch any errors 
    catch (err) {
        console.error("❌ Chat request failed:", err);
        chatbox.innerHTML += `<div class="bot"><b>🤖 Digital Nurse Assistant:</b> <br>Error talking to server.</div>`;
    }
}

// ************** LANGUAGE PREFERENCE HANDLING *****************************

// Handle language preference changes
function handleLanguageChange() {
    const languageSelect = document.getElementById("language-select");
    const newLanguage = languageSelect.value;
    const patientId = sessionStorage.getItem("userId");
  
    console.log("🇸🇬 Changing language preference to:", newLanguage);
  
    // Update language in database
    fetch("/patient/update-language", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ patientId, language: newLanguage })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            console.log("✅ Language preference updated successfully");
            // Show floating notification
            const messages = {
                'en': 'Language preference updated to English',
                'zh': '语言偏好已更新为中文',
                'ms': 'Pilihan bahasa dikemas kini kepada Bahasa Melayu',
                'ta': 'மொழி விருப்பம் தமிழுக்கு புதுப்பிக்கப்பட்டது'
            };
            showLanguageUpdateNotification(messages[newLanguage] || messages['en'], 'success');
        } else {
            console.error("❌ Failed to update language preference");
            showLanguageUpdateNotification('Failed to update language preference. Please try again.', 'error');
        }
    })
    .catch(err => {
        console.error("❌ Error updating language preference:", err);
        showLanguageUpdateNotification('Error updating language preference. Please check your connection.', 'error');
    });
}

// Show floating notification for language updates
function showLanguageUpdateNotification(message, type = 'success') {
    // Create notification element
    const notification = document.createElement('div');
    
    // Set styles based on type
    const backgroundColor = type === 'success' ? '#10b981' : '#ef4444';
    const icon = type === 'success' ? '✅' : '❌';
    
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: ${backgroundColor};
        color: white;
        padding: 12px 20px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        z-index: 10000;
        font-size: 0.9rem;
        font-weight: 500;
        max-width: 350px;
        animation: slideInRight 0.3s ease-out;
    `;
    notification.innerHTML = `${icon} ${message}`;
    
    // Add animation styles to document if not already present
    if (!document.getElementById('notification-styles')) {
        const style = document.createElement('style');
        style.id = 'notification-styles';
        style.textContent = `
            @keyframes slideInRight {
                from { transform: translateX(100%); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }
            @keyframes slideOutRight {
                from { transform: translateX(0); opacity: 1; }
                to { transform: translateX(100%); opacity: 0; }
            }
        `;
        document.head.appendChild(style);
    }
    
    // Add to page
    document.body.appendChild(notification);
    
    // Remove after 3 seconds
    setTimeout(() => {
        notification.style.animation = 'slideOutRight 0.3s ease-in';
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    }, 3000);
}

// Add event listener for language dropdown changes
document.addEventListener('DOMContentLoaded', function() {
    const languageSelect = document.getElementById("language-select");
    if (languageSelect) {
        languageSelect.addEventListener('change', handleLanguageChange);
        console.log("🇸🇬 Language change listener added");
    }
});

// Make sendMessage function globally accessible
window.sendMessage = sendMessage;