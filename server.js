const express = require("express");
const cors = require("cors");
const { OpenAI } = require("openai");
const path = require("path");

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static("public"));


// FIREBASE SETUP
const admin = require("firebase-admin");
const serviceAccount = require("./config/serviceAccountKey.json");
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});
const db = admin.firestore();

// Declare openai api key here
const openai = new OpenAI({
  apiKey: "REMOVED_OPENAI_API_KEY", // Replace with actual OpenAI key
});

// key = fake session ID (for now, assume 1 user)
const session = {};


// ******************************** PATIENT LOGIC *****************************************

app.post("/chat", async (req, res) => {
  console.log("/chat route");

  const userMessage = req.body.message;
  const userId = "session1";

  session[userId] = session[userId] || {
    state: "idle",
    triageStage: null,
    messages: [],
    pendingSlot: null,
    pendingSlotData: null
  };
  const s = session[userId];

console.log("🆕 Incoming message:", userMessage);
console.log("📦 Session state before handling:", s);

  try {
    // Start triage flow
    if (userMessage.toLowerCase().includes("triage")) {
       console.log("🔄 Starting triage...");
      s.state = "triage";
      s.triageStage = "initial_query";
      s.messages = [];
      console.log("🟢 Updated session (triage start):", s);
      return res.json({
        reply: "Please describe your foot-related concern. I’ll ask a few questions after that if needed."
      });
    }

    // Handle patient's first description
    if (s.state === "triage" && s.triageStage === "initial_query") {
       console.log("📥 Handling initial symptom description...");
      s.messages.push({ role: "user", content: userMessage });
       console.log("📝 Current messages:", s.messages);

      const clarification = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [
          {
            role: "system",
            content: `You are a podiatry triage assistant. Based on the user's description of their foot-related concern, ask 2-3 relevant follow-up questions to help you determine the condition and urgency. If no further questions are needed, say so.`
          },
          { role: "user", content: userMessage }
        ]
      });

      const followUp = clarification.choices[0].message.content;
      s.triageStage = "clarification";

      return res.json({ reply: followUp });
    }

    // Handle follow-up answer and perform classification
    if (s.state === "triage" && s.triageStage === "clarification") {
        console.log("🔍 Handling clarification response...");

      s.messages.push({ role: "user", content: userMessage });

        console.log("📝 Updated conversation history:", s.messages);


      const fullSymptomHistory = s.messages.map(m => m.content).join(" ");

      const classification = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [
          {
            role: "system",
            content: `You are a podiatry triage assistant. Given the patient's conversation history, classify their condition into one of the following:
1. wound care: presence of wound, signs of infection like redness, swelling , pain, pus, warm to touch, gangrene, infection, neuropathic / ischaemic / neuroischaemic wounds / ulcers2. Nail surgery
2. nail surgery: ingrown toenail, involuted toenail4. MSK
3. high risk footcare: callus, corns, warts, pathological toenails
4. MSK: foot pain, foot wear, plantar fasciitis, posterior tibial tendon dysfunction, limb length discrepancy, hallux valgus / bunions, metatarsalgia

Respond with:
- Category
- Explanation
- Urgency level (e.g., 'Requires immediate attention')`
          },
          { role: "user", content: fullSymptomHistory }
        ]
      });

      const reply = classification.choices[0].message.content;

      const categoryMatch = reply.match(/Category:\s*(.*)/i);
      const urgencyMatch = reply.match(/Urgency level:\s*(.*)/i);
      const category = categoryMatch?.[1] || "Unknown";
      const urgency = urgencyMatch?.[1] || "";

      let daysRange = 14;
      if (urgency.toLowerCase().includes("immediate")) daysRange = 2;
      else if (category.toLowerCase().includes("nail")) daysRange = 7;
      else if (category.toLowerCase().includes("msk")) daysRange = 21;

      console.log("✅ GPT classification reply:\n", reply);
