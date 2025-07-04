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

// SIMPLE CACHE FOR FASTER RESPONSES
let scheduleCache = new Map();
const CACHE_DURATION = 30000; // 30 seconds

function getCacheKey(targetDate, podiatristId) {
  return `${targetDate}-${podiatristId}`;
}

function isValidCache(cacheEntry) {
  return cacheEntry && (Date.now() - cacheEntry.timestamp) < CACHE_DURATION;
}

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

        const responseMessage = `${cleanedDisplay.trim()}<br><br>📅 I found a slot on <b>${formattedDate}</b> with podiatrist <b>${slotData.podId}</b>. Would you like to book this appointment?`;

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

    // Appointment query 
   if (userMessage.toLowerCase().includes("appointment")) {
  try {
    const patientId = "patient_1"; // *********************** TO BE CHANGED: Replace with actual session-based user ID later************************

    // Get appointment
    const apptSnapshot = await db.collection("Appointments")
      .where("patientId", "==", patientId)
      .where("status", "==", "scheduled")
      .orderBy("scheduledDate")
      .limit(1)
      .get();

    if (apptSnapshot.empty) {
      return res.json({
        reply: "📅 You don't have any upcoming appointments at the moment."
      });
    }

    const appt = apptSnapshot.docs[0].data();

    // Get podiatrist name from Users collection
    let podiatristName = "your podiatrist";
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

    const formattedDate = appt.scheduledDate.toDate().toLocaleString("en-SG", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
      timeZone: "Asia/Singapore"
    });

    return res.json({
      reply: `📅 You have an appointment on <b>${formattedDate}</b> with <b>Dr. ${podiatristName}</b>.`
    });

  } catch (error) {
    console.error("❌ Error fetching appointment:", error);
    return res.json({
      reply: "⚠️ An error occurred while retrieving your appointment details."
    });
  }
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

    // ✅ Fetch all scheduled appointments (not just the next one)
const allApptsSnap = await db.collection("Appointments")
  .where("patientId", "==", patientId)
  .where("status", "==", "scheduled")
  .orderBy("scheduledDate")
  .get();


  // Step 1: Extract unique podiatrist IDs
const podIds = [...new Set(allApptsSnap.docs.map(doc => doc.data().podId).filter(Boolean))];

// Step 2: Fetch all podiatrists in a single query
let podiatristMap = {};
if (podIds.length > 0) {
  const podSnapshot = await db.collection("Users")
    .where("userId", "in", podIds)
    .get();

  podSnapshot.forEach(doc => {
    const d = doc.data();
    podiatristMap[d.userId] = `${d.firstName || ""} ${d.lastName || ""}`.trim();
  });
}


const allAppointments = allApptsSnap.docs.map(doc => {
  const appt = doc.data();
  const podiatristName = podiatristMap[appt.podId] || "Unknown podiatrist";

  return {
    date: appt.scheduledDate.toDate(),
    podiatrist: podiatristName,
    type: appt.type || "Consultation"
  };
});




    res.json({
      name: `${userData.firstName} ${userData.lastName}`.trim(),
      appointment,  
       allAppointments 
    });

  } catch (error) {
    console.error("❌ Error in /chat-patient-details:", error);
    res.status(500).json({ error: "Failed to fetch patient details" });
  }
});

// ******************************** PODIATRIST LOGIC *****************************************

