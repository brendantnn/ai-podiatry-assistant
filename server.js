const express = require("express");
const cors = require("cors");
const { OpenAI } = require("openai");
const path = require("path");

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static("public"));

// Declare openai api key here
const openai = new OpenAI({
    apiKey: "REMOVED_OPENAI_API_KEY", // Replace with actual OpenAI key
});

// key = fake session ID (for now, assume 1 user)
const session = {}; 


// PATIENT CHATBOT LOGIC
// This function runs when patient.js sends a HTTP POST request to /chat route
app.post("/chat", async (req, res) => {
  const userMessage = req.body.message;
  const userId = "session1"; // Simplified single-session setup

  session[userId] = session[userId] || { state: "idle" };
  const s = session[userId];

  try {
    // Step 1: User starts triage
    if (userMessage.toLowerCase().includes("triage")) {
      s.state = "triage";
      return res.json({
        reply: "I can assist with that. Please describe your foot-related symptoms so I can categorize them accordingly."
      });
    }

    // Step 2: User is in triage mode, describe symptoms
    if (s.state === "triage") {
      const chatCompletion = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [
          {
            role: "system",
            content: `You are a podiatry triage assistant.
Given a user's description of their foot-related symptoms, classify it into one of the following categories based on symptoms and urgency:

1. Wound care (most urgent): wounds, redness, swelling, pain, pus, warmth, gangrene, infection, ulcers, neuropathic/ischemic wounds.
2. Nail surgery: ingrown or involuted toenails.
3. High risk footcare: callus, corns, warts, pathological toenails.
4. MSK: foot pain, plantar fasciitis, bunions, footwear issues, tendon dysfunction, limb length difference.

Respond with:
- Category
- Explanation
- Urgency level (e.g., 'Requires immediate attention' or 'Can be reviewed in a few weeks').`,
          },
          { role: "user", content: userMessage },
        ],
      });

      s.state = "idle"; // Reset state after handling triage
      return res.json({
        reply: chatCompletion.choices[0].message.content,
      });
    }

    // Appointment logic
    if (userMessage.toLowerCase().includes("appointment")) {
      return res.json({
        reply: "You have an appointment on June 5 at 10:00 AM with Dr. Lee.",
      });
    }

    // Default fallback
    return res.json({
      reply: "I'm not sure what you mean. You can type 'triage' or 'appointment'.",
    });

  } catch (err) {
    console.error("Chat error (patient):", err);
    return res.status(500).json({ reply: "Something went wrong." });
  }
});

// Set default path to login.html
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "login.html"));
});

// Start server
const PORT = 3000;
app.listen(PORT, () => console.log(`✅ Server running at http://localhost:${PORT}`));