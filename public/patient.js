// What the chatbot sends to user on startup
window.onload = () => {
  const chatbox = document.getElementById("chatbox");
  chatbox.innerHTML += `
    <div class="bot">
      <b>Bot:</b> Welcome! Are you a <b>patient</b> or a <b>podiatrist</b>?
    </div>
  `;
};



async function sendMessage() {
  const input = document.getElementById("message");
  const chatbox = document.getElementById("chatbox");
  const userText = input.value.trim();

  if (!userText) return;

  // Display user message
  chatbox.innerHTML += `<div class="user"><b>You:</b> ${userText}</div>`;
  input.value = "";

  try {
    // sends HTTP POST request to /chat route, this is listened for in server.js
    const response = await fetch("/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: userText })
    });

    const data = await response.json();

    // Handle call from server.js to redirect when podiatrist login)
    if (data.redirect) {
      window.location.href = data.redirect;
      return;
    }

    // Normal chatbot response
    chatbox.innerHTML += `<div class="bot"><b>Bot:</b> ${data.reply}</div>`;
    chatbox.scrollTop = chatbox.scrollHeight;

  } catch (err) {
    chatbox.innerHTML += `<div class="bot"><b>Bot:</b> Error talking to server.</div>`;
  }
}

  