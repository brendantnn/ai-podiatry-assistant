// window.onload = async () => {
//     const loadingScreen = document.getElementById("loading-screen");
//     loadingScreen.style.display = "flex"; // show loading

//     const patientId = sessionStorage.getItem("userId");
//     const chatbox = document.getElementById("chatbox");
  
//     try {
//         const res = await fetch("/patient/chat-patient-details", {
//             method: "POST",
//             headers: { "Content-Type": "application/json" },
//             body: JSON.stringify({ patientId })
//         });

//         console.log("✅ Raw response:", res);

//         // Get patient name, appointment from database and assign to variables
//         const data = await res.json();
//         console.log("✅ JSON data received:", data);

//         const name = data.name; 
//         const appointment = data.appointment;

//         // Set patient name at top bar
//         document.getElementById("patient-name").textContent = name || "no patient name";

//         // Set user's language preference from database
//         const userLanguage = data.language || "en"; // Default to English if not set
//         const languageSelect = document.getElementById("language-select");
//         if (languageSelect) {
//             languageSelect.value = userLanguage;
//             console.log("🇸🇬 User's saved language preference:", userLanguage);
//         }
          
//         let appointmentText = "You have no upcoming confirmed appointments.";
//         let appointmentTextTwo = "You have no upcoming confirmed appointments.";

//         const appointmentListContainer = document.getElementById("appointment-list");

//         // Get all upcoming appointments
//         if (data.allAppointments && Array.isArray(data.allAppointments)) {
//             appointmentListContainer.innerHTML = ""; // Clear placeholder

//             data.allAppointments.forEach(appt => {
//                 const dateObj = new Date(appt.date);
//                 const formattedDate = dateObj.toLocaleString("en-SG", {
//                     weekday: "long",
//                     year: "numeric",
//                     month: "long",
//                     day: "numeric",
//                     hour: "2-digit",
//                     minute: "2-digit",
//                     hour12: true,
//                     timeZone: "Asia/Singapore"
//                 });

//                 const doctor = appt.podiatrist || appt.doctor || "your podiatrist";
//                 const type = appt.type || "Consultation";

//                 const html = `
//                     <div class="medical-card" style="
//                         padding: 1.25rem 1.5rem;
//                         margin-bottom: 1rem;
//                         border-radius: 12px;
//                         background-color: white;
//                         box-shadow: 0 2px 6px rgba(0, 0, 0, 0.05);
//                     ">
//                         <div class="flex justify-between items-center">
//                             <div>
//                                 <p class="text-primary font-semibold" style="margin: 0;">${formattedDate}</p>
//                                 <p class="text-muted" style="font-size: 0.85rem; margin-top: 0.25rem;">${doctor} - ${type}</p>
//                             </div>
//                             <span class="medical-badge badge-success">CONFIRMED</span>
//                         </div>
//                     </div>
//                 `;

//                 appointmentListContainer.innerHTML += html;
//             });
//         } else {
//             appointmentListContainer.innerHTML = "<p class='text-muted'>No upcoming appointments.</p>";
//         }

//         if (appointment && appointment.date) {
//             const formattedDate = new Date(appointment.date).toLocaleString("en-SG", {
//                 weekday: "long",
//                 year: "numeric",
//                 month: "long",
//                 day: "numeric",
//                 hour: "2-digit",
//                 minute: "2-digit",
//                 hour12: true,
//                 timeZone: "Asia/Singapore"
//             });

//             const doctor = appointment.podiatrist || appointment.doctor || "your podiatrist";
//             appointmentText = `🗓️ You have an upcoming appointment on <b>${formattedDate}</b> with <b>${doctor}</b>.`;
//             appointmentTextTwo = `📅 Next appointment: ${formattedDate} with ${doctor}`;
      
//             document.getElementById("appointment").textContent = appointmentTextTwo;
//         }

//         // Show combined message
//         chatbox.innerHTML += `
//             <div class="bot">
//                 <b>🤖 Digital Nurse Assistant:</b> <br>Hello <b>${name}</b>! I'm here to help you with anything related to your foot health.
//                 <br><br>
//                 ${appointmentText}
//                 <br><br>
//                 Would you like help checking any foot concerns today — or would you prefer to just view your upcoming appointment details?
//             </div>
//         `;

//         chatbox.scrollTop = chatbox.scrollHeight;
        
//         // Apply translation if user's language is not English
//         if (userLanguage !== 'en') {
//             console.log('🌐 Applying translation for saved language preference:', userLanguage);
//             await translatePageElements(userLanguage);
//         }
        
//         loadingScreen.style.display = "none"; // hide loading screen

//     } catch (err) {
//         console.error("❌ Failed to fetch patient details:", err);
//         chatbox.innerHTML += `
//             <div class="bot">
//                 <b>🤖 Digital Nurse Assistant:</b><br>⚠️ Unable to fetch patient details.
//             </div>
//         `;
//         loadingScreen.style.display = "none";
//     }
// };

// ************** SENDING AND DISPLAYING MESSAGES IN CHATBOT *****************************

// Called when user clicks send button in HTML page
window.onload = async () => {
    const loadingScreen = document.getElementById("loading-screen");
    loadingScreen.style.display = "flex";

    const patientId = sessionStorage.getItem("userId");
    const chatbox = document.getElementById("chatbox");
  
    try {
        const res = await fetch("/patient/chat-patient-details", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ patientId })
        });

        const data = await res.json();
        const name = data.name; 
        const appointment = data.appointment;

        // Set patient name at top bar
        document.getElementById("patient-name").textContent = name || "no patient name";

        // Set user's language preference from database
        const userLanguage = data.language || "en";
        const languageSelect = document.getElementById("language-select");
        if (languageSelect) {
            languageSelect.value = userLanguage;
        }
          
        let appointmentText = "You have no upcoming confirmed appointments.";
        let appointmentTextTwo = "You have no upcoming confirmed appointments.";

        const appointmentListContainer = document.getElementById("appointment-list");

        // Process appointments
        if (data.allAppointments && Array.isArray(data.allAppointments)) {
            appointmentListContainer.innerHTML = "";

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

        // Show chatbot welcome message
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
        
        // IMPORTANT: Hide loading screen FIRST, then translate in background
        loadingScreen.style.display = "none";
        
        // Apply translation in background if needed (much faster now!)
        if (userLanguage !== 'en') {
            console.log('🌐 Applying fast translation for:', userLanguage);
            // This now happens after page is shown, so no loading delay!
            setTimeout(() => {
                translatePageElements(userLanguage);
            }, 100); // Small delay to let page render first
        }

    } catch (err) {
        console.error("❌ Failed to fetch patient details:", err);
        chatbox.innerHTML += `
            <div class="bot">
                <b>🤖 Digital Nurse Assistant:</b><br>⚠️ Unable to fetch patient details.
            </div>
        `;
        loadingScreen.style.display = "none";
    }
};

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
// ************** TRANSLATION UTILITIES *****************************

