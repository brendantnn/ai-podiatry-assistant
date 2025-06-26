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

  // Store user message and user id
  const userMessage = req.body.message;
  const userId = "session1"; // *** HARDCODED SESSION TO BE CHANGED ***

  // Create session object
  session[userId] = session[userId] || {
    state: "idle",
    triageStage: null,
    messages: [],
    pendingSlot: null,
    pendingSlotData: null
  };
  // Store current state, conversation history and pending appointment slot 
  const s = session[userId];

  console.log("🆕 Incoming message:", userMessage);
  console.log("📦 Session state at start:", s);

  // Triage starts here

  try {

    // If user message includes "triage", set state="triage" and triageState="initial query"
    if (userMessage.toLowerCase().includes("triage")) {
      console.log("Detected triage word, setting state=triage and triageState=initial query");
      s.state = "triage";
      s.triageStage = "initial_query";
      s.messages = [];
      console.log("🟢 Updated session (triage start):", s);
      return res.json({
        reply: "Please describe your foot-related concern."
      });
    }

    // If state=triage and triageStage=initial query, send to openai to ask follow up questions, then set triageStage="clarification"
    if (s.state === "triage" && s.triageStage === "initial_query") {
      console.log("Detected state=triage and triageStage=initial query, clarifying stage now");
      s.messages.push({ role: "user", content: userMessage });
      console.log("📝 Current messages:", s.messages);

      // Use openai to ask follow up questions
      const clarification = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [
          {
            role: "system",
            content: `You are a podiatry triage assistant. The user gave you their first description of 
            their foot-related concern.
            
            Ask follow-up questions to detect:
- Pus, discharge, bleeding
- Wound, redness, swelling, warmth
- Trauma, pain severity or location
- Infection signs or diabetic complications

Ensure you are clear and can give an accurate initial diagnosis and category

The urgency categories are
1 (most urgent). wound care: presence of wound, signs of infection like redness, swelling , pain, pus, warm to touch, gangrene, infection, neuropathic / ischaemic / neuroischaemic wounds / ulcers
2. nail surgery: ingrown toenail, involuted toenail
3. high risk footcare: callus, corns, warts, pathological toenails
4 (least urgent). MSK: foot pain, foot wear, plantar fasciitis, posterior tibial tendon dysfunction, limb length discrepancy, hallux valgus / bunions, metatarsalgia
            
  Only ask **questions** at this stage. Do NOT attempt to diagnose or categorize yet. Your questions must help determine if the case could fall under wound care, nail surgery, high-risk footcare, or MSK.

If the patient already answered clearly, you can still confirm: 
> "Is there any visible swelling, wound, or pus?"

Respond with 1–3 concise, specific follow-up questions.`
          },
          { role: "user", content: userMessage }
        ]
      });

      const followUp = clarification.choices[0].message.content;
      s.triageStage = "clarification"; // set triageStage="clarification"

      return res.json({ reply: followUp }); // returns follow up question
    }

    // If state=triage and triageStage=clarification, 
    if (s.state === "triage" && s.triageStage === "clarification") {
      console.log("🔍 Handling clarification response...");

      s.messages.push({ role: "user", content: userMessage }); // update user message to session message history
      console.log("📝 Updated userMessage history:", s.messages);

      // Combines all user messages into single string so openAI knows full context
      const fullSymptomHistory = s.messages.map(m => m.content).join(" ");

      // Send entire chat history to openAi for final prompt
      const classification = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [
          {
            role: "system",
            content: `You are a podiatry triage assistant. Given the patient's conversation history, classify their condition into one of the following categories:

      - wound care: presence of wound, signs of infection like redness, swelling , pain, pus, warm to touch, gangrene, infection, neuropathic / ischaemic / neuroischaemic wounds / ulcersy
      - nail surgery: ingrown toenail, involuted toenail
      - high risk footcare: callus, corns, warts, pathological toenails
      - MSK: foot pain, foot wear, plantar fasciitis, posterior tibial tendon dysfunction, limb length discrepancy, hallux valgus / bunions, metatarsalgia

   After assesing the category, determine the urgency level based on this : wound care(level 1:most urgent), nail surgery(level 2), high risk footcare(level 3), MSK (level 4: least urgent)
   Also determine an Initial diagnosis: e.g. plantar fasciitis, ingrown toenail

   Then generate a natural message for the patient that includes:
    - A simple, empathetic explanation
    - A sentence offering an appointment
    - A sentence giving basic care advice while they wait

🧠 GPT response MUST follow this exact format with three dashes (---) on its own line between the internal data and the display message. Do NOT omit the separator.

[INTERNAL DATA]
Category: <MSK / wound care / nail surgery, high risk footcare>
Diagnosis: <Short diagnosis, e.g., "possible plantar fasciitis" or "infected wound">
Urgency level: <1 to 4>

Summary: A brief but informative clinical-style description for the podiatrist, Include:
- What the patient said
- Duration, severity, symptoms like pus/swelling
- Your impression and how urgent it is

---

[DISPLAY MESSAGE, SH]
You need to see a podiatrist urgently. Would Tuesday 2 July at 10:00 AM work for you?<br>
While you wait for your appointment, here's what you should do:<br>
• Tip 1<br>
• Tip 2<br>
• Tip 3<br>

Do not show internal data to the patient.
      `
          },
          { role: "user", content: fullSymptomHistory }
        ]
      });

      const fullReply = classification.choices[0].message.content;
      console.log("🧠 Full GPT reply:\n", fullReply);

 
      // Split based on the last valid separator in case multiple '---' blocks exist