// FIXED PODIATRIST CHAT ROUTE
app.post("/podiatrist-chat", async (req, res) => {
  const userMessage = req.body.message;
  const podiatristId = req.body.podiatristId || "pod1";

  try {
    console.log('🤖 Podiatrist chat message:', userMessage);
    
   // REPLACE the entire patient ID detection section in server.js /podiatrist-chat route
// Find this section around line 400 and replace it completely

// FIXED patient ID detection patterns
const patientIdPatterns = [
  /\b(patient_\d+)\b/gi,                    // ONLY "patient_1", "patient_2", etc.
  /\bpatient\s+(\d+)\b/gi,                  // ONLY "patient 1", "patient 2", etc.
  /tell me about (patient_\d+)/gi,          // "tell me about patient_1"
  /\b(p\d+)\b/gi,                           // "p1", "p2", etc.
  /\b(pt\d+)\b/gi                           // "pt1", "pt2", etc.
];

let patientId = null;
let patientData = null;
let patientContext = "";

console.log(`🔍 Analyzing message for patient ID: "${userMessage}"`);

// Try each pattern to find patient ID
for (let i = 0; i < patientIdPatterns.length; i++) {
  const pattern = patientIdPatterns[i];
  const matches = [...userMessage.matchAll(pattern)];
  
  if (matches.length > 0) {
    const match = matches[0]; // Get first match
    console.log(`🎯 Pattern ${i + 1} matched:`, match);
    
    if (i === 0 || i === 2) {
      // For "patient_1" or "tell me about patient_1" patterns
      patientId = match[1];
    } else if (i === 1) {
      // For "patient 1" pattern - construct "patient_1"
      patientId = `patient_${match[1]}`;
    } else {
      // For p1, pt1 patterns - use as is
      patientId = match[1];
    }
    
    console.log(`✅ Extracted patient ID: "${patientId}" from pattern ${i + 1}`);
    
    // VALIDATE that it's a real patient ID format
    if (/^(patient_\d+|p\d+|pt\d+)$/i.test(patientId)) {
      break;
    } else {
      console.log(`❌ Invalid patient ID format: "${patientId}", continuing search...`);
      patientId = null;
    }
  }
}

    // DEBUG LOGGING
    if (patientId) {
      console.log(`🔍 === PATIENT LOOKUP DEBUG ===`);
      console.log(`🔍 Original message: "${userMessage}"`);
      console.log(`🔍 Extracted patientId: "${patientId}"`);
      console.log(`🔍 PatientId length: ${patientId.length}`);
      console.log(`🔍 PatientId characters: ${JSON.stringify(patientId.split(''))}`);
      console.log(`🔍 About to search database for: "${patientId}"`);
      
      try {
        // Find user by userId field
        const userQuery = await db.collection("Users")
          .where("userId", "==", patientId)
          .limit(1)
          .get();

        console.log(`📊 Database query for "${patientId}" returned: ${userQuery.size} documents`);

        if (!userQuery.empty) {
          const userDoc = userQuery.docs[0];
          const userData = userDoc.data();
          const userDocId = userDoc.id; // e.g., "user_1"
          
          console.log(`✅ Found user: ${userData.firstName} ${userData.lastName} (Doc ID: ${userDocId})`);
          
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
            console.log(`✅ Found patient profile: Risk level ${profile.riskLevel}`);
          } else {
            console.log(`⚠️ No patient profile found for doc ID: ${userDocId}`);
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

         // Create FILTERED context for AI (remove sensitive data)
patientContext = `
PATIENT CLINICAL INFORMATION FOR ${patientId.toUpperCase()}:
- Name: ${patientData.name}
- Gender: ${patientData.gender}
- Risk Level: ${patientData.riskLevel}
- Medical Alerts: ${patientData.medicalAlerts.join(', ') || 'None recorded'}

Based on this patient's clinical profile, please provide medical guidance.
`;

          console.log(`✅ Generated context for patient: ${patientId}`);
        } else {
          console.log(`❌ Patient ${patientId} not found in Users collection`);
          patientContext = `Patient ${patientId} not found in database. Please verify the patient ID.`;
        }
      } catch (error) {
        console.error("❌ Error fetching patient data:", error);
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
    console.error("❌ Podiatrist chat error:", err);
    return res.status(500).json({ reply: "Something went wrong with the clinical assistant." });
  }
});

// ========================================
// NEW DATABASE ROUTES FOR AI CHAT
// ========================================

// GET URGENT CASES - Separate route for better organization
app.post("/get-urgent-cases", async (req, res) => {
  const { podiatristId } = req.body;
  
  try {
    console.log('🚨 Fetching urgent cases...');
    
    // Get today's date range
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);
    
    // Query for urgent cases (urgency level 1 and 2)
    const urgentQuery = await db.collection("Appointments")
      .where("scheduledDate", ">=", admin.firestore.Timestamp.fromDate(startOfDay))
      .where("scheduledDate", "<=", admin.firestore.Timestamp.fromDate(endOfDay))
      .where("status", "==", "scheduled")
      .get();

    console.log('📊 Total appointments found:', urgentQuery.size);

    // Filter for urgent cases (level 1 and 2)
    const urgentAppointments = [];
    
    for (const appointmentDoc of urgentQuery.docs) {
      const appointment = appointmentDoc.data();
      
      // Only include urgent cases (level 1 and 2)
      if (appointment.urgencyLevel <= 2) {
        
        // Get patient details
        let patientInfo = {
          name: appointment.patientId,
          phone: "N/A",
          email: "N/A"
        };

        try {
          const patientQuery = await db.collection("Users")
            .where("userId", "==", appointment.patientId)
            .limit(1)
            .get();

          if (!patientQuery.empty) {
            const patientData = patientQuery.docs[0].data();
            patientInfo = {
              name: `${patientData.firstName || ''} ${patientData.lastName || ''}`.trim(),
              phone: patientData.phone || "N/A",
              email: patientData.email || "N/A"
            };
          }
        } catch (patientError) {
          console.log('⚠️ Patient lookup failed:', patientError.message);
        }

        const scheduledDate = appointment.scheduledDate.toDate();
        urgentAppointments.push({
          appointmentId: appointmentDoc.id,
          patientId: appointment.patientId,
          patientName: patientInfo.name,
          patientPhone: patientInfo.phone,
          patientEmail: patientInfo.email,
          scheduledTime: scheduledDate.toLocaleTimeString("en-SG", {
            hour: "2-digit",
            minute: "2-digit",
            hour12: true,
            timeZone: "Asia/Singapore"
          }),
          category: appointment.category || "General",
          urgencyLevel: appointment.urgencyLevel,
          urgencyText: getUrgencyText(appointment.urgencyLevel),
          initialDiagnosis: appointment.initialDiagnosis || "Assessment pending",
          summary: appointment.summary || "No additional notes",
          status: appointment.status
        });
      }
    }

    // Sort by urgency level
    urgentAppointments.sort((a, b) => a.urgencyLevel - b.urgencyLevel);

    console.log('🚨 Returning', urgentAppointments.length, 'urgent cases');

    return res.json({
      success: true,
      urgentCases: urgentAppointments,
      totalCount: urgentAppointments.length,
      date: new Date().toLocaleDateString("en-SG", {
        weekday: "long",
        year: "numeric", 
        month: "long",
        day: "numeric",
        timeZone: "Asia/Singapore"
      })
    });

  } catch (error) {
    console.error("❌ Error fetching urgent cases:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to fetch urgent cases",
      message: error.message
    });
  }
});