// // Translation function
// async function translateText(text, targetLanguage) {
//     if (targetLanguage === 'en' || !text || text.trim() === '') {
//         return text;
//     }
    
//     try {
//         const response = await fetch("/patient/translate", {
//             method: "POST",
//             headers: { "Content-Type": "application/json" },
//             body: JSON.stringify({ text, targetLanguage })
//         });
        
//         const data = await response.json();
//         return data.translatedText || text;
//     } catch (error) {
//         console.error('Translation failed:', error);
//         return text; // Return original text if translation fails
//     }
// }

// // Translate page elements
// async function translatePageElements(targetLanguage) {
//     if (targetLanguage === 'en') {
//         // Reset to original English text
//         resetToEnglish();
//         return;
//     }
    
//     console.log('🌐 Translating page to:', targetLanguage);
    
//     // Define elements to translate with their original English text
//     const elementsToTranslate = [
//         // Header elements
//         { selector: '.medical-header h1', originalText: '🏥 Patient Portal' },
//         { selector: '.subtitle', originalText: 'Singapore General Hospital - Podiatry Digital Assistant' },
        
//         // Welcome section
//         { selector: '.medical-card-title', originalText: '👤 Welcome, ' },
//         { selector: 'label[for="language-select"]', originalText: 'Language Preference:' },
//         { selector: 'button[onclick="handleLogout()"]', originalText: '🚪 Logout' },
        
//         // Chat section
//         { selector: '.medical-card-header .medical-card-title', originalText: '🤖 Digital Nurse Assistant Chatbot' },
//         { selector: '.medical-card-subtitle', originalText: 'Talk to our digital nurse assistant to get help with your foot health concerns and appointment booking!' },
//         { selector: '#message', originalText: 'Describe your symptoms or ask a question...', isPlaceholder: true },
//         { selector: 'button[onclick="sendMessage()"]', originalText: '📤 Send' },
        
//         // Appointments section
//         { selector: '.widget-title', originalText: '📅 Upcoming Appointments' },
        
//         // Emergency contacts
//         { selector: '.medical-card-header h3', originalText: '🚨 Emergency Contacts' },
//         { selector: '.dashboard-widget .widget-title:first-of-type', originalText: '📞 Hospital Contacts' },
//         { selector: '.dashboard-widget .widget-title:last-of-type', originalText: 'ℹ️ Important Notes' }
//     ];
    
//     // Translate each element
//     for (const item of elementsToTranslate) {
//         try {
//             const elements = document.querySelectorAll(item.selector);
//             const translatedText = await translateText(item.originalText, targetLanguage);
            
//             elements.forEach(element => {
//                 if (item.isPlaceholder) {
//                     element.placeholder = translatedText;
//                 } else if (item.selector.includes('Welcome')) {
//                     // Handle welcome message specially to preserve patient name
//                     const patientName = element.textContent.split('Welcome, ')[1];
//                     element.innerHTML = `👤 ${translatedText}${patientName || ''}`;
//                 } else {
//                     element.textContent = translatedText;
//                 }
//             });
//         } catch (error) {
//             console.error(`Failed to translate ${item.selector}:`, error);
//         }
//     }
    
//     // Translate static text elements
//     await translateStaticElements(targetLanguage);
// }

// // Translate static text in emergency contacts and other areas
// async function translateStaticElements(targetLanguage) {
//     // Emergency contact text elements
//     const staticTexts = [
//         { selector: '.flex.items-center span:contains("SGH Main Line")', originalText: 'SGH Main Line: 6222 3322' },
//         { selector: '.flex.items-center span:contains("Podiatry Clinic")', originalText: 'Podiatry Clinic: 6321 4377' },
//         { selector: '.flex.items-center span:contains("Emergency")', originalText: 'Emergency: 995' }
//     ];
    
//     // Translate paragraph texts
//     const paragraphs = document.querySelectorAll('.text-muted');
//     for (const p of paragraphs) {
//         if (p.textContent.includes('severe pain')) {
//             const translated = await translateText('If you experience severe pain, bleeding, or signs of infection, please seek immediate medical attention.', targetLanguage);
//             p.textContent = translated;
//         } else if (p.textContent.includes('urgent concerns')) {
//             const translated = await translateText('For urgent concerns outside clinic hours, visit the Emergency Department.', targetLanguage);
//             p.textContent = translated;
//         }
//     }
// }

// // Reset page to English
// function resetToEnglish() {
//     // Reset all elements to original English text
//     const resetMap = {
//         '.medical-header h1': '🏥 Patient Portal',
//         '.subtitle': 'Singapore General Hospital - Podiatry Digital Assistant',
//         'label[for="language-select"]': 'Language Preference:',
//         'button[onclick="handleLogout()"]': '🚪 Logout',
//         '.medical-card-header .medical-card-title': '🤖 Digital Nurse Assistant Chatbot',
//         '.medical-card-subtitle': 'Talk to our digital nurse assistant to get help with your foot health concerns and appointment booking!',
//         'button[onclick="sendMessage()"]': '📤 Send',
//         '.widget-title': '📅 Upcoming Appointments',
//         '.medical-card-header h3': '🚨 Emergency Contacts'
//     };
    
//     Object.entries(resetMap).forEach(([selector, text]) => {
//         const elements = document.querySelectorAll(selector);
//         elements.forEach(el => el.textContent = text);
//     });
    
//     // Reset placeholder
//     const messageInput = document.getElementById('message');
//     if (messageInput) {
//         messageInput.placeholder = 'Describe your symptoms or ask a question...';
//     }
// }

// // Update handleLanguageChange function
// async function handleLanguageChange() {
//     const languageSelect = document.getElementById("language-select");
//     const newLanguage = languageSelect.value;
//     const patientId = sessionStorage.getItem("userId");
  
//     console.log("🇸🇬 Changing language preference to:", newLanguage);
    
//     // Show loading indicator
//     languageSelect.disabled = true;
//     const originalOption = languageSelect.options[languageSelect.selectedIndex].text;
//     languageSelect.options[languageSelect.selectedIndex].text = '⏳ Translating...';
  
//     try {
//         // Update language in database
//         const response = await fetch("/patient/update-language", {
//             method: "POST",
//             headers: { "Content-Type": "application/json" },
//             body: JSON.stringify({ patientId, language: newLanguage })
//         });
        
//         const data = await response.json();
        
//         if (data.success) {
//             console.log("✅ Language preference updated successfully");
            
//             // Translate the page
//             await translatePageElements(newLanguage);
            
