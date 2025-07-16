
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

        let recognition = null;

        // Set user's language preference from database
        const userLanguage = data.language || "en";
        if (recognition) updateRecognitionLanguage(userLanguage);

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
            appointmentText = `🗓️ You have an upcoming appointment on <b>${formattedDate}</b> with <b><span class="notranslate">${doctor}</span></b>.`;

            appointmentTextTwo = `📅 Next appointment: ${formattedDate} with <span class="notranslate">${doctor}</span>`;

        }

        // Show chatbot welcome message
        const introTemplate = [
            `Hello <b>${name}</b>! I'm here to help you with anything related to your foot health.`,
            appointmentText,
            `Would you like help checking any foot concerns today — or would you prefer to just view your upcoming appointment details?`
        ];

        const translatedIntro = await translateBatchFast(introTemplate, userLanguage);
        document.getElementById("appointment").innerHTML = translatedIntro[1];

        chatbox.innerHTML += `
    <div class="bot">
        <b>🤖 Digital Nurse Assistant:</b> <br>${translatedIntro[0]}
        <br><br>
        ${translatedIntro[1]}
        <br><br>
        ${translatedIntro[2]}
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

    const selectedLanguage = document.getElementById("language-select")?.value || "en";



    try {
        // Send user text via HTTP POST request to /chat route, which is read in server.js
        const response = await fetch("/patient/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ message: userText, patientId, language: selectedLanguage }) //user text sent in JSON so server can read
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
    if (recognition) updateRecognitionLanguage(newLanguage);

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
        await dbPromise;

        // Force page reload to apply all translations cleanly
        location.reload();


    } catch (err) {
        console.error("❌ Error:", err);
        showLanguageUpdateNotification('Translation failed', 'error');
    } finally {
        languageSelect.disabled = false;
    }
}


// Initialize element mapping when page loads
document.addEventListener('DOMContentLoaded', function () {
    // Small delay to ensure all elements are rendered
    setTimeout(() => {
        //mapTranslatableElements();
        console.log('🗺️ Element mapping initialized');
    }, 500);
});

// Add event listener for language dropdown changes
document.addEventListener('DOMContentLoaded', function () {
    const languageSelect = document.getElementById("language-select");
    if (languageSelect) {
        languageSelect.addEventListener('change', handleLanguageChange);
        console.log("🇸🇬 Language change listener added");
    }
});

// ************** VOICE RECOGNITION *****************************

// Check for browser support
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognition = null;

 function updateRecognitionLanguage(langCode) {
        const langMap = {
            en: 'en-SG',
            zh: 'zh-CN',
            ms: 'ms-MY',
            ta: 'ta-IN'
        };
        recognition.lang = langMap[langCode] || 'en-SG';
        console.log("🎙️ Voice recognition language set to:", recognition.lang);
    }


if (SpeechRecognition) {
    recognition = new SpeechRecognition();
    recognition.lang = 'en-SG';
    recognition.continuous = false;
    recognition.interimResults = false;

    document.addEventListener("DOMContentLoaded", () => {
        const micBtn = document.getElementById('mic-btn');
        const messageInput = document.getElementById('message');

        if (!micBtn || !messageInput) {
            console.warn("🎤 mic-btn or message input not found.");
            return;
        }

        micBtn.addEventListener('click', () => {
            recognition.start();
            micBtn.textContent = '🎙️ Listening...';
            micBtn.disabled = true;
        });

        recognition.onresult = (event) => {
            const transcript = event.results[0][0].transcript;
            messageInput.value = transcript;
            sendMessage();  // automatically send message after recognition
        };

        recognition.onend = () => {
            micBtn.textContent = '🎤';
            micBtn.disabled = false;
        };

        recognition.onerror = (event) => {
            console.error("🎤 Voice error:", event.error);
            micBtn.textContent = '🎤';
            micBtn.disabled = false;
        };
    });
} else {
    document.addEventListener("DOMContentLoaded", () => {
        const micBtn = document.getElementById('mic-btn');
        if (micBtn) micBtn.style.display = 'none';
    });
}



// Make sendMessage function globally accessible
window.sendMessage = sendMessage;