// FIXED GET RECENT PATIENT SUMMARIES - Uses actual database data
app.post("/get-recent-summaries", async (req, res) => {
  const { podiatristId } = req.body;
  
  try {
    console.log('📝 Fetching recent patient summaries from actual database...');
    
    // Get all appointments (recent ones) - adjust date range as needed
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    
    const appointmentsQuery = await db.collection("Appointments")
      .where("triageDateTime", ">=", admin.firestore.Timestamp.fromDate(oneWeekAgo))
      .orderBy("triageDateTime", "desc")
      .get();

    console.log('📊 Found', appointmentsQuery.size, 'recent appointments');

    if (appointmentsQuery.empty) {
      return res.json({
        success: true,
        summaries: [],
        totalCount: 0,
        message: "No recent patient summaries found in database"
      });
    }

    const recentSummaries = [];
    
    // Process each appointment and get REAL patient details
    for (const appointmentDoc of appointmentsQuery.docs) {
      const appointment = appointmentDoc.data();
      console.log('Processing appointment for patient:', appointment.patientId);
      
      // Get REAL patient details from Users collection
      let realPatientInfo = {
        name: appointment.patientId, // fallback to patientId
        phone: "N/A",
        email: "N/A"
      };

      try {
        console.log('Looking up REAL patient data for:', appointment.patientId);
        const patientQuery = await db.collection("Users")
          .where("userId", "==", appointment.patientId)
          .limit(1)
          .get();

        if (!patientQuery.empty) {
          const patientData = patientQuery.docs[0].data();
          console.log('✅ Found REAL patient:', patientData.firstName, patientData.lastName);
          
          realPatientInfo = {
            name: `${patientData.firstName || ''} ${patientData.lastName || ''}`.trim(),
            phone: patientData.phone || "N/A",
            email: patientData.email || "N/A"
          };
        } else {
          console.log('⚠️ No patient found in Users collection for:', appointment.patientId);
        }
      } catch (patientError) {
        console.error('❌ Error looking up patient:', patientError);
      }

      // Format the REAL appointment data
      const triageDate = appointment.triageDateTime ? 
        appointment.triageDateTime.toDate() : 
        new Date();
      
      const scheduledDate = appointment.scheduledDate ? 
        appointment.scheduledDate.toDate() : 
        new Date();
      
      const realSummary = {
        appointmentId: appointmentDoc.id,
        patientId: appointment.patientId,
        patientName: realPatientInfo.name,
        patientPhone: realPatientInfo.phone,
        patientEmail: realPatientInfo.email,
        triageDate: triageDate.toLocaleDateString("en-SG", {
          weekday: "short",
          month: "short", 
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
          hour12: true,
          timeZone: "Asia/Singapore"
        }),
        scheduledDate: scheduledDate.toLocaleDateString("en-SG", {
          weekday: "long",
          month: "long",
          day: "numeric", 
          hour: "2-digit",
          minute: "2-digit",
          hour12: true,
          timeZone: "Asia/Singapore"
        }),
        category: appointment.category || "General",
        urgencyLevel: appointment.urgencyLevel || 4,
        urgencyText: getUrgencyText(appointment.urgencyLevel),
        initialDiagnosis: appointment.initialDiagnosis || "Assessment pending",
        summary: appointment.summary || "No clinical summary available",
        status: appointment.status || "unknown"
      };

      console.log('✅ Processed REAL summary for:', realSummary.patientName);
      recentSummaries.push(realSummary);
    }

    // Sort by triage date (most recent first)
    recentSummaries.sort((a, b) => {
      const dateA = new Date(a.triageDate);
      const dateB = new Date(b.triageDate);
      return dateB - dateA;
    });

    console.log('📝 Returning', recentSummaries.length, 'REAL patient summaries');
    console.log('📋 Patient names found:', recentSummaries.map(s => s.patientName));

    return res.json({
      success: true,
      summaries: recentSummaries,
      totalCount: recentSummaries.length,
      message: `Found ${recentSummaries.length} real patient summaries from database`
    });

  } catch (error) {
    console.error("❌ Error fetching real patient summaries:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to fetch patient summaries from database",
      message: error.message,
      summaries: [],
      totalCount: 0
    });
  }
});