//             // Show success notification
//             const messages = {
//                 'en': 'Language preference updated to English',
//                 'zh': '语言偏好已更新为中文',
//                 'ms': 'Pilihan bahasa dikemas kini kepada Bahasa Melayu',
//                 'ta': 'மொழி விருப்பம் தமிழுக்கு புதுப்பிக்கப்பட்டது'
//             };
//             showLanguageUpdateNotification(messages[newLanguage] || messages['en'], 'success');
//         } else {
//             console.error("❌ Failed to update language preference");
//             showLanguageUpdateNotification('Failed to update language preference. Please try again.', 'error');
//         }
//     } catch (err) {
//         console.error("❌ Error updating language preference:", err);
//         showLanguageUpdateNotification('Error updating language preference. Please check your connection.', 'error');
//     } finally {
//         // Restore dropdown state
//         languageSelect.disabled = false;
//         languageSelect.options[languageSelect.selectedIndex].text = originalOption;
//     }
// }

// ************** OPTIMIZED TRANSLATION UTILITIES *****************************

// // Batch translation function - much faster!
// async function translateBatch(texts, targetLanguage) {
//     if (targetLanguage === 'en' || !texts || texts.length === 0) {
//         return texts;
//     }
    
//     try {
//         const response = await fetch("/patient/translate-batch", {
//             method: "POST",
//             headers: { "Content-Type": "application/json" },
//             body: JSON.stringify({ texts, targetLanguage })
//         });
        
//         const data = await response.json();
//         return data.translations || texts;
//     } catch (error) {
//         console.error('Batch translation failed:', error);
//         return texts; // Return originals if translation fails
//     }
// }

// // Store original content to prevent corruption
// let originalContent = {};

// // Function to store original content
// function storeOriginalContent() {
//     if (Object.keys(originalContent).length > 0) return; // Already stored
    
//     originalContent = {
//         header: '🏥 Patient Portal',
//         subtitle: 'Singapore General Hospital - Podiatry Digital Assistant',
//         welcomePrefix: '👤 Welcome, ',
//         languageLabel: 'Language Preference:',
//         logoutBtn: '🚪 Logout',
//         chatTitle: '🤖 Digital Nurse Assistant Chatbot',
//         chatSubtitle: 'Talk to our digital nurse assistant to get help with your foot health concerns and appointment booking!',
//         messagePlaceholder: 'Describe your symptoms or ask a question...',
//         sendBtn: '📤 Send',
//         appointmentsTitle: '📅 Upcoming Appointments',
//         emergencyTitle: '🚨 Emergency Contacts',
//         hospitalContactsTitle: '📞 Hospital Contacts',
//         importantNotesTitle: 'ℹ️ Important Notes',
//         sghMainLine: 'SGH Main Line: 6222 3322',
//         podiatryClinic: 'Podiatry Clinic: 6321 4377',
//         emergency: 'Emergency: 995',
//         severePainText: 'If you experience severe pain, bleeding, or signs of infection, please seek immediate medical attention.',
//         urgentConcernsText: 'For urgent concerns outside clinic hours, visit the Emergency Department.',
//         noAppointments: 'No upcoming appointments.'
//     };
// }

// // Super fast batch translation of all elements at once
// async function translatePageElements(targetLanguage) {
//     if (targetLanguage === 'en') {
//         resetToEnglish();
//         return;
//     }
    
//     console.log('🌐 Fast batch translating page to:', targetLanguage);
//     storeOriginalContent();
    
//     // Show loading indicator
//     showTranslationLoading(true);
    
//     try {
//         // Collect all texts to translate in one batch
//         const textsToTranslate = [
//             originalContent.header,
//             originalContent.subtitle,
//             originalContent.welcomePrefix,
//             originalContent.languageLabel,
//             originalContent.logoutBtn,
//             originalContent.chatTitle,
//             originalContent.chatSubtitle,
//             originalContent.messagePlaceholder,
//             originalContent.sendBtn,
//             originalContent.appointmentsTitle,
//             originalContent.emergencyTitle,
//             originalContent.hospitalContactsTitle,
//             originalContent.importantNotesTitle,
//             originalContent.sghMainLine,
//             originalContent.podiatryClinic,
//             originalContent.emergency,
//             originalContent.severePainText,
//             originalContent.urgentConcernsText,
//             originalContent.noAppointments
//         ];
        
//         // Single API call for all translations!
//         const translations = await translateBatch(textsToTranslate, targetLanguage);
        
//         // Apply all translations at once
//         applyTranslations(translations);
        
//         console.log('✅ Fast batch translation completed');
        
//     } catch (error) {
//         console.error('Fast translation error:', error);
//     } finally {
//         showTranslationLoading(false);
//     }
// }

// // Apply all translations to elements at once
// function applyTranslations(translations) {
//     const [
//         header, subtitle, welcomePrefix, languageLabel, logoutBtn,
//         chatTitle, chatSubtitle, messagePlaceholder, sendBtn, appointmentsTitle,
//         emergencyTitle, hospitalContactsTitle, importantNotesTitle,
//         sghMainLine, podiatryClinic, emergency, severePainText, urgentConcernsText, noAppointments
//     ] = translations;
    
//     // Apply all translations efficiently
//     const updates = [
//         { selector: '.medical-header h1', text: header },
//         { selector: '.subtitle', text: subtitle },
//         { selector: 'label[for="language-select"]', text: languageLabel },
//         { selector: 'button[onclick="handleLogout()"]', text: logoutBtn },
//         { selector: '.medical-card-header .medical-card-title', text: chatTitle, condition: (el) => el.textContent.includes('Digital Nurse Assistant') },
//         { selector: '.medical-card-subtitle', text: chatSubtitle, condition: (el) => el.textContent.includes('Talk to our digital nurse') },
//         { selector: 'button[onclick="sendMessage()"]', text: sendBtn },
//         { selector: '.widget-title', text: appointmentsTitle, condition: (el) => el.textContent.includes('Upcoming Appointments') },
//         { selector: '.medical-card-header h3', text: emergencyTitle, condition: (el) => el.textContent.includes('Emergency Contacts') }
//     ];
    
//     // Apply text updates
//     updates.forEach(({ selector, text, condition }) => {
//         const elements = document.querySelectorAll(selector);
//         elements.forEach(el => {
//             if (!condition || condition(el)) {
//                 el.textContent = text;
//             }
//         });
//     });
    
//     // Handle special cases
//     const messageInput = document.getElementById('message');
//     if (messageInput) messageInput.placeholder = messagePlaceholder;
    
//     // Update welcome message with patient name preservation
//     const welcomeElement = document.querySelector('.medical-card-title');
//     if (welcomeElement && welcomeElement.textContent.includes('Welcome')) {
//         const patientName = welcomeElement.textContent.replace(/.*Welcome,\s*/, '');
//         welcomeElement.innerHTML = `${welcomePrefix}<span id="patient-name">${patientName}</span>`;
//     }
    
