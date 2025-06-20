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

// PROFESSIONAL PODIATRIST AI ASSISTANT ROUTE
app.post("/podiatrist-chat", async (req, res) => {
  const userMessage = req.body.message;
  const podiatristId = req.body.podiatristId || "pod1";

  try {
    const chatCompletion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: `You are an AI clinical assistant for podiatrists at Singapore General Hospital. 

RESPONSE FORMATTING RULES:
- Use clear, professional medical language
- Structure responses with headers and bullet points for readability
- Bold important medical terms and conditions
- Use minimal emojis - only for essential medical categories (🩹 wound care, 💊 medications, ⚠️ warnings)
- Keep responses concise but comprehensive
- Always provide evidence-based recommendations

You help with:
1. **Clinical Decision Support** - Evidence-based treatment recommendations
2. **Medical Knowledge** - Information about podiatry conditions and protocols  
3. **Patient Management** - Guidance on case prioritization and workflow
4. **Treatment Protocols** - Step-by-step treatment approaches
5. **Drug Information** - Interactions, dosages, and contraindications

PODIATRY CATEGORIES:
**Wound Care** (Priority 1 - Most Urgent)
- Diabetic foot ulcers, infections, neuropathic/ischemic wounds
- Signs: redness, swelling, pus, warmth, gangrene

**Nail Surgery** (Priority 2)  
- Ingrown toenails, nail disorders, onychomycosis

**High Risk Footcare** (Priority 3)
- Callus, corns, warts in diabetic/high-risk patients
- Pathological toenails, foot deformities

**MSK Conditions** (Priority 4)
- Plantar fasciitis, bunions, tendon issues
- Footwear problems, biomechanical issues

FORMAT EXAMPLE:
## Treatment for Diabetic Foot Infections

**First-Line Antibiotics:**
• **Clindamycin** 300-450mg q6h (anaerobic coverage)
• **Cephalexin** 500mg q6h (gram-positive coverage)
• **Augmentin** 875mg q12h (broad spectrum)

**Severe Infections:**
• **Vancomycin** + **Piperacillin-tazobactam**
• Consider MRSA coverage if risk factors present

**Key Considerations:**
• Duration: 7-14 days for soft tissue, 4-6 weeks for osteomyelitis
• Monitor renal function with vancomycin
• Culture-guided therapy when possible

**Warning Signs:** Spreading erythema, systemic symptoms, poor glycemic control

Always remind that final clinical decisions should be based on physical examination and patient-specific factors.`
        },
        { 
          role: "user", 
          content: userMessage 
        },
      ],
    });

    return res.json({
      reply: chatCompletion.choices[0].message.content,
    });

  } catch (err) {
    console.error("Podiatrist chat error:", err);
    return res.status(500).json({ reply: "Something went wrong with the clinical assistant." });
  }
});

// PATIENT-SPECIFIC QUERIES (for when database is ready)
app.post("/podiatrist-patient-query", async (req, res) => {
  const { query, patientId } = req.body;

  try {
    // TODO: Fetch patient data from database when Yin Er has it ready
    // const patientData = await getPatientData(patientId);
    
    // For now, return a placeholder response
    if (patientId) {
      return res.json({
        reply: `I understand you're asking about patient ${patientId}: "${query}". Once the patient database is connected, I'll be able to provide specific information about this patient's history, symptoms, and treatment plan.`
      });
    }

    return res.json({
      reply: "Please specify a patient ID for patient-specific queries."
    });

  } catch (err) {
    console.error("Patient query error:", err);
    return res.status(500).json({ reply: "Error accessing patient information." });
  }
});

// Set default path to login.html
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "login.html"));
});

// Start server
const PORT = 3000;
app.listen(PORT, () => console.log(`✅ Server running at http://localhost:${PORT}`));