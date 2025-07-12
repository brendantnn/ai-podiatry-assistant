const express = require("express");
const cors = require("cors");
const { OpenAI } = require("openai");
const path = require("path");
const router = express.Router();
const { db, admin} = require("./firebase");
const translate = require('translate-google');

// Declare openai api key here
const openai = new OpenAI({
  apiKey: "REMOVED_OPENAI_API_KEY", // Replace with actual OpenAI key
});



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
      let cleanedDisplay = lastDisplay.replace(/\[DISPLAY MESSAGE.*?\]/i, "").trim();

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
      let minDate = new Date();
      let maxDate = new Date();

      let hasExistingAppt = !existingSnap.empty;
      let existingAppt = null;

      console.log(`📋 Checking existing appointments for user ${userId}`);
      console.log(`📋 Found ${existingSnap.size} existing appointment(s)`);

      // IF THERE ARE EXISTING APPOINTMENTS
      if (hasExistingAppt) {
        existingAppt = existingSnap.docs[0].data();
        const existingUrgency = existingAppt?.urgencyLevel ?? 4;

        // IF THERE ARE 2 OR MORE EXISTING APPOINTMENTS
        if (existingSnap.size > 1) {
          console.log("⚠️ Patient has multiple appointments. Adding warning to chatbot reply.");
          cleanedDisplay = `⚠️ You have ${existingSnap.size} upcoming appointments.<br>` +
            `Please ensure this new issue is necessary to book.<br><br>` +
            cleanedDisplay;
        }

        console.log(`📊 Existing urgency: ${existingUrgency}, New urgency: ${urgencyLevel}`);

        // IF NEW ISSUE IS NOT MORE URENT, BOOK APPOINTMENT RIGHT AFTER EXISTING ONE
        if (urgencyLevel >= existingUrgency) {
          console.log("🔁 New issue is not more urgent. Attempting to book 30 minutes after existing appointment.");

          const nextHalfHour = new Date(existingAppt.scheduledDate.toDate().getTime() + 30 * 60 * 1000);
          console.log(`🔎 Looking for slot at: ${nextHalfHour.toLocaleString("en-SG")}`);


          // Query for available slot 30mins after existing slot
          const followUpSnap = await db.collection("Availability")
            .where("status", "==", "available")
            .where("availableDate", "==", admin.firestore.Timestamp.fromDate(nextHalfHour))
            .where("podId", "==", existingAppt.podId)
            .limit(1)
            .get();

          // If there is an available slot 30 mins after existing slot
          if (!followUpSnap.empty) {
            const slotDoc = followUpSnap.docs[0]; // retrieve the slot
            const slotData = slotDoc.data(); // extract podId and date into slotData

            // Convert firestone's timestamp into a readable string
            const formattedDate = new Date(slotData.availableDate.toDate()).toLocaleString("en-SG", {
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
              hour12: true,
              timeZone: "Asia/Singapore"
            });

            // Store new slot into session
            s.state = "awaiting_confirmation";
            s.pendingSlot = slotDoc;
            s.pendingSlotData = slotData;

            return res.json({
              reply: `${cleanedDisplay}<br><br>📌 You already have an appointment scheduled. I found a follow-up slot right after it on <b>${formattedDate}</b> with podiatrist <b>${slotData.podId}</b>.<br>Would you like to book this additional slot?`
            });
          }

          // No follow-up slot → set minDate to after current appointment
          const existingDate = existingAppt.scheduledDate.toDate();
          minDate = new Date(existingDate);
        } else {
          // New issue is more urgent → allow earlier booking
          console.log("✅ More urgent issue, allow earlier slots.");
        }
      }

      // IF BOOK SLOT BASED ON NEW APPOINTMENT
      console.log(`🕒 Setting min/max booking range based on urgency level ${urgencyLevel}`);


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

        // Count current scheduled appointments
        const existingAppts = await db.collection("Appointments")
          .where("patientId", "==", userId)
          .where("status", "==", "scheduled")
          .get();

        const appointmentData = {
          patientId: userId,
          podId: slotData.podId,
          scheduledDate: slotData.availableDate,
          status: "scheduled",
          urgencyLevel: s.urgencyLevel,
          category: s.category,
          initialDiagnosis: s.diagnosis,
          summary: s.summary,
          triageDateTime: admin.firestore.Timestamp.now()
        };

        // If user has 2 or more appointments, mark this as highlighted
        if (existingAppts.size >= 2) {
          appointmentData.highlighted = true;
          console.log("🌟 Marking this appointment as highlighted because patient has 2 or more.");
        }

        await db.collection("Appointments").add(appointmentData);



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
    allAppointments,
    language: userData.language || "en" // Include language preference
  });

  } catch (error) {
    console.error("❌ Error in /chat-patient-details:", error);
    res.status(500).json({ error: "Failed to fetch patient details" });
  }
});