//     // Update widget titles
//     const widgetTitles = document.querySelectorAll('.dashboard-widget .widget-title');
//     widgetTitles.forEach((title, index) => {
//         if (index === 0 && title.textContent.includes('Hospital')) {
//             title.textContent = hospitalContactsTitle;
//         } else if (index === 1 && title.textContent.includes('Important')) {
//             title.textContent = importantNotesTitle;
//         }
//     });
    
//     // Update emergency contact info
//     const contactSpans = document.querySelectorAll('.flex.items-center span');
//     contactSpans.forEach((span) => {
//         if (span.textContent.includes('SGH Main Line')) span.textContent = sghMainLine;
//         else if (span.textContent.includes('Podiatry Clinic')) span.textContent = podiatryClinic;
//         else if (span.textContent.includes('Emergency: 995')) span.textContent = emergency;
//     });
    
//     // Update emergency paragraphs
//     const emergencyParagraphs = document.querySelectorAll('.dashboard-widget .text-muted');
//     emergencyParagraphs.forEach((p) => {
//         if (p.textContent.includes('severe pain')) p.textContent = severePainText;
//         else if (p.textContent.includes('urgent concerns')) p.textContent = urgentConcernsText;
//     });
    
//     // Update "No appointments" text if present
//     const noApptElements = document.querySelectorAll('.text-muted');
//     noApptElements.forEach(el => {
//         if (el.textContent.includes('No upcoming appointments')) {
//             el.textContent = noAppointments;
//         }
//     });
// }

// // Show/hide translation loading indicator
// function showTranslationLoading(show) {
//     const indicator = document.getElementById('translation-loading');
//     if (show && !indicator) {
//         const loading = document.createElement('div');
//         loading.id = 'translation-loading';
//         loading.style.cssText = `
//             position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
//             background: rgba(0,0,0,0.8); color: white; padding: 20px;
//             border-radius: 10px; z-index: 10000; font-size: 16px;
//         `;
//         loading.innerHTML = '🌐 Translating page...';
//         document.body.appendChild(loading);
//     } else if (!show && indicator) {
//         indicator.remove();
//     }
// }

// // Reset page to English using stored original content
// function resetToEnglish() {
//     if (Object.keys(originalContent).length === 0) {
//         storeOriginalContent();
//     }
    
//     // Use the stored English content to reset everything
//     const englishTexts = Object.values(originalContent);
//     applyTranslations(englishTexts);
// }

// // Optimized handleLanguageChange function
// async function handleLanguageChange() {
//     const languageSelect = document.getElementById("language-select");
//     const newLanguage = languageSelect.value;
//     const patientId = sessionStorage.getItem("userId");
  
//     console.log("🇸🇬 Changing language preference to:", newLanguage);
    
//     // Show loading state
//     languageSelect.disabled = true;
//     const originalOption = languageSelect.options[languageSelect.selectedIndex].text;
//     languageSelect.options[languageSelect.selectedIndex].text = '⏳ Updating...';
  
//     try {
//         // Update language in database and translate page simultaneously
//         const [dbResponse] = await Promise.all([
//             fetch("/patient/update-language", {
//                 method: "POST",
//                 headers: { "Content-Type": "application/json" },
//                 body: JSON.stringify({ patientId, language: newLanguage })
//             }),
//             translatePageElements(newLanguage) // This happens in parallel!
//         ]);
        
//         const data = await dbResponse.json();
        
//         if (data.success) {
//             console.log("✅ Language preference updated successfully");
            
//             // Show success notification
//             const messages = {
//                 'en': 'Language preference updated to English',
//                 'zh': '语言偏好已更新为中文',
//                 'ms': 'Pilihan bahasa dikemas kini kepada Bahasa Melayu',
//                 'ta': 'மொழி விருப்பம் தமிழுக்கு புதுப்பிக்கப்பட்டது'
//             };
//             showLanguageUpdateNotification(messages[newLanguage] || messages['en'], 'success');
//         } else {
//             console.error("❌ Failed to update language preference");
//             showLanguageUpdateNotification('Failed to update language preference. Please try again.', 'error');
//         }
//     } catch (err) {
//         console.error("❌ Error updating language preference:", err);
//         showLanguageUpdateNotification('Error updating language preference. Please check your connection.', 'error');
//     } finally {
//         // Restore dropdown state
//         languageSelect.disabled = false;
//         languageSelect.options[languageSelect.selectedIndex].text = originalOption;
//     }
// }

// // ************** FORCED ELEMENT UPDATE TRANSLATION SYSTEM *****************************

// // Fast batch translation with smart fallback
// async function translateBatchFast(texts, targetLanguage) {
//     if (targetLanguage === 'en' || !texts || texts.length === 0) {
//         return texts;
//     }
    
//     try {
//         const response = await fetch("/patient/translate-batch", {
//             method: "POST",
//             headers: { "Content-Type": "application/json" },
//             body: JSON.stringify({ texts, targetLanguage })
//         });
        
//         const data = await response.json();
//         return data.translations || texts;
//     } catch (error) {
//         console.error('Batch translation failed, using individual fallback:', error);
        
//         const individualResults = await Promise.all(
//             texts.map(async (text) => {
//                 if (!text || !text.trim()) return text;
//                 try {
//                     const response = await fetch("/patient/translate", {
//                         method: "POST",
//                         headers: { "Content-Type": "application/json" },
//                         body: JSON.stringify({ text: text.trim(), targetLanguage })
//                     });
//                     const data = await response.json();
//                     return data.translatedText || text;
//                 } catch (err) {
//                     return text;
//                 }
//             })
//         );
//         return individualResults;
//     }
// }

// // Store original content and element mappings
// let originalContent = {};
// let elementMap = new Map(); // Store exact element references
// let isTranslating = false;

// function storeOriginalContent() {
//     if (Object.keys(originalContent).length > 0) return;
    
//     originalContent = {
//         header: 'Patient Portal',
//         subtitle: 'Singapore General Hospital - Podiatry Digital Assistant',
//         welcomePrefix: 'Welcome, ',
//         languageLabel: 'Language Preference:',
//         logoutBtn: 'Logout',
//         chatTitle: 'Digital Nurse Assistant Chatbot',
//         chatSubtitle: 'Talk to our digital nurse assistant to get help with your foot health concerns and appointment booking!',
//         messagePlaceholder: 'Describe your symptoms or ask a question...',
//         sendBtn: 'Send',
//         appointmentsTitle: 'Upcoming Appointments',
//         emergencyTitle: 'Emergency Contacts',
//         hospitalContactsTitle: 'Hospital Contacts',
//         importantNotesTitle: 'Important Notes',
//         sghMainLine: 'SGH Main Line: 6222 3322',
//         podiatryClinic: 'Podiatry Clinic: 6321 4377',
//         emergency: 'Emergency: 995',
//         severePainText: 'If you experience severe pain, bleeding, or signs of infection, please seek immediate medical attention.',
//         urgentConcernsText: 'For urgent concerns outside clinic hours, visit the Emergency Department.',
//         noAppointments: 'No upcoming appointments.'
//     };
// }