// OPTIMIZED GET TODAY'S SCHEDULE with simple caching
let scheduleCache2 = {
  data: null,
  timestamp: null,
  TTL: 30000 // 30 seconds cache
};

app.post("/get-todays-schedule", async (req, res) => {
  const { podiatristId } = req.body;
  
  try {
    // CHECK CACHE FIRST (INSTANT RESPONSE IF CACHED)
    const now = Date.now();
    if (scheduleCache2.data && 
        scheduleCache2.timestamp && 
        (now - scheduleCache2.timestamp) < scheduleCache2.TTL) {
      console.log('📋 Returning cached schedule data (INSTANT)');
      return res.json(scheduleCache2.data);
    }
    
    console.log('📅 Fetching fresh schedule from database...');
    
    // Get today's date range
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);
    
    console.log('🔍 Date range:', startOfDay, 'to', endOfDay);
    
    // SIMPLIFIED QUERY - Remove orderBy to avoid index issues
    const appointmentsQuery = await db.collection("Appointments")
      .where("scheduledDate", ">=", admin.firestore.Timestamp.fromDate(startOfDay))
      .where("scheduledDate", "<=", admin.firestore.Timestamp.fromDate(endOfDay))
      .where("status", "==", "scheduled")
      .get();

    console.log('📊 Found appointments:', appointmentsQuery.size);

   if (appointmentsQuery.empty) {
    const emptyResult = {
      success: true,
      appointments: [],
      totalCount: 0,
      message: "No appointments scheduled for today",
      date: new Date().toLocaleDateString("en-SG", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
        timeZone: "Asia/Singapore"
      }),
      isEmpty: true // ADD EMPTY FLAG
    };
    
    // CACHE EMPTY RESULT TOO
    scheduleCache2.data = emptyResult;
    scheduleCache2.timestamp = now;
    
    return res.json(emptyResult);
  }

    // Process appointments in parallel for speed
    const appointmentPromises = appointmentsQuery.docs.map(async (appointmentDoc) => {
      const appointment = appointmentDoc.data();
      console.log('📋 Processing appointment:', appointmentDoc.id, 'for patient:', appointment.patientId);
      
      let patientInfo = {
        name: appointment.patientId,
        phone: "N/A",
        email: "N/A"
      };

      // OPTIMIZED: Parallel patient lookup with timeout
      try {
        const patientQuery = await Promise.race([
          db.collection("Users")
            .where("userId", "==", appointment.patientId)
            .limit(1)
            .get(),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Patient lookup timeout')), 2000)
          )
        ]);

        if (!patientQuery.empty) {
          const patientData = patientQuery.docs[0].data();
          patientInfo = {
            name: `${patientData.firstName || ''} ${patientData.lastName || ''}`.trim(),
            phone: patientData.phone || "N/A",
            email: patientData.email || "N/A"
          };
        }
      } catch (patientError) {
        console.log('⚠️ Patient lookup failed/timeout, using default:', patientError.message);
      }

      // Format appointment data
      const scheduledDate = appointment.scheduledDate.toDate();
      return {
        appointmentId: appointmentDoc.id,
        patientId: appointment.patientId,
        patientName: patientInfo.name,
        patientPhone: patientInfo.phone,
        patientEmail: patientInfo.email,
        scheduledTime: scheduledDate.toLocaleTimeString("en-SG", {
          hour: "2-digit",
          minute: "2-digit",
          hour12: true,
          timeZone: "Asia/Singapore"
        }),
        scheduledDate: scheduledDate.toLocaleDateString("en-SG", {
          weekday: "long",
          year: "numeric",
          month: "long",
          day: "numeric",
          timeZone: "Asia/Singapore"
        }),
        category: appointment.category || "General",
        urgencyLevel: appointment.urgencyLevel || 4,
        urgencyText: getUrgencyText(appointment.urgencyLevel),
        initialDiagnosis: appointment.initialDiagnosis || "Assessment pending",
        summary: appointment.summary || "No additional notes",
        status: appointment.status
      };
    });

    // Wait for all appointments to be processed
    const todaysAppointments = await Promise.all(appointmentPromises);

    // Sort in JavaScript (faster than Firebase)
    todaysAppointments.sort((a, b) => {
      if (a.urgencyLevel !== b.urgencyLevel) {
        return a.urgencyLevel - b.urgencyLevel;
      }
      return new Date(`1970-01-01 ${a.scheduledTime}`) - new Date(`1970-01-01 ${b.scheduledTime}`);
    });

    console.log('✅ Returning', todaysAppointments.length, 'appointments');

    const result = {
      success: true,
      appointments: todaysAppointments,
      totalCount: todaysAppointments.length,
      date: new Date().toLocaleDateString("en-SG", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
        timeZone: "Asia/Singapore"
      })
    };

    // CACHE THE RESULT FOR FASTER SUBSEQUENT REQUESTS
    scheduleCache2.data = result;
    scheduleCache2.timestamp = now;

    return res.json(result);

  } catch (error) {
    console.error("❌ Error fetching today's schedule:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to fetch today's schedule",
      message: error.message
    });
  }
});

