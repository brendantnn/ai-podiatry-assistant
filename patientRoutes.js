const express = require("express");
const cors = require("cors");
const { OpenAI } = require("openai");
const path = require("path");
const router = express.Router();
const { db } = require("./firebase");



// key = fake session ID (for now, assume 1 user)
const session = {};

// ************************************************* PATIENT LOGIC **************************************************************************

router.post("/chat", async (req, res) => {
  console.log("/chat route");

  // Store user message and user id
  const userMessage = req.body.message;
  const userId = req.body.patientId;
  const messageText = userMessage.toLowerCase();


  // *************** STEP 1: CLASSIFY USER'S INTENT *******************
  // Use OpenAI to classify user's intent - appointment, triage, or other into a cosntant variable
  const intentResponse = await openai.chat.completions.create({ // this returns an array ".choices" with the possible replies
    model: "gpt-3.5-turbo",
    messages: [
      {
        role: "system",
        content: `You are an intent classifier for a podiatry chatbot.

The user may be asking about:
1. "appointment" → checking existing appointments or viewing upcoming schedules (e.g. "When is my next visit?", "Do I have anything booked?")
2. "triage" → describing symptoms, foot concerns, or trying to book a new appointment (e.g. "My heel hurts", "I want to book an appointment", "Can I see a podiatrist?")
3. "other" → small talk or questions unrelated to podiatry

Just return one word: "appointment", "triage", or "other".`
      },
      {
        role: "user",
        content: messageText
      }
    ]
  });
  // Gets response from the array returned by GPT - "appointment", "triage", "other"
  const intent = intentResponse.choices[0].message.content.trim().toLowerCase();
  console.log("🧠 Detected intent:", intent);

  // Create session object that stores conversation state, symptom message, appointment slot info
  session[userId] = session[userId] || {
    state: "idle", // state includes idle, triage, awaiting_confirmation
    triageStage: null,
    messages: [], //convo history
    pendingSlot: null,
    pendingSlotData: null
  };

  // Store session to s for easy access
  const s = session[userId];

  console.log("🆕 Incoming message:", userMessage);
  console.log("📦 Session state at start:", s);

  try {
     // *************** STEP 2: TRIAGE INTENT *******************

    // IF USER WANTS TRIAGE AND NO MESSAGE SENT YET, set state to triage and triageStage to initial_query
    if (intent === "triage" && s.state === "idle") {
      console.log("🧠 Detected intent=triage and state=idle, user want to triage and has sent no msgs yet");
      s.state = "triage"; 
      s.triageStage = "initial_query";
      s.messages = []; // clear convo history

      console.log("🟢 Updated session (triage start):", s);
    }

    // IF IN TRIAGE STATE AND IN INITIAL QUERY STAGE
    if (s.state === "triage" && s.triageStage === "initial_query") {
      console.log("Detected state=triage and triageStage=initial query, clarifying stage now");
      s.messages.push({ role: "user", content: userMessage });
      console.log("📝 Current messages:", s.messages);

      // Use openai to ask follow up questions, store reply into clarification
      const clarification = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [
          {
            role: "system",
            content: `You are a warm, professional podiatry triage assistant. A patient has just shared their foot-related concern.

Start by thanking them and letting them know you’ll ask a few short questions to understand the issue better and help arrange the right appointment.

Then ask follow-up questions to detect:
- Pus, discharge, bleeding
- Wound, redness, swelling, warmth
- Trauma, pain severity or location
- Infection signs or diabetic complications

Your goal is to identify which urgency category it fits into:

The urgency categories are
1 (most urgent). wound care: presence of wound, signs of infection like redness, swelling , pain, pus, warm to touch, gangrene, infection, neuropathic / ischaemic / neuroischaemic wounds / ulcers
2. nail surgery: ingrown toenail, involuted toenail
3. high risk footcare: callus, corns, warts, pathological toenails
4 (least urgent). MSK: foot pain, foot wear, plantar fasciitis, posterior tibial tendon dysfunction, limb length discrepancy, hallux valgus / bunions, metatarsalgia

You should ONLY categorize as “urgent” if symptoms clearly suggest infection, active wound, diabetic complications, trauma, or signs of rapid worsening.

Arch pain or flat feet without alarming symptoms should NOT be urgent. These fall under MSK and are not considered emergencies.
            
  Only ask **questions** at this stage. Do NOT attempt to diagnose or categorize yet. Your questions must help determine if the case could fall under wound care, nail surgery, high-risk footcare, or MSK.

If the patient already answered clearly, you can still confirm: 
> "Is there any visible swelling, wound, or pus?"

Respond with 1–3 concise, specific follow-up questions.`
          },
          { role: "user", content: userMessage }
        ]
      });

      const followUp = clarification.choices[0].message.content;

      // Set triageStage to clarification
      s.triageStage = "clarification"; 

      return res.json({ reply: followUp }); // returns follow up question
    }

    // IF IN TRIAGE STATE AND CLARIFICATION TRIAGE STAGE
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
Write a message that starts with an appropriate sentence based on the urgency level and use <br> for line breaks:

- If urgency level = 1 → "You need to see a podiatrist urgently."
- If urgency level = 2 → "You should see a podiatrist soon."
- If urgency level = 3 → "This should be checked by a podiatrist."
- If urgency level = 4 → "This is not urgent, but a podiatrist can help manage the issue."
<br><br>

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

      // Set appointemnt urgency
      const now = new Date();
      const minDate = new Date();
      const maxDate = new Date();

      //Level 1: Book immediately, Level 2: Book starting tomorrow, Level 3: Book from 3 days later,Level 4: Book from 5 days later

      if (urgencyLevel === 1) {
        // Wound care – immediate
        minDate.setDate(now.getDate());       // today
        maxDate.setDate(now.getDate() + 2);   // up to 2 days
      } else if (urgencyLevel === 2) {
        // Nail surgery
        minDate.setDate(now.getDate() + 1);   // earliest tomorrow
        maxDate.setDate(now.getDate() + 7);   // up to 1 week
      } else if (urgencyLevel === 3) {
        // High risk footcare
        minDate.setDate(now.getDate() + 3);   // not before 3 days
        maxDate.setDate(now.getDate() + 14);  // up to 2 weeks
      } else if (urgencyLevel === 4) {
        // MSK
        minDate.setDate(now.getDate() + 5);   // not before 5 days
        maxDate.setDate(now.getDate() + 21);  // up to 3 weeks
      }


      console.log("✅ GPT classification reply:\n", cleanedDisplay);
      console.log("📊 Parsed category:", category);
      console.log("⚠️  Parsed urgency:", urgencyLevel);

      try {
        const slotQuery = await db.collection("Availability")
          .where("status", "==", "available")
          .where("availableDate", ">=", minDate)
          .where("availableDate", "<=", maxDate)
          .orderBy("availableDate")
          .limit(1)
          .get();

        if (slotQuery.empty) {
          s.state = "idle";
          s.triageStage = null;
          return res.json({
            reply: `${cleanedDisplay}\n\n⚠️ Sorry no appointments slots are found, please contact us.`
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
        s.pendingSlot = slotDoc;
        s.pendingSlotData = slotData;
        s.cleanedDisplay = cleanedDisplay;
        const responseMessage = `${cleanedDisplay.trim()}<br><br>📅 I found a slot on <b>${formattedDate}</b> with podiatrist <b>${slotData.podId}</b>. Would you like to book this appointment?`;

        return res.json({ reply: responseMessage });

      } catch (err) {
        console.error("❌ Error finding available slot:", err);
        s.state = "idle";
        s.triageStage = null;
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
          patientId: userId,
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

    // ****** Appointment query patient *******
    if (intent === "appointment") {
      try {
        const patientId = req.body.patientId;

        // Detect if user wants "all" appointments
        const wantsAllAppointments = /all appointments|more appointments|other appointments|future visits/.test(messageText);

        // Get ALL scheduled appointments
        const apptSnapshot = await db.collection("Appointments")
          .where("patientId", "==", patientId)
          .where("status", "==", "scheduled")
          .orderBy("scheduledDate")
          .get();

        if (apptSnapshot.empty) {
          return res.json({
            reply: "📅 You don't have any upcoming appointments at the moment."
          });
        }

        const allAppts = apptSnapshot.docs.map(doc => doc.data());

        // Helper function
        async function getPodiatristName(podId) {
          if (!podId) return "Unknown";
          const podQuery = await db.collection("Users").where("userId", "==", podId).limit(1).get();
          if (podQuery.empty) return "Unknown";
          const pod = podQuery.docs[0].data();
          return `${pod.firstName || ""} ${pod.lastName || ""}`.trim();
        }

        if (allAppts.length === 1) {
          const appt = allAppts[0];
          const podiatristName = await getPodiatristName(appt.podId);
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
        } else {
          const replies = await Promise.all(allAppts.map(async appt => {
            const podiatristName = await getPodiatristName(appt.podId);
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
            return `📅 ${formattedDate} with Dr. ${podiatristName}`;
          }));

          return res.json({
            reply: "📋 Here are your upcoming appointments:<br><br>" +
              replies.join("<br>") +
              "<br><br>Let me know if you have a foot symptom and want to make another appointment!"
          });
        }


      } catch (error) {
        console.error("❌ Error fetching appointment:", error);
        return res.json({
          reply: "⚠️ An error occurred while retrieving your appointment details."
        });
      }
    }



    // Fallback
    return res.json({
      reply: "I'm not sure what you mean. You can type 'triage' or 'appointment'."
    });

  } catch (err) {
    console.error("Chat error (patient):", err);
    return res.status(500).json({ reply: "⚠️ Something went wrong on the server." });
  }
});

// Fetch patient appointment and
router.post('/chat-patient-details', async (req, res) => {
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

    // Fetch all scheduled appointments 
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

module.exports = router;