// // Map all translatable elements on page load
// function mapTranslatableElements() {
//     if (elementMap.size > 0) return; // Already mapped
    
//     console.log('📍 Mapping all translatable elements...');
    
//     // Map elements by their function, not content
//     elementMap.set('header', document.querySelector('.medical-header h1'));
//     elementMap.set('subtitle', document.querySelector('.medical-header .subtitle'));
//     elementMap.set('welcome', document.querySelector('.medical-card .medical-card-title'));
//     elementMap.set('languageLabel', document.querySelector('label[for="language-select"]'));
//     elementMap.set('logoutBtn', document.querySelector('button[onclick="handleLogout()"]'));
//     elementMap.set('messageInput', document.getElementById('message'));
//     elementMap.set('sendBtn', document.querySelector('button[onclick="sendMessage()"]'));
    
//     // Find chat elements by structure position
//     const chatCards = document.querySelectorAll('.medical-card-header .medical-card-title');
//     elementMap.set('chatTitle', chatCards[0]); // First card title is chat title
    
//     elementMap.set('chatSubtitle', document.querySelector('.medical-card-subtitle'));
    
//     // Find appointments widget
//     const widgets = document.querySelectorAll('.widget-title');
//     elementMap.set('appointmentsTitle', widgets[0]); // First widget is appointments
    
//     // Find emergency section
//     const emergencyHeaders = document.querySelectorAll('.medical-card-header h3');
//     elementMap.set('emergencyTitle', emergencyHeaders[emergencyHeaders.length - 1]); // Last h3 is emergency
    
//     // Dashboard widgets
//     const dashboardWidgets = document.querySelectorAll('.dashboard-widget .widget-title');
//     elementMap.set('hospitalContacts', dashboardWidgets[0]);
//     elementMap.set('importantNotes', dashboardWidgets[1]);
    
//     // Contact spans - map by position
//     const contactSpans = document.querySelectorAll('.flex.items-center span');
//     contactSpans.forEach((span, index) => {
//         if (index === 1) elementMap.set('sghMainLine', span); // Second span (after icon)
//         if (index === 3) elementMap.set('podiatryClinic', span); // Fourth span
//         if (index === 5) elementMap.set('emergency', span); // Sixth span
//     });
    
//     // Emergency paragraphs - map by position
//     const emergencyParas = document.querySelectorAll('.dashboard-widget .text-muted');
//     elementMap.set('severePain', emergencyParas[0]);
//     elementMap.set('urgentConcerns', emergencyParas[1]);
    
//     // No appointments text
//     const noApptEl = document.querySelector('#appointment-list .text-muted');
//     elementMap.set('noAppointments', noApptEl);
    
//     console.log(`📍 Mapped ${elementMap.size} elements for translation`);
// }

// // FORCED translation that updates ALL elements regardless of current content
// async function translatePageElements(targetLanguage) {
//     if (isTranslating) return;
    
//     if (targetLanguage === 'en') {
//         resetToEnglish();
//         return;
//     }
    
//     isTranslating = true;
//     console.log('🔄 FORCED translation to:', targetLanguage);
//     storeOriginalContent();
//     mapTranslatableElements();
    
//     showTranslationLoading(true);
    
//     try {
//         // Get patient name BEFORE any translation
//         const welcomeEl = elementMap.get('welcome');
//         let patientName = '';
//         if (welcomeEl) {
//             const text = welcomeEl.textContent || '';
//             // Extract name after any welcome word in any language
//             const nameMatch = text.match(/(?:Welcome|欢迎|வரவேற்கிறோம்|Selamat Datang)[,\s]*(.+)/i);
//             if (nameMatch && nameMatch[1]) {
//                 patientName = nameMatch[1].trim();
//             }
//         }
        
//         // Collect all texts for translation
//         const textsToTranslate = [
//             originalContent.header,                    // 0
//             originalContent.subtitle,                  // 1
//             originalContent.welcomePrefix,             // 2
//             originalContent.languageLabel,             // 3
//             originalContent.logoutBtn,                 // 4
//             originalContent.chatTitle,                 // 5
//             originalContent.chatSubtitle,              // 6
//             originalContent.messagePlaceholder,        // 7
//             originalContent.sendBtn,                   // 8
//             originalContent.appointmentsTitle,         // 9
//             originalContent.emergencyTitle,            // 10
//             originalContent.hospitalContactsTitle,     // 11
//             originalContent.importantNotesTitle,       // 12
//             originalContent.sghMainLine,               // 13
//             originalContent.podiatryClinic,            // 14
//             originalContent.emergency,                 // 15
//             originalContent.severePainText,            // 16
//             originalContent.urgentConcernsText,        // 17
//             originalContent.noAppointments            // 18
//         ];
        
//         console.log('🚀 Batch translating all elements...');
        
//         // Single batch translation
//         const translations = await translateBatchFast(textsToTranslate, targetLanguage);
        
//         // FORCE update all elements
//         forceUpdateAllElements(translations, patientName);
        
//         console.log('✅ FORCED translation completed successfully');
        
//     } catch (error) {
//         console.error('Translation error:', error);
//     } finally {
//         showTranslationLoading(false);
//         isTranslating = false;
//     }
// }

// // Force update ALL elements using mapped references
// function forceUpdateAllElements(translations, patientName) {
//     const [
//         header, subtitle, welcomePrefix, languageLabel, logoutBtn,
//         chatTitle, chatSubtitle, messagePlaceholder, sendBtn, appointmentsTitle,
//         emergencyTitle, hospitalContactsTitle, importantNotesTitle,
//         sghMainLine, podiatryClinic, emergency, severePainText, urgentConcernsText, noAppointments
//     ] = translations;
    
//     // Force update using requestAnimationFrame for smoothness
//     requestAnimationFrame(() => {
//         console.log('🔧 Force updating all mapped elements...');
        
//         // FORCE update each element regardless of current content
//         const headerEl = elementMap.get('header');
//         if (headerEl) {
//             headerEl.textContent = `🏥 ${header}`;
//             console.log('✓ Header updated:', header);
//         }
        
//         const subtitleEl = elementMap.get('subtitle');
//         if (subtitleEl) {
//             subtitleEl.textContent = subtitle;
//             console.log('✓ Subtitle updated:', subtitle);
//         }
        
//         const welcomeEl = elementMap.get('welcome');
//         if (welcomeEl && patientName) {
//             welcomeEl.innerHTML = `👤 ${welcomePrefix}<span id="patient-name">${patientName}</span>`;
//             console.log('✓ Welcome updated:', welcomePrefix + patientName);
//         }
        