// Helper function to convert urgency level to text
function getUrgencyText(urgencyLevel) {
  switch (urgencyLevel) {
    case 1: return "🚨 Urgent - Wound Care";
    case 2: return "⚠️ High - Nail Surgery";
    case 3: return "📋 Medium - High Risk Footcare";
    case 4: return "📝 Low - MSK";
    default: return "📋 Standard";
  }
}

// OPTIMIZED SCHEDULE BY DATE ROUTE - FASTER DATABASE QUERIES
app.post("/get-schedule-by-date", async (req, res) => {
  const { podiatristId, targetDate } = req.body;
  
  try {
    // CACHE CHECK FIRST
    const cacheKey = getCacheKey(targetDate, podiatristId);
    const cachedResult = scheduleCache.get(cacheKey);
    
    if (isValidCache(cachedResult)) {
      console.log('⚡ CACHE HIT: Returning cached schedule');
      return res.json(cachedResult.data);
    }
    
    console.log('📅 CACHE MISS: Fetching fresh schedule for date:', targetDate);
    
    // OPTIMIZATION 1: Create date range more efficiently
    let scheduleDate;
    if (targetDate && targetDate !== 'today') {
      if (typeof targetDate === 'string' && targetDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
        scheduleDate = new Date(targetDate + 'T12:00:00+08:00');
      } else {
        scheduleDate = new Date(targetDate);
      }
      
      if (isNaN(scheduleDate.getTime())) {
        return res.status(400).json({
          success: false,
          error: "Invalid date format"
        });
      }
    } else {
      scheduleDate = new Date();
    }
    
    const dateStr = scheduleDate.toISOString().split('T')[0];
    const startOfDay = new Date(dateStr + 'T00:00:00+08:00');
    const endOfDay = new Date(dateStr + 'T23:59:59.999+08:00');
    
    console.log('🚀 FAST: Querying Firebase...');
    console.log('🔍 FAST Date string:', dateStr);
    console.log('🔍 FAST Start of day (Singapore):', startOfDay.toISOString());
    console.log('🔍 FAST End of day (Singapore):', endOfDay.toISOString());
    
    // OPTIMIZATION 2: Single optimized query
    const appointmentsQuery = await db.collection("Appointments")
      .where("scheduledDate", ">=", admin.firestore.Timestamp.fromDate(startOfDay))
      .where("scheduledDate", "<=", admin.firestore.Timestamp.fromDate(endOfDay))
      .where("status", "==", "scheduled")
      .get();

    console.log('⚡ FAST: Found', appointmentsQuery.size, 'appointments');

   if (appointmentsQuery.empty) {
    const emptyResult = {
      success: true,
      appointments: [],
      totalCount: 0,
      message: `No appointments scheduled for ${scheduleDate.toLocaleDateString("en-SG")}`,
      date: scheduleDate.toLocaleDateString("en-SG", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
        timeZone: "Asia/Singapore"
      }),
      isEmpty: true  // ADD EMPTY FLAG FOR DIRECT HANDLING
    };
    
    // CACHE EMPTY RESULT TOO
    scheduleCache.set(cacheKey, {
      data: emptyResult,
      timestamp: Date.now()
    });
    
    return res.json(emptyResult);
  }

    // OPTIMIZATION 3: Batch patient lookups with timeout and parallel processing
    console.log('🔄 FAST: Processing appointments in parallel...');
    
    // Get all unique patient IDs first
    const patientIds = [...new Set(appointmentsQuery.docs.map(doc => doc.data().patientId))];
    console.log('👥 FAST: Looking up', patientIds.length, 'unique patients');
    
    // OPTIMIZATION 4: Batch patient lookup
    const patientLookupPromises = patientIds.map(async (patientId) => {
      try {
        const patientQuery = await Promise.race([
          db.collection("Users")
            .where("userId", "==", patientId)
            .limit(1)
            .get(),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('timeout')), 1500) // Reduced timeout
          )
        ]);

        if (!patientQuery.empty) {
          const patientData = patientQuery.docs[0].data();
          return {
            patientId,
            name: `${patientData.firstName || ''} ${patientData.lastName || ''}`.trim(),
            phone: patientData.phone || "N/A",
            email: patientData.email || "N/A"
          };
        }
      } catch (error) {
        console.log(`⚠️ FAST: Patient lookup failed for ${patientId}:`, error.message);
      }
      
      // Fallback
      return {
        patientId,
        name: patientId,
        phone: "N/A",
        email: "N/A"
      };
    });

    // Wait for all patient lookups
    const patientDataMap = {};
    const patientResults = await Promise.all(patientLookupPromises);
    patientResults.forEach(result => {
      patientDataMap[result.patientId] = result;
    });

    console.log('✅ FAST: Patient data retrieved, building response...');

    // OPTIMIZATION 5: Fast appointment processing
    const dayAppointments = appointmentsQuery.docs.map(appointmentDoc => {
      const appointment = appointmentDoc.data();
      const patientInfo = patientDataMap[appointment.patientId] || {
        name: appointment.patientId,
        phone: "N/A",
        email: "N/A"
      };

      const scheduledDate = appointment.scheduledDate.toDate();
      return {
        appointmentId: appointmentDoc.id,
        patientId: appointment.patientId,
        patientName: patientInfo.name,
        patientPhone: patientInfo.phone,
        patientEmail: patientInfo.email,
        scheduledTime: scheduledDate.toLocaleTimeString("en-SG", {
          hour: "2-digit",
          minute: "2-digit",
          hour12: true,
          timeZone: "Asia/Singapore"
        }),
        scheduledDate: scheduledDate.toLocaleDateString("en-SG", {
          weekday: "long",
          year: "numeric",
          month: "long",
          day: "numeric",
          timeZone: "Asia/Singapore"
        }),
        category: appointment.category || "General",
        urgencyLevel: appointment.urgencyLevel || 4,
        urgencyText: getUrgencyText(appointment.urgencyLevel),
        initialDiagnosis: appointment.initialDiagnosis || "Assessment pending",
        summary: appointment.summary || "No additional notes",
        status: appointment.status
      };
    });

    // OPTIMIZATION 6: Fast JavaScript sorting
    dayAppointments.sort((a, b) => {
      if (a.urgencyLevel !== b.urgencyLevel) {
        return a.urgencyLevel - b.urgencyLevel;
      }
      return new Date(`1970-01-01 ${a.scheduledTime}`) - new Date(`1970-01-01 ${b.scheduledTime}`);
    });

    console.log('🚀 FAST: Sending response with', dayAppointments.length, 'appointments');

    const result = {
      success: true,
      appointments: dayAppointments,
      totalCount: dayAppointments.length,
      date: scheduleDate.toLocaleDateString("en-SG", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
        timeZone: "Asia/Singapore"
      })
    };

    // CACHE THE RESULT FOR FASTER SUBSEQUENT REQUESTS
    scheduleCache.set(cacheKey, {
      data: result,
      timestamp: Date.now()
    });

    console.log('💾 CACHED: Schedule cached for future requests');

    return res.json(result);

  } catch (error) {
    console.error("❌ FAST: Error fetching schedule:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to fetch schedule",
      message: error.message
    });
  }
});