// Update patient language preference
router.post('/update-language', async (req, res) => {
  const { patientId, language } = req.body;
  console.log("🇸🇬 Updating language preference for patient:", patientId, "to:", language);

  // Validate Singapore languages
  const validLanguages = ['en', 'zh', 'ms', 'ta'];
  if (!validLanguages.includes(language)) {
    console.log("❌ Invalid language code");
    return res.json({ success: false, error: "Invalid language for Singapore" });
  }

  try {
    // Find the user document by userId
    const userSnapshot = await db.collection("Users")
      .where("userId", "==", patientId)
      .limit(1)
      .get();

    if (userSnapshot.empty) {
      console.log("❌ No matching user found");
      return res.json({ success: false, error: "User not found" });
    }

    // Update the language field
    const userDoc = userSnapshot.docs[0];
    await userDoc.ref.update({ language: language });

    console.log("✅ Language preference updated successfully");
    res.json({ success: true, language: language });

  } catch (error) {
    console.error("❌ Error updating language preference:", error);
    res.status(500).json({ success: false, error: "Failed to update language preference" });
  }
});

// // Translation endpoint with correct Google Translate language codes
//working2
// router.post('/translate', async (req, res) => {
//   const { text, targetLanguage } = req.body;
  
//   try {
//     // Skip translation if target is English or text is empty
//     if (targetLanguage === 'en' || !text || text.trim() === '') {
//       return res.json({ translatedText: text });
//     }
    
//     // Map our language codes to Google Translate language codes
//     const languageMap = {
//       'en': 'en',     // English
//       'zh': 'zh-cn',  // Chinese Simplified (Google Translate uses zh-cn)
//       'ms': 'ms',     // Malay
//       'ta': 'ta'      // Tamil
//     };
    
//     const googleLangCode = languageMap[targetLanguage] || targetLanguage;
    
//     console.log(`🌐 Translating to: ${targetLanguage} (Google code: ${googleLangCode})`);
    
//     // Translate the text
//     const translatedText = await translate(text, { to: googleLangCode });
    
//     console.log(`✅ Translation successful: "${text}" -> "${translatedText}"`);
//     res.json({ translatedText });
    
//   } catch (error) {
//     console.error('Translation error:', error);
//     // Return original text if translation fails
//     res.json({ translatedText: text });
//   }
// });

// // Optimized batch translation endpoint
// router.post('/translate-batch', async (req, res) => {
//   const { texts, targetLanguage } = req.body;
  
//   try {
//     // Skip translation if target is English
//     if (targetLanguage === 'en') {
//       return res.json({ translations: texts });
//     }
    
//     // Map language codes
//     const languageMap = {
//       'en': 'en',
//       'zh': 'zh-cn',
//       'ms': 'ms',
//       'ta': 'ta'
//     };
    
//     const googleLangCode = languageMap[targetLanguage] || targetLanguage;
    
//     console.log(`🌐 Batch translating ${texts.length} texts to: ${targetLanguage}`);
    
//     // Join all texts with a separator for batch translation
//     const separator = ' ||| ';
//     const combinedText = texts.join(separator);
    
//     // Single API call for all texts
//     const translatedCombined = await translate(combinedText, { to: googleLangCode });
    
//     // Split the result back
//     const translations = translatedCombined.split(separator);
    
//     // Ensure we have the same number of translations as inputs
//     if (translations.length !== texts.length) {
//       console.warn('Translation count mismatch, falling back to originals');
//       return res.json({ translations: texts });
//     }
    
//     console.log(`✅ Batch translation successful`);
//     res.json({ translations });
    
//   } catch (error) {
//     console.error('Batch translation error:', error);
//     // Return original texts if translation fails
//     res.json({ translations: texts });
//   }
// });

// Optimized batch translation endpoint
// router.post('/translate-batch', async (req, res) => {
//   const { texts, targetLanguage } = req.body;
  
//   try {
//     // Skip translation if target is English
//     if (targetLanguage === 'en') {
//       return res.json({ translations: texts });
//     }
    
//     // Map language codes
//     const languageMap = {
//       'en': 'en',
//       'zh': 'zh-cn',
//       'ms': 'ms',
//       'ta': 'ta'
//     };
    
//     const googleLangCode = languageMap[targetLanguage] || targetLanguage;
    
//     console.log(`🌐 Batch translating ${texts.length} texts to: ${targetLanguage}`);
    
//     // Join all texts with a separator for batch translation
//     const separator = ' ||| ';
//     const combinedText = texts.join(separator);
    