//         const languageLabelEl = elementMap.get('languageLabel');
//         if (languageLabelEl) {
//             languageLabelEl.textContent = languageLabel;
//             console.log('✓ Language label updated:', languageLabel);
//         }
        
//         const logoutBtnEl = elementMap.get('logoutBtn');
//         if (logoutBtnEl) {
//             logoutBtnEl.textContent = `🚪 ${logoutBtn}`;
//             console.log('✓ Logout button updated:', logoutBtn);
//         }
        
//         const chatTitleEl = elementMap.get('chatTitle');
//         if (chatTitleEl) {
//             chatTitleEl.textContent = `🤖 ${chatTitle}`;
//             console.log('✓ Chat title updated:', chatTitle);
//         }
        
//         const chatSubtitleEl = elementMap.get('chatSubtitle');
//         if (chatSubtitleEl) {
//             chatSubtitleEl.textContent = chatSubtitle;
//             console.log('✓ Chat subtitle updated');
//         }
        
//         const messageInput = elementMap.get('messageInput');
//         if (messageInput) {
//             messageInput.placeholder = messagePlaceholder;
//             console.log('✓ Message placeholder updated');
//         }
        
//         const sendBtnEl = elementMap.get('sendBtn');
//         if (sendBtnEl) {
//             sendBtnEl.textContent = `📤 ${sendBtn}`;
//             console.log('✓ Send button updated:', sendBtn);
//         }
        
//         const appointmentsTitleEl = elementMap.get('appointmentsTitle');
//         if (appointmentsTitleEl) {
//             appointmentsTitleEl.textContent = `📅 ${appointmentsTitle}`;
//             console.log('✓ Appointments title updated:', appointmentsTitle);
//         }
        
//         const emergencyTitleEl = elementMap.get('emergencyTitle');
//         if (emergencyTitleEl) {
//             emergencyTitleEl.textContent = `🚨 ${emergencyTitle}`;
//             console.log('✓ Emergency title updated:', emergencyTitle);
//         }
        
//         const hospitalContactsEl = elementMap.get('hospitalContacts');
//         if (hospitalContactsEl) {
//             hospitalContactsEl.textContent = `📞 ${hospitalContactsTitle}`;
//             console.log('✓ Hospital contacts updated:', hospitalContactsTitle);
//         }
        
//         const importantNotesEl = elementMap.get('importantNotes');
//         if (importantNotesEl) {
//             importantNotesEl.textContent = `ℹ️ ${importantNotesTitle}`;
//             console.log('✓ Important notes updated:', importantNotesTitle);
//         }
        
//         const sghMainLineEl = elementMap.get('sghMainLine');
//         if (sghMainLineEl) {
//             sghMainLineEl.innerHTML = `🏥 ${sghMainLine}`;
//             console.log('✓ SGH main line updated:', sghMainLine);
//         }
        
//         const podiatryClinicEl = elementMap.get('podiatryClinic');
//         if (podiatryClinicEl) {
//             podiatryClinicEl.innerHTML = `🦶 ${podiatryClinic}`;
//             console.log('✓ Podiatry clinic updated:', podiatryClinic);
//         }
        
//         const emergencyEl = elementMap.get('emergency');
//         if (emergencyEl) {
//             emergencyEl.innerHTML = `🚨 ${emergency}`;
//             console.log('✓ Emergency updated:', emergency);
//         }
        
//         const severePainEl = elementMap.get('severePain');
//         if (severePainEl) {
//             severePainEl.textContent = severePainText;
//             console.log('✓ Severe pain text updated');
//         }
        
//         const urgentConcernsEl = elementMap.get('urgentConcerns');
//         if (urgentConcernsEl) {
//             urgentConcernsEl.textContent = urgentConcernsText;
//             console.log('✓ Urgent concerns text updated');
//         }
        
//         const noAppointmentsEl = elementMap.get('noAppointments');
//         if (noAppointmentsEl) {
//             noAppointmentsEl.textContent = noAppointments;
//             console.log('✓ No appointments text updated');
//         }
        
//         console.log('🎯 ALL elements force updated successfully!');
//     });
// }

// // Show loading indicator
// function showTranslationLoading(show) {
//     const indicator = document.getElementById('translation-loading');
//     if (show && !indicator) {
//         const loading = document.createElement('div');
//         loading.id = 'translation-loading';
//         loading.style.cssText = `
//             position: fixed; top: 20px; right: 20px;
//             background: linear-gradient(45deg, #ff6b6b, #ee5a24);
//             color: white; padding: 8px 16px;
//             border-radius: 6px; z-index: 10000; font-size: 14px;
//             box-shadow: 0 2px 8px rgba(0,0,0,0.2);
//             animation: pulse 1s infinite;
//         `;
//         loading.innerHTML = '🔄 Force translating...';
//         document.body.appendChild(loading);
        
//         if (!document.getElementById('pulse-style')) {
//             const style = document.createElement('style');
//             style.id = 'pulse-style';
//             style.textContent = '@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.7; } }';
//             document.head.appendChild(style);
//         }
//     } else if (!show && indicator) {
//         indicator.remove();
//     }
// }

// // Reset to English using force update
// function resetToEnglish() {
//     if (Object.keys(originalContent).length === 0) storeOriginalContent();
//     mapTranslatableElements();
    
//     const welcomeEl = elementMap.get('welcome');
//     let patientName = '';
//     if (welcomeEl) {
//         const text = welcomeEl.textContent || '';
//         const match = text.match(/(?:Welcome|欢迎|வரவேற்கிறோம்|Selamat Datang)[,\s]*(.+)/i);
//         if (match) patientName = match[1].trim();
//     }
    
//     const englishTexts = Object.values(originalContent);
//     forceUpdateAllElements(englishTexts, patientName);
// }

// // Language change handler with forced updates
// async function handleLanguageChange() {
//     const languageSelect = document.getElementById("language-select");
//     const newLanguage = languageSelect.value;
//     const patientId = sessionStorage.getItem("userId");
  
//     console.log("🔄 FORCE changing language to:", newLanguage);
    
//     languageSelect.disabled = true;
    
//     try {
//         // Start forced translation immediately
//         const translationPromise = translatePageElements(newLanguage);
        
//         // Update DB in parallel
//         const dbPromise = fetch("/patient/update-language", {
//             method: "POST",
//             headers: { "Content-Type": "application/json" },
//             body: JSON.stringify({ patientId, language: newLanguage })
//         });
        
//         await translationPromise;
        
//         // Handle DB response
//         dbPromise.then(async response => {
//             const data = await response.json();
//             if (data.success) {
//                 const messages = {
//                     'en': 'Language updated ✓',
//                     'zh': '语言已更新 ✓',
//                     'ms': 'Bahasa dikemas kini ✓',
//                     'ta': 'மொழி மாற்றப்பட்டது ✓'
//                 };
//                 showLanguageUpdateNotification(messages[newLanguage] || messages['en'], 'success');
//             }
//         }).catch(console.error);
        