const splitReply = fullReply.trim().split(/-{3,}/);
const lastInternal = splitReply.length > 1 ? splitReply[splitReply.length - 2] : "";
const lastDisplay = splitReply[splitReply.length - 1] || "";

// Extract Summary field from internal block
const summaryMatch = lastInternal.match(/Summary:\s*([\s\S]*?)$/i); // capture multiline
const summary = summaryMatch?.[1]?.trim() || "No summary available.";

// Clean display message (remove tag and trim)
const cleanedDisplay = lastDisplay.replace(/\[DISPLAY MESSAGE.*?\]/i, "").trim();

// Extract internal info
const categoryMatch = lastInternal.match(/Category:\s*(.*)/i);
const diagnosisMatch = lastInternal.match(/Diagnosis:\s*(.*)/i);
const urgencyMatch = lastInternal.match(/Urgency level:\s*(\d)/i);

const category = categoryMatch?.[1]?.trim() || "Unknown";
const diagnosis = diagnosisMatch?.[1]?.trim() || "Unclear";
const urgencyLevel = parseInt(urgencyMatch?.[1]) || 4;

// Store to session
s.urgencyLevel = urgencyLevel;
s.category = category;
s.diagnosis = diagnosis;
s.cleanedDisplay = cleanedDisplay;
s.summary = summary;

