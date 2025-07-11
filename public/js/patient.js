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

  
    // Get patient name, appointment from database and assgin to variables
    const data = await res.json();
      console.log("✅ JSON data received:", data);

      
    const name = data.name; 
    const appointment = data.appointment;

    // Set patient name at top bar
    document.getElementById("patient-name").textContent = name || "no patient name";

          
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

  // Adds user message into chatbox, the clear input box so user can type new message
  chatbox.innerHTML += `<div class="user"><b>You:</b> ${userText}</div>`;
  input.value = "";

  const patientId = sessionStorage.getItem("userId");


  try {
    // Send user text via HTTP POST request to /chat route, which is read in server.js
    const response = await fetch("/chat", {
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
    chatbox.innerHTML += `<div class="bot"><b>🤖 Digital Nurse Assistant:</b> <br>Error talking to server.</div>`;
  }
}

  