//     } catch (err) {
//         console.error("❌ Error:", err);
//         showLanguageUpdateNotification('Translation failed', 'error');
//     } finally {
//         languageSelect.disabled = false;
//     }
// }

// ************** CLEAN TRANSLATION SYSTEM - NO DUPLICATES *****************************

// Fast batch translation
async function translateBatchFast(texts, targetLanguage) {
    if (targetLanguage === 'en' || !texts || texts.length === 0) {
        return texts;
    }
    
    try {
        const response = await fetch("/patient/translate-batch", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ texts, targetLanguage })
        });
        
        const data = await response.json();
        return data.translations || texts;
    } catch (error) {
        console.error('Batch translation failed, using individual fallback:', error);
        
        const individualResults = await Promise.all(
            texts.map(async (text) => {
                if (!text || !text.trim()) return text;
                try {
                    const response = await fetch("/patient/translate", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ text: text.trim(), targetLanguage })
                    });
                    const data = await response.json();
                    return data.translatedText || text;
                } catch (err) {
                    return text;
                }
            })
        );
        return individualResults;
    }
}

// Store original content
let originalContent = {};
let isTranslating = false;

function storeOriginalContent() {
    if (Object.keys(originalContent).length > 0) return;
    
    originalContent = {
        header: 'Patient Portal',
        subtitle: 'Singapore General Hospital - Podiatry Digital Assistant',
        welcomePrefix: 'Welcome, ',
        languageLabel: 'Language Preference:',
        logoutBtn: 'Logout',
        chatTitle: 'Digital Nurse Assistant Chatbot',
        chatSubtitle: 'Talk to our digital nurse assistant to get help with your foot health concerns and appointment booking!',
        messagePlaceholder: 'Describe your symptoms or ask a question...',
        sendBtn: 'Send',
        appointmentsTitle: 'Upcoming Appointments',
        emergencyTitle: 'Emergency Contacts',
        hospitalContactsTitle: 'Hospital Contacts',
        importantNotesTitle: 'Important Notes',
        sghMainLine: 'SGH Main Line: 6222 3322',
        podiatryClinic: 'Podiatry Clinic: 6321 4377',
        emergency: 'Emergency: 995',
        severePainText: 'If you experience severe pain, bleeding, or signs of infection, please seek immediate medical attention.',
        urgentConcernsText: 'For urgent concerns outside clinic hours, visit the Emergency Department.',
        noAppointments: 'No upcoming appointments.'
    };
}

// Main translation function
async function translatePageElements(targetLanguage) {
    if (isTranslating) return;
    
    if (targetLanguage === 'en') {
        resetToEnglish();
        return;
    }
    
    isTranslating = true;
    console.log('🧹 Clean translation to:', targetLanguage);
    storeOriginalContent();
    
    showTranslationLoading(true);
    
    try {
        // Get patient name safely
        const welcomeElement = document.querySelector('.medical-card .medical-card-title');
        let patientName = '';
        if (welcomeElement) {
            const text = welcomeElement.textContent || '';
            const nameMatch = text.match(/(?:Welcome|欢迎|வரவேற்கிறோம்|Selamat Datang)[,\s]*(.+)/i);
            if (nameMatch && nameMatch[1]) {
                patientName = nameMatch[1].trim();
            }
        }
        
        // Collect texts for translation
        const textsToTranslate = [
            originalContent.header,                    // 0
            originalContent.subtitle,                  // 1
            originalContent.welcomePrefix,             // 2
            originalContent.languageLabel,             // 3
            originalContent.logoutBtn,                 // 4
            originalContent.chatTitle,                 // 5
            originalContent.chatSubtitle,              // 6
            originalContent.messagePlaceholder,        // 7
            originalContent.sendBtn,                   // 8
            originalContent.appointmentsTitle,         // 9
            originalContent.emergencyTitle,            // 10
            originalContent.hospitalContactsTitle,     // 11
            originalContent.importantNotesTitle,       // 12
            originalContent.sghMainLine,               // 13
            originalContent.podiatryClinic,            // 14
            originalContent.emergency,                 // 15
            originalContent.severePainText,            // 16
            originalContent.urgentConcernsText,        // 17
            originalContent.noAppointments            // 18
        ];
        
        console.log('🚀 Batch translating...');
        const translations = await translateBatchFast(textsToTranslate, targetLanguage);
        
        // Apply translations cleanly
        applyCleanTranslations(translations, patientName);
        
        console.log('✅ Clean translation completed');
        
    } catch (error) {
        console.error('Translation error:', error);
    } finally {
        showTranslationLoading(false);
        isTranslating = false;
    }
}