// Fetch list of podiatrists appointments for queue
app.post('/podiatrist-get-queue', async (req, res) => {
  const { podId } = req.body;
  console.log("🔍 Fetching queue info for:", podId);

  try {
    // Get appointment
    const apptSnapshot = await db.collection("Appointments")//Get appointments for this pod
      .where("podId", "==", podId)
      .get();

    let appointments = [];// Make data list
    if (!apptSnapshot.empty) {
      const patientIds = [];

      apptSnapshot.docs.forEach(doc=>{ //Loop and get data from each entry retreived
        const appt = doc.data();
        patientIds.push(appt.patientId);

        //Add data to data object
        const appointment = {
          patientId: appt.patientId,
          date: appt.scheduledDate.toDate().toLocaleDateString('en-SG', { year: 'numeric', month: 'long', day: 'numeric' }),
          time: appt.scheduledDate.toDate().toLocaleTimeString('en-SG', { hour: '2-digit', minute: '2-digit', hour12: true }),
          urgencyLevel: appt.urgencyLevel,
          category: appt.category,
          initialDiagnosis: appt.initialDiagnosis,
          summary: appt.summary
        };
        appointments.push(appointment); //Put data object into appointments list
      });
      
      //Get list of users that match appointments
      const userSnapshots = await db.collection("Users")
        .where("userId", "in", patientIds)
        .get();

      const userMap = {};
      userSnapshots.docs.forEach(userDoc => {
        const userData = userDoc.data();
        userMap[userData.userId] = userData.firstName + " " + userData.lastName; 
      });

      // Add patient names to appointments
      appointments = appointments.map(appt => ({
        ...appt,
        name: userMap[appt.patientId] || "Unknown"
      }));
      
      //Return result in json
      return res.json({
        appointments
      });

    }else{
      console.log("❌ No Appointments found");
      return res.json({
        response: "No Appointments Found",
        appointments: null
      });
    }
  } catch (error) {
    console.error("❌ Error in /podiatrist-get-queue:", error);
    res.status(500).json({ error: "Failed to fetch queue" });
  }
});

