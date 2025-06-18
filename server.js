const express = require("express");
const cors = require("cors");
const { OpenAI } = require("openai");

//Hardcoded patient/podiatrist list
const users = [
  { email: "patient@example.com", password: "1234", role: "patient" },
  { email: "doc@example.com", password: "abcd", role: "podiatrist" }
];


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

// This function runs when script.js sends a HTTP POST request to /chat route
app.post("/chat", async (req, res) => {
  const userMessage = req.body.message;
  const userId = "session1"; // fake session ID

  // Set state to askRole at the start
  session[userId] = session[userId] || { state: "askRole" };

  const s = session[userId];

 try {
    //Ask if patient or podiatrist
  if (s.state === "askRole") {
    const role = userMessage.toLowerCase();
    if (role !== "patient" && role !== "podiatrist") {
      return res.json({ reply: "Please type 'patient' or 'podiatrist'." });
    }
    s.role = role;
    s.state = "askEmail";
    return res.json({ reply: `Great! Please enter your ${role} email.` });
  }

  //Ask for email
  if (s.state === "askEmail") {
    s.email = userMessage;
    s.state = "askPassword";
    return res.json({ reply: "Please enter your password." });
  }

  //Ask for password
  if (s.state === "askPassword") {
    s.password = userMessage;

    const foundUser = users.find(
      (u) =>
        u.email === s.email &&
        u.password === s.password &&
        u.role === s.role
    );

    if (!foundUser) {
      s.state = "askRole"; // Restart login flow
      return res.json({
        reply: "Login failed. Let's try again. Are you a patient or a podiatrist?",
      });
    }

    s.user = foundUser;
    s.state = "authenticated";

    if (s.user.role === "patient") {
      return res.json({
        reply:
          "Welcome, patient! Type 'triage' to begin an assessment, or 'appointment' to view your upcoming visit.",
      });
    } else {
      return res.json({
         reply: "Redirecting to podiatrist dashboard...",
        redirect: "/podiatrist.html"
      });
    }
  }

  if (s.state === "authenticated" && s.user.role === "patient") {
    if (userMessage.toLowerCase().includes("triage")) {
      const chatCompletion = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [
          {
            role: "system",
            content: `You are a podiatry assistant chatbot. Classify severity and recommend next steps.`,
          },
          { role: "user", content: userMessage },
        ],
      });

      return res.json({
        reply: chatCompletion.choices[0].message.content,
      });
    }

    // If patient types appointemnt
    if (userMessage.toLowerCase().includes("appointment")) {
      return res.json({
        reply: "You have an appointment on June 5 at 10:00 AM with Dr. Lee.",
      }); // Replace with real DB logic later
    }

    return res.json({
      reply:
        "I'm not sure what you mean. You can type 'triage' or 'appointment'.",
    });
  }

  if (s.state === "authenticated" && s.user.role === "podiatrist") {
    if (userMessage.toLowerCase().includes("schedule")) {
      return res.json({
        reply: "Your next appointments are:\n1. John Tan - June 5, 10:00 AM\n2. Sarah Lee - June 5, 11:00 AM",
      }); // Replace with DB lookup
    }

    return res.json({
      reply:
        "I'm not sure what you mean. Try typing 'schedule' or ask about a patient.",
    });
  }

  return res.json({ reply: "Unhandled state." });
} catch (err) {
  console.error("Chat error:", err);
  return res.status(500).json({ reply: "Something went wrong." });
}}
);


const PORT = 3000;
app.listen(PORT, () => console.log(`✅ Server running at http://localhost:${PORT}`));


const path = require("path");

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "login.html"));
});