// Apply translations with surgical precision - no duplicates
function applyCleanTranslations(translations, patientName) {
    const [
        header, subtitle, welcomePrefix, languageLabel, logoutBtn,
        chatTitle, chatSubtitle, messagePlaceholder, sendBtn, appointmentsTitle,
        emergencyTitle, hospitalContactsTitle, importantNotesTitle,
        sghMainLine, podiatryClinic, emergency, severePainText, urgentConcernsText, noAppointments
    ] = translations;
    
    requestAnimationFrame(() => {
        console.log('🎯 Applying clean translations...');
        
        // 1. Header section - very specific
        const headerEl = document.querySelector('.medical-header h1');
        if (headerEl) {
            headerEl.textContent = `🏥 ${header}`;
            console.log('✓ Header updated');
        }
        
        const subtitleEl = document.querySelector('.medical-header .subtitle');
        if (subtitleEl) {
            subtitleEl.textContent = subtitle;
            console.log('✓ Subtitle updated');
        }
        
        // 2. Welcome section - target ONLY the first card's title
        const allCards = document.querySelectorAll('.medical-card');
        if (allCards.length > 0) {
            const firstCardTitle = allCards[0].querySelector('.medical-card-title');
            if (firstCardTitle && patientName) {
                firstCardTitle.innerHTML = `👤 ${welcomePrefix}<span id="patient-name">${patientName}</span>`;
                console.log('✓ Welcome message updated');
            }
        }
        
        // 3. Language preference - exact selector
        const languageLabelEl = document.querySelector('label[for="language-select"]');
        if (languageLabelEl) {
            languageLabelEl.textContent = languageLabel;
            console.log('✓ Language label updated');
        }
        
        // 4. Logout button - exact selector
        const logoutBtnEl = document.querySelector('button[onclick="handleLogout()"]');
        if (logoutBtnEl) {
            logoutBtnEl.textContent = `🚪 ${logoutBtn}`;
            console.log('✓ Logout button updated');
        }
        
        // 5. Chat section - find the SPECIFIC chat card
        const chatCard = Array.from(document.querySelectorAll('.medical-card')).find(card => {
            const title = card.querySelector('.medical-card-header .medical-card-title');
            return title && (
                title.textContent.includes('Digital Nurse') || 
                title.textContent.includes('数字护士') || 
                title.textContent.includes('டிஜிட்டல்') ||
                title.textContent.includes('Jururawat')
            );
        });
        
        if (chatCard) {
            const chatTitleEl = chatCard.querySelector('.medical-card-header .medical-card-title');
            if (chatTitleEl) {
                chatTitleEl.textContent = `🤖 ${chatTitle}`;
                console.log('✓ Chat title updated');
            }
            
            const chatSubtitleEl = chatCard.querySelector('.medical-card-subtitle');
            if (chatSubtitleEl) {
                chatSubtitleEl.textContent = chatSubtitle;
                console.log('✓ Chat subtitle updated');
            }
        }
        
        // 6. Message input placeholder
        const messageInput = document.getElementById('message');
        if (messageInput) {
            messageInput.placeholder = messagePlaceholder;
            console.log('✓ Message placeholder updated');
        }
        
        // 7. Send button
        const sendBtnEl = document.querySelector('button[onclick="sendMessage()"]');
        if (sendBtnEl) {
            sendBtnEl.textContent = `📤 ${sendBtn}`;
            console.log('✓ Send button updated');
        }
        
        // 8. Appointments section - target the widget specifically
        const appointmentsWidget = document.querySelector('.dashboard-widget .widget-title');
        if (appointmentsWidget) {
            appointmentsWidget.textContent = `📅 ${appointmentsTitle}`;
            console.log('✓ Appointments title updated');
        }
        
        // 9. Emergency section - target the main emergency header
        const emergencyCard = Array.from(document.querySelectorAll('.medical-card')).find(card => {
            const h3 = card.querySelector('h3');
            return h3 && (
                h3.textContent.includes('Emergency') || 
                h3.textContent.includes('紧急') || 
                h3.textContent.includes('அவசர') ||
                h3.textContent.includes('Kecemasan')
            );
        });
        
        if (emergencyCard) {
            const emergencyH3 = emergencyCard.querySelector('h3');
            if (emergencyH3) {
                emergencyH3.textContent = `🚨 ${emergencyTitle}`;
                console.log('✓ Emergency title updated');
            }
            
            // Update ONLY the dashboard widgets inside this emergency card
            const widgets = emergencyCard.querySelectorAll('.dashboard-widget .widget-title');
            if (widgets.length >= 2) {
                widgets[0].textContent = `📞 ${hospitalContactsTitle}`;
                widgets[1].textContent = `ℹ️ ${importantNotesTitle}`;
                console.log('✓ Widget titles updated');
            }
            
            // Update contact info - be VERY specific to avoid duplicates
            const contactItems = emergencyCard.querySelectorAll('.flex.items-center');
            contactItems.forEach((item, index) => {
                const span = item.querySelector('span:last-child'); // Get the last span (the text, not the icon)
                if (span) {
                    const text = span.textContent;
                    if (text.includes('6222 3322')) {
                        span.textContent = sghMainLine;
                        console.log('✓ SGH contact updated');
                    } else if (text.includes('6321 4377')) {
                        span.textContent = podiatryClinic;
                        console.log('✓ Podiatry contact updated');
                    } else if (text.includes('995')) {
                        span.textContent = emergency;
                        console.log('✓ Emergency contact updated');
                    }
                }
            });
            
            // Update emergency instruction paragraphs
            const paras = emergencyCard.querySelectorAll('.dashboard-widget .text-muted');
            if (paras.length >= 2) {
                paras[0].textContent = severePainText;
                paras[1].textContent = urgentConcernsText;
                console.log('✓ Emergency instructions updated');
            }
        }
        
        // 10. No appointments text - if it exists
        const noApptEl = document.querySelector('#appointment-list .text-muted');
        if (noApptEl && noApptEl.textContent.includes('No upcoming')) {
            noApptEl.textContent = noAppointments;
            console.log('✓ No appointments text updated');
        }
        
        console.log('🎯 All clean translations applied successfully');
    });
}

// Show loading indicator
function showTranslationLoading(show) {
    const indicator = document.getElementById('translation-loading');
    if (show && !indicator) {
        const loading = document.createElement('div');
        loading.id = 'translation-loading';
        loading.style.cssText = `
            position: fixed; top: 20px; right: 20px;
            background: linear-gradient(45deg, #007bff, #0056b3);
            color: white; padding: 8px 16px;
            border-radius: 6px; z-index: 10000; font-size: 14px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.2);
        `;
        loading.innerHTML = '🧹 Cleaning & translating...';
        document.body.appendChild(loading);
    } else if (!show && indicator) {
        indicator.remove();
    }
}

// Reset to English cleanly
function resetToEnglish() {
    if (Object.keys(originalContent).length === 0) storeOriginalContent();
    
    const welcomeEl = document.querySelector('.medical-card .medical-card-title');
    let patientName = '';
    if (welcomeEl) {
        const text = welcomeEl.textContent || '';
        const match = text.match(/(?:Welcome|欢迎|வரவேற்கிறோம்|Selamat Datang)[,\s]*(.+)/i);
        if (match) patientName = match[1].trim();
    }
    
    const englishTexts = Object.values(originalContent);
    applyCleanTranslations(englishTexts, patientName);
}

// Clean language change handler
async function handleLanguageChange() {
    const languageSelect = document.getElementById("language-select");
    const newLanguage = languageSelect.value;
    const patientId = sessionStorage.getItem("userId");
  
    console.log("🧹 Clean language change to:", newLanguage);
    
    languageSelect.disabled = true;
    
    try {
        // Clean translation
        const translationPromise = translatePageElements(newLanguage);
        
        // DB update in parallel
        const dbPromise = fetch("/patient/update-language", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ patientId, language: newLanguage })
        });
        
        await translationPromise;
        
        // Handle DB response
        dbPromise.then(async response => {
            const data = await response.json();
            if (data.success) {
                const messages = {
                    'en': 'Language updated ✓',
                    'zh': '语言已更新 ✓',
                    'ms': 'Bahasa dikemas kini ✓',
                    'ta': 'மொழி மாற்றப்பட்டது ✓'
                };
                showLanguageUpdateNotification(messages[newLanguage] || messages['en'], 'success');
            }
        }).catch(console.error);
        
    } catch (err) {
        console.error("❌ Error:", err);
        showLanguageUpdateNotification('Translation failed', 'error');
    } finally {
        languageSelect.disabled = false;
    }
}


// Initialize element mapping when page loads
document.addEventListener('DOMContentLoaded', function() {
    // Small delay to ensure all elements are rendered
    setTimeout(() => {
        mapTranslatableElements();
        console.log('🗺️ Element mapping initialized');
    }, 500);
});

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