// Fetch appouintments for calander
app.post('/podiatrist-get-calendar', async (req, res) => {
  const { podId } = req.body;
  console.log("🔍 Fetching calendar info for:", podId);

  try {
    // Get appointment
    const apptSnapshot = await db.collection("Appointments") //Get appointments for this pod
      .where("podId", "==", podId)
      .where("status", "==", "scheduled")
      // .orderBy("scheduledDate")
      .get();

    let appointments = [];// Make data list
    if (!apptSnapshot.empty) {
      const patientIds = [];
      apptSnapshot.docs.forEach(doc=>{ //Loop and get data from each entry retreived
        const appt = doc.data();
        patientIds.push(appt.patientId);

        //Add data to data object
        const appointment = {
          apptId: doc.id, // ID of document for this appotinment (for updating)
          patId: appt.patientId,
          date: appt.scheduledDate.toDate().toLocaleDateString('en-SG', { year: 'numeric', month: 'long', day: 'numeric' }), // Convert Firestore timestamp to JavaScript Date
          time: appt.scheduledDate.toDate().toLocaleTimeString('en-SG', { hour: '2-digit', minute: '2-digit', hour12: true }), // Convert Firestore timestamp to JavaScript Date
          type: appt.category, 
        };
        appointments.push(appointment); //Put data object into appointments list
      });

      //Get list of users that match appointments
      const userSnapshots = await db.collection("Users")
        .where("userId", "in", patientIds)
        .get();

      const userMap = {};
      userSnapshots.docs.forEach(userDoc => {
        const userData = userDoc.data();
        userMap[userData.userId] = userData.firstName + " " + userData.lastName;
      });

      // Add patient names to appointments as "patient"
      appointments = appointments.map(appt => ({
        ...appt,
        patient: userMap[appt.patId] || "Unknown"
      }));
      
      //Return result in json
      return res.json({
        appointments
      });

    }else{
      console.log("❌ No Appointments found");
      return res.json({
        response: "No Appointments Found",
        appointments: null
      });
    }
  } catch (error) {
    console.error("❌ Error in /podiatrist-get-calendar:", error);
    res.status(500).json({ error: "Failed to fetch calendar" });
  }
});

//Update info in calander
app.post('/calendar-update-appointment', async (req, res) => {
  // const { apptId, newDate } = {"appt_1": "July 9 2025, 3:00 PM"};
  const { apptId, updateData } = req.body;
  console.log("🔍 Updating appt info for:", apptId);

  try {
    const docRef = db.collection("Appointments").doc(apptId);
    console.log("apptId="+apptId)
    console.log("updateData="+updateData)
    const updates = {
      scheduledDate: admin.firestore.Timestamp.fromDate(new Date(updateData)), // Convert newDate to Firestore timestamp
    };
    await docRef.update(updates);
    return res.json({ success: true, message: "Appointment updated successfully." });
  } catch (error) {
    console.error("Error updating appointment:", error);
    return res.status(500).json({ success: false, error: "Failed to update appointment." });
  }
});

// ========================================
// ENHANCED DATE PARSING HELPER FUNCTIONS
// ========================================

function parseNaturalDate(dateString) {
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  
  // Handle relative dates
  const lowerCase = dateString.toLowerCase();
  
  if (lowerCase.includes('today')) {
    return today.toISOString().split('T')[0];
  }
  
  if (lowerCase.includes('tomorrow')) {
    return tomorrow.toISOString().split('T')[0];
  }
  
  if (lowerCase.includes('yesterday')) {
    return yesterday.toISOString().split('T')[0];
  }
  
  // Handle "next monday", "this friday" etc.
  const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  for (let i = 0; i < dayNames.length; i++) {
    if (lowerCase.includes(dayNames[i])) {
      const targetDay = i;
      const currentDay = today.getDay();
      let daysToAdd = targetDay - currentDay;
      
      if (lowerCase.includes('next') || daysToAdd <= 0) {
        daysToAdd += (daysToAdd <= 0 ? 7 : 0);
      }
      
      const targetDate = new Date(today);
      targetDate.setDate(today.getDate() + daysToAdd);
      return targetDate.toISOString().split('T')[0];
    }
  }
  
  // Handle specific dates like "July 1", "1st July", "2025-07-01"
  const dateMatch = dateString.match(/(\d{4}-\d{2}-\d{2})/);
  if (dateMatch) {
    return dateMatch[1];
  }
  
  // Try to parse as a regular date
  const parsedDate = new Date(dateString);
  if (!isNaN(parsedDate.getTime())) {
    return parsedDate.toISOString().split('T')[0];
  }
  
  return null;
}

// ========================================
// DATE/TIME PARSING HELPER FUNCTION
// ========================================

function parseDateTime(dateTimeString) {
  try {
    // Handle "YYYY-MM-DD HH:MM" format
    const dateTimeMatch = dateTimeString.match(/(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2})/);
    if (dateTimeMatch) {
      const [, datePart, timePart] = dateTimeMatch;
      const [hours, minutes] = timePart.split(':').map(Number);
      
      // Create date in Singapore timezone
      const date = new Date(`${datePart}T${timePart}:00+08:00`);
      
      if (!isNaN(date.getTime())) {
        return date;
      }
    }
    
    // Fallback: try to parse as regular date
    const fallbackDate = new Date(dateTimeString);
    if (!isNaN(fallbackDate.getTime())) {
      return fallbackDate;
    }
    
    return null;
  } catch (error) {
    console.error('Error parsing date/time:', error);
    return null;
  }
}