//     // Single API call for all texts
//     const translatedCombined = await translate(combinedText, { to: googleLangCode });
    
//     // Split the result back
//     const translations = translatedCombined.split(separator);
    
//     // Ensure we have the same number of translations as inputs
//     if (translations.length !== texts.length) {
//       console.warn('Translation count mismatch, falling back to originals');
//       return res.json({ translations: texts });
//     }
    
//     console.log(`✅ Batch translation successful`);
//     res.json({ translations });
    
//   } catch (error) {
//     console.error('Batch translation error:', error);
//     // Return original texts if translation fails
//     res.json({ translations: texts });
//   }
// });

// // Keep the single translation route for backwards compatibility
// router.post('/translate', async (req, res) => {
//   const { text, targetLanguage } = req.body;
  
//   try {
//     if (targetLanguage === 'en' || !text || text.trim() === '') {
//       return res.json({ translatedText: text });
//     }
    
//     const languageMap = {
//       'en': 'en',
//       'zh': 'zh-cn',
//       'ms': 'ms',
//       'ta': 'ta'
//     };
    
//     const googleLangCode = languageMap[targetLanguage] || targetLanguage;
//     const translatedText = await translate(text, { to: googleLangCode });
    
//     res.json({ translatedText });
    
//   } catch (error) {
//     console.error('Translation error:', error);
//     res.json({ translatedText: text });
//   }
// });

// Smooth batch translation endpoint
router.post('/translate-batch', async (req, res) => {
  const { texts, targetLanguage } = req.body;
  
  try {
    // Skip translation if target is English
    if (targetLanguage === 'en') {
      return res.json({ translations: texts });
    }
    
    // Map language codes
    const languageMap = {
      'en': 'en',
      'zh': 'zh-cn',
      'ms': 'ms',
      'ta': 'ta'
    };
    
    const googleLangCode = languageMap[targetLanguage] || targetLanguage;
    
    console.log(`🌐 Batch translating ${texts.length} texts to: ${targetLanguage}`);
    
    // Filter out empty texts and store mapping
    const textMapping = [];
    const nonEmptyTexts = [];
    
    texts.forEach((text, index) => {
      if (text && text.trim()) {
        textMapping.push({ originalIndex: index, textIndex: nonEmptyTexts.length });
        nonEmptyTexts.push(text.trim());
      } else {
        textMapping.push({ originalIndex: index, textIndex: -1, isEmpty: true });
      }
    });
    
    if (nonEmptyTexts.length === 0) {
      return res.json({ translations: texts });
    }
    
    // Always use individual translations for maximum reliability
    // This avoids all separator/marker extraction issues
    console.log('📝 Using individual translations for maximum reliability');
    
    const translatedTexts = await Promise.all(
      nonEmptyTexts.map(async (text, index) => {
        try {
          // Add small delay between requests to avoid rate limiting
          if (index > 0) {
            await new Promise(resolve => setTimeout(resolve, 50));
          }
          
          const result = await translate(text, { to: googleLangCode });
          console.log(`✓ Translated ${index + 1}/${nonEmptyTexts.length}: "${text}" -> "${result}"`);
          return result;
        } catch (err) {
          console.error(`✗ Translation failed for "${text}":`, err);
          return text; // Return original if translation fails
        }
      })
    );
    
    // Reconstruct the full translations array
    const fullTranslations = new Array(texts.length);
    
    textMapping.forEach(({ originalIndex, textIndex, isEmpty }) => {
      if (isEmpty) {
        fullTranslations[originalIndex] = texts[originalIndex]; // Keep empty as is
      } else {
        fullTranslations[originalIndex] = translatedTexts[textIndex] || texts[originalIndex];
      }
    });
    
    console.log(`✅ All individual translations completed successfully`);
    res.json({ translations: fullTranslations });
    
  } catch (error) {
    console.error('Translation error:', error);
    // Return original texts if everything fails
    res.json({ translations: texts });
  }
});

// Keep the single translation route
router.post('/translate', async (req, res) => {
  const { text, targetLanguage } = req.body;
  
  try {
    if (targetLanguage === 'en' || !text || text.trim() === '') {
      return res.json({ translatedText: text });
    }
    
    const languageMap = {
      'en': 'en',
      'zh': 'zh-cn',
      'ms': 'ms',
      'ta': 'ta'
    };
    
    const googleLangCode = languageMap[targetLanguage] || targetLanguage;
    const translatedText = await translate(text, { to: googleLangCode });
    
    res.json({ translatedText });
    
  } catch (error) {
    console.error('Translation error:', error);
    res.json({ translatedText: text });
  }
});


module.exports = router;