console.log("📊 Parsed category:", category);
console.log("⚠️  Parsed urgency:", urgency);

      const now = new Date();
      const endDate = new Date();
      endDate.setDate(now.getDate() + daysRange);

      try {
        const slotQuery = await db.collection("Availability")
          .where("status", "==", "available")
          .where("availableDate", ">=", now)
          .where("availableDate", "<=", endDate)
          .orderBy("availableDate")
          .limit(1)
          .get();

        if (slotQuery.empty) {
          s.state = "idle";
          s.triageStage = null;
          s.messages = [];
          return res.json({
            reply: `${reply}\n\n❌ No available appointment slots found in the recommended timeframe.`
          });
        }

        const slotDoc = slotQuery.docs[0];
        const slotData = slotDoc.data();

        const formattedDate = new Date(slotData.availableDate.toDate ? slotData.availableDate.toDate() : slotData.availableDate)
          .toLocaleString("en-SG", {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
            hour12: true,
            timeZone: "Asia/Singapore"
          });

        s.state = "awaiting_confirmation";
        s.triageStage = null;
        s.messages = [];
        s.pendingSlot = slotDoc;
        s.pendingSlotData = slotData;

        return res.json({
          reply: `${reply}\n\n📅 I found a slot on <b>${formattedDate}</b> with podiatrist <b>${slotData.podId}</b>. Would you like to book this appointment? (yes/no)`
        });

      } catch (err) {
        console.error("❌ Error finding available slot:", err);
        s.state = "idle";
        s.triageStage = null;
        s.messages = [];
        return res.json({ reply: `${reply}\n\n⚠️ An error occurred while checking availability.` });
      }
    }

    // Step 3: User confirms appointment
    if (s.state === "awaiting_confirmation") {
      const answer = userMessage.toLowerCase();

      if (answer.includes("yes")) {
        const slotDoc = s.pendingSlot;
        const slotData = s.pendingSlotData;

        await db.collection("Appointments").add({
          patientId: "patient_1",
          podId: slotData.podId,
          scheduledDate: slotData.availableDate,
          status: "scheduled"
        });

        await slotDoc.ref.update({ status: "booked" });

        const formattedDate = new Date(slotData.availableDate.toDate())
          .toLocaleString("en-SG", {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
            hour12: true,
            timeZone: "Asia/Singapore"
          });

        s.state = "idle";
        s.pendingSlot = null;
        s.pendingSlotData = null;

        return res.json({
          reply: `✅ Appointment confirmed for <b>${formattedDate}</b> with podiatrist <b>${slotData.podId}</b>.`
        });
      }

      if (answer.includes("no")) {
        s.state = "idle";
        s.pendingSlot = null;
        s.pendingSlotData = null;
        return res.json({ reply: "❌ No worries. Let me know if you'd like me to check another slot or start over." });
      }

      return res.json({ reply: "❓ Please reply with 'yes' or 'no' to confirm your appointment." });
    }

    // Appointment query
    if (userMessage.toLowerCase().includes("appointment")) {
      return res.json({
        reply: "📅 You have an appointment on June 5 at 10:00 AM with Dr. Lee."
      });
    }

    // Fallback
    return res.json({
      reply: "🤖 I'm not sure what you mean. You can type 'triage' or 'appointment'."
    });

  } catch (err) {
    console.error("Chat error (patient):", err);
    return res.status(500).json({ reply: "⚠️ Something went wrong on the server." });
  }
});



// Fetch patient appointment and
app.post('/chat-patient-details', async (req, res) => {
  const { patientId } = req.body;
  console.log("🔍 Fetching patient info for:", patientId);

  try {
    // Get user info using where instead of doc()
    const userSnapshot = await db.collection("Users")
      .where("userId", "==", patientId)
      .limit(1)
      .get();

    if (userSnapshot.empty) {
      console.log("❌ No matching user found");
      return res.json({
        name: "Name not found",
        appointment: null
      });
    }

    const userData = userSnapshot.docs[0].data();
    console.log("✅ Found user:", userData.firstName, userData.lastName);

    // Get appointment
    const apptSnapshot = await db.collection("Appointments")
      .where("patientId", "==", patientId)
      .where("status", "==", "scheduled")
      .orderBy("scheduledDate")
      .limit(1)
      .get();

    let appointment = null;
    if (!apptSnapshot.empty) {
      const appt = apptSnapshot.docs[0].data();


      let podiatristName = "Unknown podiatrist";
      if (appt.podId) {
        const podQuery = await db.collection("Users")
          .where("userId", "==", appt.podId)
          .limit(1)
          .get();

        if (!podQuery.empty) {
          const podData = podQuery.docs[0].data();
          podiatristName = `${podData.firstName || ""} ${podData.lastName || ""}`.trim();
        }
      }

      appointment = {
        date: appt.scheduledDate.toDate(),
        podiatrist: podiatristName
      };
    }



    res.json({
      name: `${userData.firstName} ${userData.lastName}`.trim(),
      appointment
    });

  } catch (error) {
    console.error("❌ Error in /chat-patient-details:", error);
    res.status(500).json({ error: "Failed to fetch patient details" });
  }
});






// ******************************** PODIATRIST LOGIC *****************************************

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