// EDIT APPOINTMENT ROUTE
app.post("/edit-appointment", async (req, res) => {
  const { patientId, newDateTime, podiatristId } = req.body;
  
  try {
    console.log('📝 Editing appointment for:', patientId, 'to:', newDateTime);
    
    // Find the appointment
    const appointmentQuery = await db.collection("Appointments")
      .where("patientId", "==", patientId)
      .where("status", "==", "scheduled")
      .limit(1)
      .get();
    
    if (appointmentQuery.empty) {
      return res.json({
        success: false,
        message: "No scheduled appointment found for this patient"
      });
    }
    
    const appointmentDoc = appointmentQuery.docs[0];
    const currentAppointment = appointmentDoc.data();
    
    // Parse new date/time (you'll need to implement this)
    const newScheduledDate = parseDateTime(newDateTime);
    
    if (!newScheduledDate) {
      return res.json({
        success: false,
        message: "Invalid date/time format. Please try again."
      });
    }
    
    // Update the appointment
    await appointmentDoc.ref.update({
      scheduledDate: admin.firestore.Timestamp.fromDate(newScheduledDate),
      lastModified: admin.firestore.Timestamp.now()
    });
    
    // Get patient name
    const patientQuery = await db.collection("Users")
      .where("userId", "==", patientId)
      .limit(1)
      .get();
    
    const patientName = !patientQuery.empty ? 
      `${patientQuery.docs[0].data().firstName} ${patientQuery.docs[0].data().lastName}` : 
      patientId;
    
    return res.json({
      success: true,
      patientName: patientName,
      newDateTime: newScheduledDate.toLocaleDateString("en-SG", {
        weekday: "long",
        year: "numeric",
        month: "long", 
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
        timeZone: "Asia/Singapore"
      }),
      oldDateTime: currentAppointment.scheduledDate.toDate().toLocaleDateString("en-SG", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric", 
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
        timeZone: "Asia/Singapore"
      })
    });
    
  } catch (error) {
    console.error("❌ Error editing appointment:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while updating appointment"
    });
  }
});

// GET UPCOMING APPOINTMENTS FOR EDITING
app.post("/get-upcoming-appointments", async (req, res) => {
  const { podiatristId, days = 7, limit = 10 } = req.body;
  
  try {
    console.log('📅 Fetching upcoming appointments for editing...');
    
    // Get date range (today + next X days)
    const startDate = new Date();
    const endDate = new Date();
    endDate.setDate(startDate.getDate() + days);
    
    // Query appointments
    const appointmentsQuery = await db.collection("Appointments")
      .where("scheduledDate", ">=", admin.firestore.Timestamp.fromDate(startDate))
      .where("scheduledDate", "<=", admin.firestore.Timestamp.fromDate(endDate))
      .where("status", "==", "scheduled")
      .orderBy("scheduledDate")
      .limit(limit)
      .get();

    // Get total count (for "show more" functionality)
    const countQuery = await db.collection("Appointments")
      .where("scheduledDate", ">=", admin.firestore.Timestamp.fromDate(startDate))
      .where("scheduledDate", "<=", admin.firestore.Timestamp.fromDate(endDate))
      .where("status", "==", "scheduled")
      .get();

    const appointments = [];
    
    for (const doc of appointmentsQuery.docs) {
      const appointment = doc.data();
      
      // Get patient name
      let patientName = appointment.patientId;
      try {
        const patientQuery = await db.collection("Users")
          .where("userId", "==", appointment.patientId)
          .limit(1)
          .get();
        
        if (!patientQuery.empty) {
          const patientData = patientQuery.docs[0].data();
          patientName = `${patientData.firstName} ${patientData.lastName}`.trim();
        }
      } catch (error) {
        console.log('Patient lookup failed:', error);
      }
      
      const scheduledDate = appointment.scheduledDate.toDate();
      appointments.push({
        appointmentId: doc.id,
        patientId: appointment.patientId,
        patientName,
        scheduledDateTime: scheduledDate.toLocaleDateString("en-SG", {
          weekday: "short",
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
          hour12: true,
          timeZone: "Asia/Singapore"
        }),
        category: appointment.category || "General",
        urgencyLevel: appointment.urgencyLevel || 4,
        urgencyText: getUrgencyText(appointment.urgencyLevel),
        initialDiagnosis: appointment.initialDiagnosis || "Assessment pending"
      });
    }
    
    return res.json({
      success: true,
      appointments,
      totalCount: countQuery.size,
      showing: appointments.length
    });
    
  } catch (error) {
    console.error("❌ Error fetching upcoming appointments:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to fetch appointments"
    });
  }
});

// Set default path to login.html
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "login.html"));
});

// Start server
const PORT = 3000;
app.listen(PORT, () => console.log(`✅ Server running at http://localhost:${PORT}`));