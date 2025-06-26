window.onload = async () => {
  const patientId = "patient_1"; // Simulated logged-in patient

  const chatbox = document.getElementById("chatbox");
  
  try {
    const res = await fetch("/chat-patient-details", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ patientId })
    });
  
    // Get patient name, appointment from database and assgin to variables
    const data = await res.json();
    const name = data.name; 
    const appointment = data.appointment;

    // Set patient name at top bar
    document.getElementById("patient-name").textContent = name || "no patient name";

          
    // Set patient id at top bar
    document.getElementById("patient-id").textContent = patientId || "no patient id";

    let appointmentText = "You have no upcoming confirmed appointments.";
    let appointmentTextTwo = "You have no upcoming confirmed appointments.";

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
      appointmentText = `You have an upcoming appointment on <b>${formattedDate}</b> with <b>${doctor}</b>.`;
      appointmentTextTwo = `📅 Next appointment: ${formattedDate} with ${doctor}`;
      
      document.getElementById("appointment").textContent = appointmentTextTwo;


    }

    // Show combined message
    chatbox.innerHTML += `
      <div class="bot">
        <b>🤖 Digital Nurse Assistant:</b> <br>Hello <b>${name}</b>! I'm your digital healthcare assistant.<br>
        ${appointmentText}<br>
        Type <b>'triage'</b> to begin an assessment or <b>'appointment'</b> to view your upcoming visit.
      </div>
    `;

    chatbox.scrollTop = chatbox.scrollHeight;

  } catch (err) {
    console.error("❌ Failed to fetch patient details:", err);
    chatbox.innerHTML += `
      <div class="bot">
        <b>Bot:</b> ⚠️ Unable to fetch patient details.
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


  try {
    // Send user text via HTTP POST request to /chat route, which is read in server.js
    const response = await fetch("/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: userText }) //user text sent in JSON so server can read
    });

    // Wait for server reply, and convert it from JSON to javascript object
    const data = await response.json();


    // Display the chatbot's reply in chatbox, then scroll chatbot down to show latest message
    chatbox.innerHTML += `<div class="bot"><b>Bot:</b> ${data.reply}</div>`;
    chatbox.scrollTop = chatbox.scrollHeight;

  } 
  // Catch any errors 
  catch (err) {
    chatbox.innerHTML += `<div class="bot"><b>Bot:</b> Error talking to server.</div>`;
  }
}

  