console.log("🧠 Full GPT reply:\n", fullReply);
console.log("✅ GPT classification reply:\n", cleanedDisplay);
console.log("📊 Parsed category:", category);
console.log("➡️ Diagnosis:", diagnosis);
console.log("⚠️  Parsed urgency:", urgencyLevel);
console.log("Summary:", summary);

      let daysRange = 14;
      if (urgencyLevel === 1) daysRange = 2;
      else if (urgencyLevel === 2) daysRange = 7;
      else if (urgencyLevel === 3) daysRange = 14;
      else if (urgencyLevel === 4) daysRange = 21;

      console.log("✅ GPT classification reply:\n", cleanedDisplay);
      console.log("📊 Parsed category:", category);
      console.log("⚠️  Parsed urgency:", urgencyLevel);

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
            reply: `${ cleanedDisplay}\n\n⚠️ An error occurred while checking availability.`
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
        s.cleanedDisplay = cleanedDisplay;

        const responseMessage = `${cleanedDisplay.trim()}<br><br>📅 I found a slot on <b>${formattedDate}</b> with podiatrist <b>${slotData.podId}</b>. Would you like to book this appointment? (yes/no)`;

        return res.json({ reply: responseMessage });

      } catch (err) {
        console.error("❌ Error finding available slot:", err);
        s.state = "idle";
        s.triageStage = null;
        s.messages = [];
        return res.json({ reply: `${cleanedDisplay}\n\n⚠️ An error occurred while checking availability.` });
      }
    }

    // Step 3: User confirms appointment
    if (s.state === "awaiting_confirmation") {
      const answer = userMessage.toLowerCase();

      if (answer.includes("yes")) {
        const slotDoc = s.pendingSlot;
        const slotData = s.pendingSlotData;

        await db.collection("Appointments").add({
          patientId: "patient_1", // ******************* HARDCODED CHANGE AFTER LOGIN IS DONE ************************* 
          podId: slotData.podId,
          scheduledDate: slotData.availableDate,
          status: "scheduled",
          urgencyLevel: s.urgencyLevel,
          category: s.category,
          initialDiagnosis: s.diagnosis,
          summary: s.summary, 
          triageDateTime: admin.firestore.Timestamp.now() 
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

    // Appointment query ****************** TO BE CHANGED, HARCODED CURRENTLY************
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

// UPDATED PODIATRIST AI ASSISTANT ROUTE - WORKS WITH YOUR EXACT DATABASE STRUCTURE
app.post("/podiatrist-chat", async (req, res) => {
  const userMessage = req.body.message;
  const podiatristId = req.body.podiatristId || "pod1";

  try {
    // Check if the message contains patient-specific queries
    const patientIdMatch = userMessage.match(/patient\s*#?(\w+)/i) || 
                          userMessage.match(/(\w+)'s\s+(wound|condition|case|treatment|symptoms)/i);
    
    let patientData = null;
    let patientContext = "";

    // If patient-specific query detected, fetch patient data
    if (patientIdMatch) {
      const patientId = patientIdMatch[1];
      console.log(`🔍 Fetching data for patient: ${patientId}`);
      
      try {
        // Find user by userId field
        const userQuery = await db.collection("Users")
          .where("userId", "==", patientId)
          .where("role", "==", "patient")
          .limit(1)
          .get();

        if (!userQuery.empty) {
          const userDoc = userQuery.docs[0];
          const userData = userDoc.data();
          const userDocId = userDoc.id; // e.g., "user_1"
          
          // Get patient profile using the document ID
          const profileSnapshot = await db.collection("PatientProfiles").doc(userDocId).get();
          
          let profile = { 
            riskLevel: "unknown", 
            assignedPodId: "", 
            medicalAlerts: [],
            nricLast4: "",
            preferredLang: "en"
          };
          
          if (profileSnapshot.exists) {
            profile = profileSnapshot.data();
          }

          patientData = {
            name: `${userData.firstName || ''} ${userData.lastName || ''}`.trim(),
            email: userData.email,
            gender: userData.gender,
            phone: userData.phone,
            dob: userData.dob,
            isActive: userData.isActive,
            lastLoginAt: userData.lastLoginAt,
            riskLevel: profile.riskLevel,
            assignedPodId: profile.assignedPodId,
            medicalAlerts: profile.medicalAlerts || [],
            nricLast4: profile.nricLast4,
            preferredLang: profile.preferredLang
          };

          // Create context for AI using your actual data structure
          patientContext = `
PATIENT INFORMATION FOR ${patientId.toUpperCase()}:
- Name: ${patientData.name}
- Email: ${patientData.email}
- Gender: ${patientData.gender}
- Date of Birth: ${patientData.dob}
- Phone: ${patientData.phone}
- NRIC Last 4: ${patientData.nricLast4}
- Account Status: ${patientData.isActive ? 'Active' : 'Inactive'}
- Last Login: ${patientData.lastLoginAt ? new Date(patientData.lastLoginAt.toDate()).toLocaleDateString() : 'Never'}
- Risk Level: ${patientData.riskLevel}
- Assigned Podiatrist: ${patientData.assignedPodId}
- Medical Alerts: ${patientData.medicalAlerts.join(', ') || 'None recorded'}
- Preferred Language: ${patientData.preferredLang}

Based on this patient's profile information, please provide detailed clinical guidance.
Note: Appointment history will be available once the appointment fields are finalized.
`;

          console.log(`✅ Found complete patient data for ${patientId}`);
        } else {
          patientContext = `Patient ${patientId} not found in database. Please verify the patient ID.`;
        }
      } catch (error) {
        console.error("Error fetching patient data:", error);
        patientContext = `Error retrieving patient ${patientId} data: ${error.message}`;
      }
    }

    // Enhanced system prompt with patient context
    const systemPrompt = `You are an AI clinical assistant for podiatrists at Singapore General Hospital.

${patientContext ? `PATIENT-SPECIFIC QUERY:\n${patientContext}\n` : ''}

RESPONSE FORMATTING RULES:
- Use clear, professional medical language
- Structure responses with headers and bullet points for readability
- Bold important medical terms and conditions
- Use minimal emojis - only for essential medical categories (🩹 wound care, 💊 medications, ⚠️ warnings)
- Keep responses concise but comprehensive
- Always provide evidence-based recommendations

You help with:
1. **Patient-Specific Queries** - Detailed case analysis based on patient history
2. **Clinical Decision Support** - Evidence-based treatment recommendations
3. **Medical Knowledge** - Information about podiatry conditions and protocols  
4. **Case Management** - Guidance on patient prioritization and workflow
5. **Treatment Protocols** - Step-by-step treatment approaches
6. **Drug Information** - Interactions, dosages, and contraindications

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

${patientData ? `
SPECIFIC PATIENT ANALYSIS:
For this ${patientData.riskLevel} risk ${patientData.gender} patient, consider:
- Medical alerts: ${patientData.medicalAlerts.join(', ')}
- Account status and engagement level
- Communication preferences (${patientData.preferredLang})
- Assigned care team coordination
` : ''}

Always remind that final clinical decisions should be based on physical examination and patient-specific factors.`;

    const chatCompletion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: systemPrompt
        },
        {
          role: "user",
          content: userMessage
        },
      ],
    });

    return res.json({
      reply: chatCompletion.choices[0].message.content,
      patientData: patientData // Include patient data in response for frontend use
    });

  } catch (err) {
    console.error("Podiatrist chat error:", err);
    return res.status(500).json({ reply: "Something went wrong with the clinical assistant." });
  }
});

// Set default path to login.html
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "login.html"));
});

// Start server
const PORT = 3000;
app.listen(PORT, () => console.log(`✅ Server running at http://localhost:${PORT}`));