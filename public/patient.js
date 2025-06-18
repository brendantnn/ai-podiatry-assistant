// Add welccome message to div id "chatbox" in HTML page
window.onload = () => {
  const chatbox = document.getElementById("chatbox");
  chatbox.innerHTML += `
      <div class="bot">
      <b>Bot:</b> Welcome back! Type <b>'triage'</b> to begin an assessment or <b>'appointment'</b> to view your upcoming visit.
    </div>
  `;
};


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

  