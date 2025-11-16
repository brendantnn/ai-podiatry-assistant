// const express = require("express");
// const cors = require("cors");
// const { OpenAI } = require("openai");
// const path = require("path");
// const router = express.Router();
// const { db, admin, bucket } = require("./firebase");
// const translate = require('translate-google');
// const translationCache = new Map();
// const CACHE_EXPIRY = 10 * 60 * 1000; // 10 minutes

// const Busboy = require("busboy");

// // Use real key in Cloud Functions (from secrets), but a dummy string during local deploy
// const openai = new OpenAI({
//   apiKey: process.env.OPENAI_API_KEY || "dummy-openai-key",
// });

// if (!process.env.OPENAI_API_KEY) {
//   console.warn("⚠️ OPENAI_API_KEY is not set. OpenAI calls will fail until the secret is configured in Cloud Functions.");
// }

// // key = fake session ID (for now, assume 1 user)
// const session = {};

// // === Test-case Accuracy Rules (minimal, deterministic) ===
// const WORDS = {
//   nailSurgery: [
//     "ingrown", "ingrown toenail", "paronychia", "granulation", "pincer nail",
//     "nail spike", "onychocryptosis", "nail wedge", "nail surgery", "partial avulsion"
//   ],
//   woundCare: [
//     "ulcer", "open wound", "non-healing", "discharge", "pus", "slough", "eschar",
//     "debride", "infection", "cellulitis", "maceration", "weeping", "exudate"
//   ],
//   highRisk: [
//     "diabetic", "diabetes", "neuropathy", "loss of sensation", "pvd", "ischemia",
//     "poor circulation", "charcot"
//   ],
//   msk: [
//     "plantar fasciitis", "fasciitis", "tendon", "tendinitis", "sprain",
//     "strain", "heel pain", "arch pain", "achilles", "metatarsalgia", "stress fracture"
//   ],
//   redFlags: [
//     "fever", "chills", "red streak", "streaking", "spreading redness", "black tissue",
//     "gangrene", "malodour", "odor", "foul smell", "warmth", "eschar", "boggy",
//     "can't feel", "cannot feel", "numb", "tingling", "loss of sensation", "recent trauma",
//     "post-op", "postoperative", "exposed bone"
//   ]
// };

// // simple contains-any
// const hit = (text, list) => {
//   if (!text) return false;
//   const t = text.toLowerCase();
//   return list.some(w => t.includes(w));
// };

// // Core fixer used by both TEXT and IMAGE flows.
// // Inputs come from your existing model result; returns adjusted label/urgency.
// function applyTriageRules({ category, urgency, summary, freeText, probs }) {
//   let cat = category;
//   let urg = Number(urgency) || 4;

//   // 1) Safety before all: red flags or any wound-care probability >= 0.30 => urgency 1
//   const redFlag = hit(freeText, WORDS.redFlags) || hit(summary, WORDS.redFlags);
//   if (redFlag || (probs && (probs["wound care"] || 0) >= 0.30)) urg = Math.min(urg, 1);

//   // 2) Diabetes / neuropathy / poor circulation => move to High-Risk unless already wound care + keep high urgency
//   const hiRiskCue = hit(freeText, WORDS.highRisk) || hit(summary, WORDS.highRisk);
//   if (hiRiskCue && cat !== "wound care") {
//     cat = "high risk footcare";
//     urg = Math.min(urg, 2);
//   }

//   // 3) Clear nail keywords => Nail Surgery (common false negative in tests)
//   if (hit(freeText, WORDS.nailSurgery) || hit(summary, WORDS.nailSurgery)) {
//     cat = "nail surgery";
//     urg = Math.min(urg, 2);
//   }

//   // 4) Clear wound terms => Wound Care (overrides MSK/high-risk mislabels)
//   if (hit(freeText, WORDS.woundCare) || hit(summary, WORDS.woundCare)) {
//     cat = "wound care";
//     urg = Math.min(urg, 1);
//   }

//   // 5) MSK cues to MSK if nothing urgent triggered (helps MSK↔️others confusion)
//   if (hit(freeText, WORDS.msk) || hit(summary, WORDS.msk)) {
//     if (urg > 2 && cat !== "wound care") cat = "MSK";
//   }

//   return { category: cat, urgency: urg };
// }


// // Translate helper function
// async function translateReply(text, lang) {
//   if (!text || lang === 'en') return text;

//   // Normalize language code
//   const normalizedLang = lang === 'zh' ? 'zh-CN' : lang;

//   try {
//     const translated = await translate(text, { to: normalizedLang });
//     return translated;
//   } catch (err) {
//     console.error("❌ Translation error:", err);
//     return text;
//   }
// }





// // ************************************************* PATIENT LOGIC **************************************************************************

// router.post("/chat", async (req, res) => {
//   console.log("/chat route");

//   const { message, patientId, language } = req.body;

//   const userId = patientId;
//   const messageText = message.toLowerCase(); // same result as before
//   const userLanguage = language || 'en'; // fallback to 'en' if not provided
//   console.log("🌐 Language for translation:", userLanguage);




//   // *************** STEP 1: CLASSIFY USER'S INTENT *******************
//   // Use OpenAI to classify user's intent - appointment, triage, or other into a cosntant variable
//   const intentResponse = await openai.chat.completions.create({ // this returns an array ".choices" with the possible replies
//     model: "gpt-3.5-turbo",
//     messages: [
//       {
//         role: "system",
//         content: `You are an intent classifier for a podiatry chatbot.

// The user may be asking about:
// 1. "appointment" → checking existing appointments or viewing upcoming schedules (e.g. "When is my next visit?", "Do I have anything booked?")
// 2. "triage" → describing symptoms, foot concerns, or trying to book a new appointment (e.g. "My heel hurts", "I want to book an appointment", "Can I see a podiatrist?")
// 3. "other" → small talk or questions unrelated to podiatry

// Just return one word: "appointment", "triage", or "other".`
//       },
//       {
//         role: "user",
//         content: messageText
//       }
//     ]
//   });
//   // Gets response from the array returned by GPT - "appointment", "triage", "other"
//   const intent = intentResponse.choices[0].message.content.trim().toLowerCase();
//   console.log("🧠 Detected intent:", intent);

//   // Create session object that stores conversation state, symptom message, appointment slot info
//   session[userId] = session[userId] || {
//     state: "idle", // state includes idle, triage, awaiting_confirmation
//     triageStage: null,
//     messages: [], //convo history
//     pendingSlot: null,
//     pendingSlotData: null
//   };

//   // Store session to s for easy access
//   const s = session[userId];



//   console.log("🆕 Incoming message:", message);
//   console.log("📦 Session state at start:", s);

//   try {
//     // *************** STEP 2: TRIAGE INTENT *******************

//     // ✅ Handle the infection confirmation follow-up from the image flow
//     if (s.state === "confirm_infection_check") {
//       const answer = (message || "").toLowerCase();

//       // If the patient says YES → they confirm NO infection signs → proceed with non–wound care plan
//       if (answer.includes("yes")) {
//         const { category, diagnosis, urgencyLevel, summary, display, language } = s.proposed || {};
//         s.category = category || s.category;
//         s.diagnosis = diagnosis || s.diagnosis;
//         s.urgencyLevel = urgencyLevel || s.urgencyLevel || 4;
//         s.summary = summary || s.summary;
//         s.cleanedDisplay = display || s.cleanedDisplay;

//         s.state = "idle";
//         s.triageStage = null;
//         delete s.proposed;

//         // ===== Reuse your existing availability logic (same as after text classification) =====
//         // const now = new Date();
//         // let minDate = new Date();
//         const now = new Date();
//         now.setHours(0, 0, 0, 0);  // Set to start of today
//         let minDate = new Date();
//         let maxDate = new Date();
//         const urgencyLevelFinal = s.urgencyLevel;
//         let cleanedDisplay = s.cleanedDisplay;
//         const lang = language || userLanguage;

//         const existingSnap = await db.collection("Appointments")
//           .where("patientId", "==", userId)
//           .where("status", "==", "scheduled")
//           .where("scheduledDate", ">=", now)
//           .orderBy("scheduledDate")
//           .get();

//         if (!existingSnap.empty) {
//           const existingAppt = existingSnap.docs[0].data();
//           const existingUrgency = existingAppt?.urgencyLevel ?? 4;

//           if (existingSnap.size > 1) {
//             cleanedDisplay = `⚠️ You have ${existingSnap.size} upcoming appointments.<br>` +
//               `Please ensure this new issue is necessary to book.<br><br>` + cleanedDisplay;
//           }

//           if (urgencyLevelFinal >= existingUrgency) {
//             const nextHalfHour = new Date(existingAppt.scheduledDate.toDate().getTime() + 30 * 60 * 1000);

//             const followUpSnap = await db.collection("Availability")
//               .where("status", "==", "available")
//               .where("availableDate", "==", admin.firestore.Timestamp.fromDate(nextHalfHour))
//               .where("podId", "==", existingAppt.podId)
//               .limit(1)
//               .get();

//             if (!followUpSnap.empty) {
//               const slotDoc = followUpSnap.docs[0];
//               const slotData = slotDoc.data();
//               const formattedDate = new Date(slotData.availableDate.toDate()).toLocaleString("en-SG", {
//                 weekday: "long", year: "numeric", month: "long", day: "numeric",
//                 hour: "2-digit", minute: "2-digit", hour12: true, timeZone: "Asia/Singapore"
//               });

//               s.state = "awaiting_confirmation";
//               s.pendingSlot = slotDoc;
//               s.pendingSlotData = slotData;

//               return res.json({
//                 reply: await translateReply(
//                   `${cleanedDisplay}<br><br>📌 You already have an appointment scheduled. I found a follow-up slot right after it on <b>${formattedDate}</b> with podiatrist <b>${slotData.podId}</b>.<br>Would you like to book this additional slot?`,
//                   lang
//                 )
//               });
//             }

//             minDate = new Date(existingAppt.scheduledDate.toDate());
//           }
//         }

//         if (urgencyLevelFinal === 1) {
//           minDate.setDate(now.getDate());
//           maxDate.setDate(now.getDate() + 2);
//         } else if (urgencyLevelFinal === 2) {
//           minDate.setDate(now.getDate() + 1);
//           maxDate.setDate(now.getDate() + 7);
//         } else if (urgencyLevelFinal === 3) {
//           minDate.setDate(now.getDate() + 3);
//           maxDate.setDate(now.getDate() + 14);
//         } else {
//           minDate.setDate(now.getDate() + 5);
//           maxDate.setDate(now.getDate() + 21);
//         }

//         const slotQuery = await db.collection("Availability")
//           .where("status", "==", "available")
//           .where("availableDate", ">=", minDate)
//           .where("availableDate", "<=", maxDate)
//           .orderBy("availableDate")
//           .limit(1)
//           .get();

//         if (slotQuery.empty) {
//           s.state = "idle";
//           return res.json({
//             reply: await translateReply(`${cleanedDisplay}\n\n⚠️ Sorry no appointments slots are found, please contact us.`, lang)
//           });
//         }

//         const slotDoc = slotQuery.docs[0];
//         const slotData = slotDoc.data();
//         const formattedDate = new Date(
//           slotData.availableDate.toDate ? slotData.availableDate.toDate() : slotData.availableDate
//         ).toLocaleString("en-SG", {
//           weekday: "long", year: "numeric", month: "long", day: "numeric",
//           hour: "2-digit", minute: "2-digit", hour12: true, timeZone: "Asia/Singapore"
//         });

//         s.state = "awaiting_confirmation";
//         s.pendingSlot = slotDoc;
//         s.pendingSlotData = slotData;
//         s.cleanedDisplay = cleanedDisplay;

//         return res.json({
//           reply: await translateReply(
//             `${cleanedDisplay.trim()}<br><br>📅 I found a slot on <b>${formattedDate}</b> with podiatrist <b>${slotData.podId}</b>. Would you like to book this appointment?`,
//             lang
//           )
//         });
//       }

//       // If the patient says NO (i.e., they DO have infection/wound signs) → upgrade to wound care level 1
//       if (answer.includes("no")) {
//         s.state = "idle";
//         s.triageStage = null;
//         s.category = "wound care";
//         s.diagnosis = s.diagnosis || "Possible wound infection";
//         s.urgencyLevel = 1;
//         s.summary = s.summary ?? s.proposed?.summary ?? "No summary available.";


//         let cleanedDisplay =
//           `⚠️ Since you may have symptoms of a wound or infection, I’ll treat this as urgent wound care.<br>` +
//           `You need to see a podiatrist urgently. Let me find the soonest available slot.`;

//         const lang = s.proposed?.language || userLanguage;
//         delete s.proposed;

//         // Urgent booking window
//         const now = new Date();
//         now.setHours(0, 0, 0, 0); 
//         let minDate = new Date();
//         let maxDate = new Date();
//         minDate.setDate(now.getDate());
//         maxDate.setDate(now.getDate() + 2);
        

//         const existingSnap = await db.collection("Appointments")
//           .where("patientId", "==", userId)
//           .where("status", "==", "scheduled")
//           .where("scheduledDate", ">=", now)
//           .orderBy("scheduledDate")
//           .get();

//         if (!existingSnap.empty && existingSnap.size > 1) {
//           cleanedDisplay = `⚠️ You have ${existingSnap.size} upcoming appointments.<br>` +
//             `Please ensure this new issue is necessary to book.<br><br>` + cleanedDisplay;
//         }

//         const slotQuery = await db.collection("Availability")
//           .where("status", "==", "available")
//           .where("availableDate", ">=", minDate)
//           .where("availableDate", "<=", maxDate)
//           .orderBy("availableDate")
//           .limit(1)
//           .get();

//         if (slotQuery.empty) {
//           s.state = "idle";
//           return res.json({
//             reply: await translateReply(`${cleanedDisplay}\n\n⚠️ Sorry no appointments slots are found, please contact us.`, lang)
//           });
//         }

//         const slotDoc = slotQuery.docs[0];
//         const slotData = slotDoc.data();
//         const formattedDate = new Date(
//           slotData.availableDate.toDate ? slotData.availableDate.toDate() : slotData.availableDate
//         ).toLocaleString("en-SG", {
//           weekday: "long", year: "numeric", month: "long", day: "numeric",
//           hour: "2-digit", minute: "2-digit", hour12: true, timeZone: "Asia/Singapore"
//         });

//         s.state = "awaiting_confirmation";
//         s.pendingSlot = slotDoc;
//         s.pendingSlotData = slotData;
//         s.cleanedDisplay = cleanedDisplay;

//         return res.json({
//           reply: await translateReply(
//             `${cleanedDisplay.trim()}<br><br>📅 I found a slot on <b>${formattedDate}</b> with podiatrist <b>${slotData.podId}</b>. Would you like to book this appointment?`,
//             lang
//           )
//         });
//       }

//       // Not a clear yes/no
//       return res.json({ reply: await translateReply("❓ Please reply with 'yes' or 'no'.", userLanguage) });
//     }


//     // IF USER WANTS TRIAGE AND NO MESSAGE SENT YET, set state to triage and triageStage to initial_query
//     if (intent === "triage" && s.state === "idle") {
//       console.log("🧠 Detected intent=triage and state=idle, user want to triage and has sent no msgs yet");
//       s.state = "triage";
//       s.triageStage = "initial_query";
//       s.messages = []; // clear convo history

//       console.log("🟢 Updated session (triage start):", s);
//     }

//     // IF IN TRIAGE STATE AND IN INITIAL QUERY STAGE
//     if (s.state === "triage" && s.triageStage === "initial_query") {
//       console.log("Detected state=triage and triageStage=initial query, clarifying stage now");
//       s.messages.push({ role: "user", content: message });
//       console.log("📝 Current messages:", s.messages);

//       // Use openai to ask follow up questions, store reply into clarification
//       const clarification = await openai.chat.completions.create({
//         model: "gpt-3.5-turbo",
//         messages: [
//           {
//             role: "system",
//             content: `You are a warm, professional podiatry triage assistant. A patient has just shared their foot-related concern.

// Start by thanking them and letting them know you’ll ask a few short questions to understand the issue better and help arrange the right appointment.

// Then ask follow-up questions to detect:
// - Pus, discharge, bleeding
// - Wound, redness, swelling, warmth
// - Trauma, pain severity or location
// - Infection signs or diabetic complications

// Your goal is to identify which urgency category it fits into:

// The urgency categories are
// 1 (most urgent). wound care: presence of wound, signs of infection like redness, swelling , pain, pus, warm to touch, gangrene, infection, neuropathic / ischaemic / neuroischaemic wounds / ulcers
// 2. nail surgery: ingrown toenail, involuted toenail
// 3. high risk footcare: callus, corns, warts, pathological toenails
// 4 (least urgent). MSK: foot pain, foot wear, plantar fasciitis, posterior tibial tendon dysfunction, limb length discrepancy, hallux valgus / bunions, metatarsalgia

// You should ONLY categorize as “urgent” if symptoms clearly suggest infection, active wound, diabetic complications, trauma, or signs of rapid worsening.

// Arch pain or flat feet without alarming symptoms should NOT be urgent. These fall under MSK and are not considered emergencies.
            
//   Only ask **questions** at this stage. Do NOT attempt to diagnose or categorize yet. Your questions must help determine if the case could fall under wound care, nail surgery, high-risk footcare, or MSK.

// If the patient already answered clearly, you can still confirm: 
// > "Is there any visible swelling, wound, or pus?"

// Respond with 1–3 concise, specific follow-up questions.`
//           },
//           { role: "user", content: message }
//         ]
//       });

//       const followUp = clarification.choices[0].message.content;

//       // Set triageStage to clarification
//       s.triageStage = "clarification";

//       // Return translated follow up question
//       return res.json({ reply: await translateReply(followUp, userLanguage) });
//     }

//     // IF IN TRIAGE STATE AND CLARIFICATION TRIAGE STAGE
//     if (s.state === "triage" && s.triageStage === "clarification") {
//       console.log("🔍 Handling clarification response...");

//       s.messages.push({ role: "user", content: message }); // update user message to session message history
//       console.log("📝 Updated userMessage history:", s.messages);

//       // Combines all user messages into single string so openAI knows full context
//       const fullSymptomHistory = s.messages.map(m => m.content).join(" ");

//       // Send entire chat history to openAi for final prompt
//       const classification = await openai.chat.completions.create({
//         model: "gpt-3.5-turbo",
//         messages: [
//           {
//             role: "system",
//             content: `You are a podiatry triage assistant. Given the patient's conversation history, classify their condition into one of the following categories:

//       - wound care: presence of wound, signs of infection like redness, swelling , pain, pus, warm to touch, gangrene, infection, neuropathic / ischaemic / neuroischaemic wounds / ulcersy
//       - nail surgery: ingrown toenail, involuted toenail
//       - high risk footcare: callus, corns, warts, pathological toenails
//       - MSK: foot pain, foot wear, plantar fasciitis, posterior tibial tendon dysfunction, limb length discrepancy, hallux valgus / bunions, metatarsalgia

//    After assesing the category, determine the urgency level based on this : wound care(level 1:most urgent), nail surgery(level 2), high risk footcare(level 3), MSK (level 4: least urgent)
//    Also determine an Initial diagnosis: e.g. plantar fasciitis, ingrown toenail

//    Then generate a natural message for the patient that includes:
//     - A simple, empathetic explanation
//     - A sentence offering an appointment
//     - A sentence giving basic care advice while they wait

// 🧠 GPT response MUST follow this exact format with three dashes (---) on its own line between the internal data and the display message. Do NOT omit the separator.

// [INTERNAL DATA]
// Category: <MSK / wound care / nail surgery, high risk footcare>
// Diagnosis: <Short diagnosis, e.g., "possible plantar fasciitis" or "infected wound">
// Urgency level: <1 to 4>

// Summary: A brief but informative clinical-style description for the podiatrist, Include:
// - What the patient said
// - Duration, severity, symptoms like pus/swelling
// - Your impression and how urgent it is

// ---

// [DISPLAY MESSAGE, SH]
// Write a message that starts with an appropriate sentence based on the urgency level and use <br> for line breaks:

// - If urgency level = 1 → "You need to see a podiatrist urgently."
// - If urgency level = 2 → "You should see a podiatrist soon."
// - If urgency level = 3 → "This should be checked by a podiatrist."
// - If urgency level = 4 → "This is not urgent, but a podiatrist can help manage the issue."
// <br><br>

// While you wait for your appointment, here's what you should do:<br>
// • Tip 1<br>
// • Tip 2<br>
// • Tip 3<br>

// Do not show internal data to the patient.
//       `
//           },
//           { role: "user", content: fullSymptomHistory }
//         ]
//       });

//       const fullReply = classification.choices[0].message.content;
//       console.log("🧠 Full GPT reply:\n", fullReply);


//       // Split based on the last valid separator in case multiple '---' blocks exist
//       const splitReply = fullReply.trim().split(/-{3,}/);
//       const lastInternal = splitReply.length > 1 ? splitReply[splitReply.length - 2] : "";
//       const lastDisplay = splitReply[splitReply.length - 1] || "";

//       // Extract Summary field from internal block
//       const summaryMatch = lastInternal.match(/Summary:\s*([\s\S]*?)$/i); // capture multiline
//       let summary = summaryMatch?.[1]?.trim() || "No summary available.";

//       // Clean display message (remove tag and trim)
//       let cleanedDisplay = lastDisplay.replace(/\[DISPLAY MESSAGE.*?\]/i, "").trim();

//       // Extract internal info
//       const categoryMatch = lastInternal.match(/Category:\s*(.*)/i);
//       const diagnosisMatch = lastInternal.match(/Diagnosis:\s*(.*)/i);
//       const urgencyMatch = lastInternal.match(/Urgency level:\s*(\d)/i);

//       let category = categoryMatch?.[1]?.trim() || "Unknown";
//       let diagnosis = diagnosisMatch?.[1]?.trim() || "Unclear";
//       let urgencyLevel = parseInt(urgencyMatch?.[1]) || 4;

//       // Test-case correction layer (TEXT)
//       {
//         const fixed = applyTriageRules({
//           category,
//           urgency: urgencyLevel,
//           summary,
//           freeText: fullSymptomHistory, // the text you built just above
//           probs: undefined               // you don't parse probs here; it's fine to omit
//         });
//         category = fixed.category;
//         urgencyLevel = fixed.urgency;
//         summary = fixed.summary ?? summary;
//       }



//       // Store to session
//       s.urgencyLevel = urgencyLevel;
//       s.category = category;
//       s.diagnosis = diagnosis;
//       s.cleanedDisplay = cleanedDisplay;
//       s.summary = summary;

//       console.log("🧠 Full GPT reply:\n", fullReply);
//       console.log("✅ GPT classification reply:\n", cleanedDisplay);
//       console.log("📊 Parsed category:", category);
//       console.log("➡️ Diagnosis:", diagnosis);
//       console.log("⚠️  Parsed urgency:", urgencyLevel);
//       console.log("Summary:", summary);

//       // Set appointemnt urgency
//       // const now = new Date();
//       // let minDate = new Date();
//       // Set appointemnt urgency
//       const now = new Date();
//       now.setHours(0, 0, 0, 0);  // Set to start of today
//       let minDate = new Date();
//       let maxDate = new Date();

//       const existingSnap = await db.collection("Appointments")
//         .where("patientId", "==", userId)
//         .where("status", "==", "scheduled")
//         .where("scheduledDate", ">=", now)
//         .orderBy("scheduledDate")
//         .get();


//       let hasExistingAppt = !existingSnap.empty;
//       let existingAppt = null;



//       console.log(`📋 Checking existing appointments for user ${userId}`);
//       console.log(`📋 Found ${existingSnap.size} existing appointment(s)`);

//       // IF THERE ARE EXISTING APPOINTMENTS
//       if (hasExistingAppt) {
//         existingAppt = existingSnap.docs[0].data();
//         const existingUrgency = existingAppt?.urgencyLevel ?? 4;

//         // IF THERE ARE 2 OR MORE EXISTING APPOINTMENTS
//         if (existingSnap.size > 1) {
//           console.log("⚠️ Patient has multiple appointments. Adding warning to chatbot reply.");
//           cleanedDisplay = `⚠️ You have ${existingSnap.size} upcoming appointments.<br>` +
//             `Please ensure this new issue is necessary to book.<br><br>` +
//             cleanedDisplay;
//         }

//         console.log(`📊 Existing urgency: ${existingUrgency}, New urgency: ${urgencyLevel}`);

//         // IF NEW ISSUE IS NOT MORE URENT, BOOK APPOINTMENT RIGHT AFTER EXISTING ONE
//         if (urgencyLevel >= existingUrgency) {
//           console.log("🔁 New issue is not more urgent. Attempting to book 30 minutes after existing appointment.");

//           const nextHalfHour = new Date(existingAppt.scheduledDate.toDate().getTime() + 30 * 60 * 1000);
//           console.log(`🔎 Looking for slot at: ${nextHalfHour.toLocaleString("en-SG")}`);


//           // Query for available slot 30mins after existing slot
//           const followUpSnap = await db.collection("Availability")
//             .where("status", "==", "available")
//             .where("availableDate", "==", admin.firestore.Timestamp.fromDate(nextHalfHour))
//             .where("podId", "==", existingAppt.podId)
//             .limit(1)
//             .get();

//           // If there is an available slot 30 mins after existing slot
//           if (!followUpSnap.empty) {
//             const slotDoc = followUpSnap.docs[0]; // retrieve the slot
//             const slotData = slotDoc.data(); // extract podId and date into slotData

//             // Convert firestone's timestamp into a readable string
//             const formattedDate = new Date(slotData.availableDate.toDate()).toLocaleString("en-SG", {
//               weekday: "long",
//               year: "numeric",
//               month: "long",
//               day: "numeric",
//               hour: "2-digit",
//               minute: "2-digit",
//               hour12: true,
//               timeZone: "Asia/Singapore"
//             });

//             // Store new slot into session
//             s.state = "awaiting_confirmation";
//             s.pendingSlot = slotDoc;
//             s.pendingSlotData = slotData;

//             return res.json({
//               reply: await translateReply(`${cleanedDisplay}<br><br>📌 You already have an appointment scheduled. I found a follow-up slot right after it on <b>${formattedDate}</b> with podiatrist <b>${slotData.podId}</b>.<br>Would you like to book this additional slot?`, userLanguage)
//             });
//           }

//           // No follow-up slot → set minDate to after current appointment
//           const existingDate = existingAppt.scheduledDate.toDate();
//           minDate = new Date(existingDate);
//         } else {
//           // New issue is more urgent → allow earlier booking
//           console.log("✅ More urgent issue, allow earlier slots.");
//         }
//       }

//       // IF BOOK SLOT BASED ON NEW APPOINTMENT
//       console.log(`🕒 Setting min/max booking range based on urgency level ${urgencyLevel}`);


//       //Level 1: Book immediately, Level 2: Book starting tomorrow, Level 3: Book from 3 days later,Level 4: Book from 5 days later

//       // if (urgencyLevel === 1) {
//       //   // Wound care – immediate
//       //   minDate.setDate(now.getDate());       // today
//       //   maxDate.setDate(now.getDate() + 2);   // up to 2 days
//       // } 
//       if (urgencyLevel === 1) {
//         // Wound care – immediate
//         const sgTime = new Date().toLocaleString('en-US', { timeZone: 'Asia/Singapore' });
        //const currentHour = new Date(sgTime).getHours();
        
//         // If it's after 4 PM (last slot at 5pm needs 1hr buffer) or before 8 AM
//         if (currentHour >= 16 || currentHour < 8) {
//           // Too late for today, start from tomorrow 8 AM
//           minDate.setDate(now.getDate() + 1);
//           minDate.setHours(8, 0, 0, 0);  // Tomorrow at 8 AM
//           maxDate.setDate(now.getDate() + 2);
//         } else {
//           // Still within business hours - search from now + 1 hour
//           minDate = new Date();
//           minDate.setHours(minDate.getHours() + 1);  // At least 1 hour from now
//           maxDate.setDate(now.getDate() + 2);
//         }
//       }
//       else if (urgencyLevel === 2) {
//         // Nail surgery
//         minDate.setDate(now.getDate() + 1);   // earliest tomorrow
//         maxDate.setDate(now.getDate() + 7);   // up to 1 week
//       } else if (urgencyLevel === 3) {
//         // High risk footcare
//         minDate.setDate(now.getDate() + 3);   // not before 3 days
//         maxDate.setDate(now.getDate() + 14);  // up to 2 weeks
//       } else if (urgencyLevel === 4) {
//         // MSK
//         minDate.setDate(now.getDate() + 5);   // not before 5 days
//         maxDate.setDate(now.getDate() + 21);  // up to 3 weeks
//       }


//       console.log("✅ GPT classification reply:\n", cleanedDisplay);
//       console.log("📊 Parsed category:", category);
//       console.log("⚠️  Parsed urgency:", urgencyLevel);

//       try {
//         const slotQuery = await db.collection("Availability")
//           .where("status", "==", "available")
//           .where("availableDate", ">=", minDate)
//           .where("availableDate", "<=", maxDate)
//           .orderBy("availableDate")
//           .limit(1)
//           .get();

//         if (slotQuery.empty) {
//           s.state = "idle";
//           s.triageStage = null;
//           return res.json({ reply: await translateReply(`${cleanedDisplay}\n\n⚠️ Sorry no appointments slots are found, please contact us.`, userLanguage) });

//         }

//         const slotDoc = slotQuery.docs[0];
//         const slotData = slotDoc.data();

//         const formattedDate = new Date(slotData.availableDate.toDate ? slotData.availableDate.toDate() : slotData.availableDate)
//           .toLocaleString("en-SG", {
//             weekday: "long",
//             year: "numeric",
//             month: "long",
//             day: "numeric",
//             hour: "2-digit",
//             minute: "2-digit",
//             hour12: true,
//             timeZone: "Asia/Singapore"
//           });

//         s.state = "awaiting_confirmation";
//         s.triageStage = null;
//         s.pendingSlot = slotDoc;
//         s.pendingSlotData = slotData;
//         s.cleanedDisplay = cleanedDisplay;
//         const responseMessage = `${cleanedDisplay.trim()}<br><br>📅 I found a slot on <b>${formattedDate}</b> with podiatrist <b>${slotData.podId}</b>. Would you like to book this appointment?`;

//         return res.json({ reply: await translateReply(responseMessage, userLanguage) });


//       } catch (err) {
//         console.error("❌ Error finding available slot:", err);
//         s.state = "idle";
//         s.triageStage = null;
//         return res.json({ reply: `${cleanedDisplay}\n\n⚠️ An error occurred while checking availability.` });
//       }
//     }

//     // Step 3: User confirms appointment
//     if (s.state === "awaiting_confirmation") {
//       const answer = message.toLowerCase();

//       if (answer.includes("yes")) {
//         const slotDoc = s.pendingSlot;
//         const slotData = s.pendingSlotData;

//         // Count current scheduled appointments
//         const existingAppts = await db.collection("Appointments")
//           .where("patientId", "==", userId)
//           .where("status", "==", "scheduled")
//           .get();

//         const summaryToSave = (s.summary ?? s.proposed?.summary ?? "No summary available.");
//         const categoryToSave = (s.category ?? s.proposed?.category ?? "Unknown");
//         const diagnosisToSave = (s.diagnosis ?? s.proposed?.diagnosis ?? "Unclear");
//         const urgencyToSave = (typeof s.urgencyLevel === "number" ? s.urgencyLevel
//           : (s.proposed?.urgencyLevel ?? 4));

//         const appointmentData = {
//           patientId: userId,
//           podId: slotData.podId,
//           scheduledDate: slotData.availableDate,
//           status: "scheduled",
//           urgencyLevel: urgencyToSave,
//           category: categoryToSave,
//           initialDiagnosis: diagnosisToSave,
//           summary: summaryToSave,
//           triageDateTime: admin.firestore.Timestamp.now(),
//           imageUrl: s.imageUrl || null,        // ← ADD THIS
//           imageCaption: null,        // ← ADD THIS
//         };


//         // If user has 2 or more appointments, mark this as highlighted
//         if (existingAppts.size >= 2) {
//           appointmentData.highlighted = true;
//           console.log("🌟 Marking this appointment as highlighted because patient has 2 or more.");
//         }

//         await db.collection("Appointments").add(appointmentData);



//         await slotDoc.ref.update({ status: "booked" });

//         const formattedDate = new Date(slotData.availableDate.toDate())
//           .toLocaleString("en-SG", {
//             weekday: "long",
//             year: "numeric",
//             month: "long",
//             day: "numeric",
//             hour: "2-digit",
//             minute: "2-digit",
//             hour12: true,
//             timeZone: "Asia/Singapore"
//           });

//         s.state = "idle";
//         s.pendingSlot = null;
//         s.pendingSlotData = null;

//         return res.json({
//           reply: await translateReply(`✅ Appointment confirmed for <b>${formattedDate}</b> with podiatrist <b>${slotData.podId}</b>.`, userLanguage)
//         });

//       }

//       if (answer.includes("no")) {
//         s.state = "idle";
//         s.pendingSlot = null;
//         s.pendingSlotData = null;
//         return res.json({ reply: await translateReply("❌ No worries. Let me know if you'd like me to check another slot or start over.", userLanguage) });
//       }

//       return res.json({ reply: await translateReply("❓ Please reply with 'yes' or 'no' to confirm your appointment.", userLanguage) });
//     }

//     // ****** Appointment query patient *******
//     if (intent === "appointment") {
//       try {
//         const patientId = req.body.patientId;

//         // Detect if user wants "all" appointments
//         const wantsAllAppointments = /all appointments|more appointments|other appointments|future visits/.test(messageText);

//         // Get ALL scheduled appointments
//         const apptSnapshot = await db.collection("Appointments")
//           .where("patientId", "==", patientId)
//           .where("status", "==", "scheduled")
//           .orderBy("scheduledDate")
//           .get();

//         if (apptSnapshot.empty) {
//           return res.json({
//             reply: await translateReply("📅 You don't have any upcoming appointments at the moment.", userLanguage)
//           });

//         }

//         const allAppts = apptSnapshot.docs.map(doc => doc.data());

//         // Helper function
//         async function getPodiatristName(podId) {
//           if (!podId) return "Unknown";
//           const podQuery = await db.collection("Users").where("userId", "==", podId).limit(1).get();
//           if (podQuery.empty) return "Unknown";
//           const pod = podQuery.docs[0].data();
//           return `${pod.firstName || ""} ${pod.lastName || ""}`.trim();
//         }

//         if (allAppts.length === 1) {
//           const appt = allAppts[0];
//           const podiatristName = await getPodiatristName(appt.podId);
//           const formattedDate = appt.scheduledDate.toDate().toLocaleString(userLanguage, {
//             weekday: "long",
//             year: "numeric",
//             month: "long",
//             day: "numeric",
//             hour: "2-digit",
//             minute: "2-digit",
//             hour12: true,
//             timeZone: "Asia/Singapore"
//           });

//           const template = await translateReply("📅 You have an appointment on <b>{date}</b> - <b>{name}</b>.", userLanguage);
//           const reply = template.replace("{date}", formattedDate).replace("{name}", podiatristName);

//           return res.json({ reply });

//         } else {
//           const replies = await Promise.all(allAppts.map(async appt => {
//             const podiatristName = await getPodiatristName(appt.podId);
//             const formattedDate = appt.scheduledDate.toDate().toLocaleString(userLanguage, {
//               weekday: "long",
//               year: "numeric",
//               month: "long",
//               day: "numeric",
//               hour: "2-digit",
//               minute: "2-digit",
//               hour12: true,
//               timeZone: "Asia/Singapore"
//             });
//             return `📅 ${formattedDate} - ${podiatristName}`;
//           }));

//           const template = await translateReply(
//             "📋 Here are your upcoming appointments:<br><br>{list}<br><br>Let me know if you have a foot symptom and want to make another appointment!",
//             userLanguage
//           );
//           const reply = template.replace("{list}", replies.join("<br>"));

//           return res.json({ reply });


//         }


//       } catch (error) {
//         console.error("❌ Error fetching appointment:", error);
//         return res.json({
//           reply: "⚠️ An error occurred while retrieving your appointment details."
//         });
//       }
//     }

//     // Fallback
//     return res.json({
//       reply: await translateReply("I'm not sure what you mean. You can type 'triage' or 'appointment'.", userLanguage)
//     });


//   } catch (err) {
//     console.error("Chat error (patient):", err);
//     return res.status(500).json({
//       reply: await translateReply("⚠️ Something went wrong on the server.", userLanguage)
//     });

//   }
// });

// // Fetch patient appointment and
// router.post('/chat-patient-details', async (req, res) => {
//   const { patientId } = req.body;
//   console.log("🔍 Fetching patient info for:", patientId);

//   try {
//     // Get user info using where instead of doc()
//     const userSnapshot = await db.collection("Users")
//       .where("userId", "==", patientId)
//       .limit(1)
//       .get();

//     if (userSnapshot.empty) {
//       console.log("❌ No matching user found");
//       return res.json({
//         name: "Name not found",
//         appointment: null
//       });
//     }

//     const userData = userSnapshot.docs[0].data();
//     console.log("✅ Found user:", userData.firstName, userData.lastName);

//     // // Get appointment
//     // const apptSnapshot = await db.collection("Appointments")
//       // Get next upcoming appointment (future only)
//       // Get next upcoming appointment (from today onwards)
//       const now = new Date();
//       now.setHours(0, 0, 0, 0);  // Set to midnight (start of today)
//       const apptSnapshot = await db.collection("Appointments")
//       .where("patientId", "==", patientId)
//       .where("status", "==", "scheduled")
//       .where("scheduledDate", ">=", now)
//       .orderBy("scheduledDate")
//       .limit(1)
//       .get();

//     let appointment = null;
//     if (!apptSnapshot.empty) {
//       const appt = apptSnapshot.docs[0].data();

//       let podiatristName = "Unknown podiatrist";
//       if (appt.podId) {
//         const podQuery = await db.collection("Users")
//           .where("userId", "==", appt.podId)
//           .limit(1)
//           .get();

//         if (!podQuery.empty) {
//           const podData = podQuery.docs[0].data();
//           podiatristName = `${podData.firstName || ""} ${podData.lastName || ""}`.trim();
//         }
//       }

//       appointment = {
//         date: appt.scheduledDate.toDate(),
//         podiatrist: podiatristName
//       };
//     }

//     // Fetch all scheduled appointments 
//     // const allApptsSnap = await db.collection("Appointments")
//     //   .where("patientId", "==", patientId)
//     //   .where("status", "==", "scheduled")
//     //   .orderBy("scheduledDate")
//     //   .get();

//     const allApptsSnap = await db.collection("Appointments")
//       .where("patientId", "==", patientId)
//       .where("status", "==", "scheduled")
//       .where("scheduledDate", ">=", now)    // ← ADD THIS NEW LINE
//       .orderBy("scheduledDate")
//       .get();


//     // Step 1: Extract unique podiatrist IDs
//     const podIds = [...new Set(allApptsSnap.docs.map(doc => doc.data().podId).filter(Boolean))];

//     // Step 2: Fetch all podiatrists in a single query
//     let podiatristMap = {};
//     if (podIds.length > 0) {
//       const podSnapshot = await db.collection("Users")
//         .where("userId", "in", podIds)
//         .get();

//       podSnapshot.forEach(doc => {
//         const d = doc.data();
//         podiatristMap[d.userId] = `${d.firstName || ""} ${d.lastName || ""}`.trim();
//       });
//     }


//     const allAppointments = allApptsSnap.docs.map(doc => {
//       const appt = doc.data();
//       const podiatristName = podiatristMap[appt.podId] || "Unknown podiatrist";

//       return {
//         date: appt.scheduledDate.toDate(),
//         podiatrist: podiatristName,
//         type: appt.type || "Consultation"
//       };
//     });


//     res.json({
//       name: `${userData.firstName} ${userData.lastName}`.trim(),
//       appointment,
//       allAppointments,
//       language: userData.language || "en" // Include language preference
//     });

//   } catch (error) {
//     console.error("❌ Error in /chat-patient-details:", error);
//     res.status(500).json({ error: "Failed to fetch patient details" });
//   }
// });

// // Update patient language preference
// router.post('/update-language', async (req, res) => {
//   const { patientId, language } = req.body;
//   console.log("🇸🇬 Updating language preference for patient:", patientId, "to:", language);

//   // Validate Singapore languages
//   const validLanguages = ['en', 'zh', 'ms', 'ta'];
//   if (!validLanguages.includes(language)) {
//     console.log("❌ Invalid language code");
//     return res.json({ success: false, error: "Invalid language for Singapore" });
//   }

//   try {
//     // Find the user document by userId
//     const userSnapshot = await db.collection("Users")
//       .where("userId", "==", patientId)
//       .limit(1)
//       .get();

//     if (userSnapshot.empty) {
//       console.log("❌ No matching user found");
//       return res.json({ success: false, error: "User not found" });
//     }

//     // Update the language field
//     const userDoc = userSnapshot.docs[0];
//     await userDoc.ref.update({ language: language });

//     console.log("✅ Language preference updated successfully");
//     res.json({ success: true, language: language });

//   } catch (error) {
//     console.error("❌ Error updating language preference:", error);
//     res.status(500).json({ success: false, error: "Failed to update language preference" });
//   }
// });


// // // Smooth batch translation endpoint
// // router.post('/translate-batch', async (req, res) => {
// //   const { texts, targetLanguage } = req.body;

// //   try {
// //     // Skip translation if target is English
// //     if (targetLanguage === 'en') {
// //       return res.json({ translations: texts });
// //     }

// //     // Map language codes
// //     const languageMap = {
// //       'en': 'en',
// //       'zh': 'zh-cn',
// //       'ms': 'ms',
// //       'ta': 'ta'
// //     };

// //     const googleLangCode = languageMap[targetLanguage] || targetLanguage;

// //     console.log(`🌐 Batch translating ${texts.length} texts to: ${targetLanguage}`);

// //     // Filter out empty texts and store mapping
// //     const textMapping = [];
// //     const nonEmptyTexts = [];

// //     texts.forEach((text, index) => {
// //       if (text && text.trim()) {
// //         textMapping.push({ originalIndex: index, textIndex: nonEmptyTexts.length });
// //         nonEmptyTexts.push(text.trim());
// //       } else {
// //         textMapping.push({ originalIndex: index, textIndex: -1, isEmpty: true });
// //       }
// //     });

// //     if (nonEmptyTexts.length === 0) {
// //       return res.json({ translations: texts });
// //     }

// //     // Always use individual translations for maximum reliability
// //     // This avoids all separator/marker extraction issues
// //     console.log('📝 Using individual translations for maximum reliability');

// //     const translatedTexts = await Promise.all(
// //       nonEmptyTexts.map(async (text, index) => {
// //         try {
// //           // Add small delay between requests to avoid rate limiting
// //           if (index > 0) {
// //             await new Promise(resolve => setTimeout(resolve, 50));
// //           }

// //           const result = await translate(text, { to: googleLangCode });
// //           console.log(`✓ Translated ${index + 1}/${nonEmptyTexts.length}: "${text}" -> "${result}"`);
// //           return result;
// //         } catch (err) {
// //           console.error(`✗ Translation failed for "${text}":`, err);
// //           return text; // Return original if translation fails
// //         }
// //       })
// //     );

// //     // Reconstruct the full translations array
// //     const fullTranslations = new Array(texts.length);

// //     textMapping.forEach(({ originalIndex, textIndex, isEmpty }) => {
// //       if (isEmpty) {
// //         fullTranslations[originalIndex] = texts[originalIndex]; // Keep empty as is
// //       } else {
// //         fullTranslations[originalIndex] = translatedTexts[textIndex] || texts[originalIndex];
// //       }
// //     });

// //     console.log(`✅ All individual translations completed successfully`);
// //     res.json({ translations: fullTranslations });

// //   } catch (error) {
// //     console.error('Translation error:', error);
// //     // Return original texts if everything fails
// //     res.json({ translations: texts });
// //   }
// // });

// // router.post('/translate-batch', async (req, res) => {
// //   const { texts, targetLanguage } = req.body;

// //   try {
// //     if (targetLanguage === 'en') {
// //       return res.json({ translations: texts });
// //     }

// //     const languageMap = {
// //       'en': 'en',
// //       'zh': 'zh-cn', 
// //       'ms': 'ms',
// //       'ta': 'ta'
// //     };

// //     const googleLangCode = languageMap[targetLanguage] || targetLanguage;

// //     console.log(`🌍 CACHED batch translating ${texts.length} texts to: ${targetLanguage}`);

// //     const results = [];
// //     const toTranslate = [];
// //     const translateIndices = [];

// //     // Check cache first
// //     texts.forEach((text, index) => {
// //       if (!text || !text.trim()) {
// //         results[index] = text;
// //         return;
// //       }

// //       const cacheKey = `${text.trim()}_${googleLangCode}`;
// //       const cached = translationCache.get(cacheKey);
      
// //       if (cached && (Date.now() - cached.timestamp) < CACHE_EXPIRY) {
// //         results[index] = cached.translation;
// //         console.log(`📦 Cache hit: "${text.trim()}"`);
// //       } else {
// //         toTranslate.push(text.trim());
// //         translateIndices.push(index);
// //       }
// //     });

// //     // Translate uncached texts
// //     if (toTranslate.length > 0) {
// //       console.log(`🔄 Translating ${toTranslate.length} new texts`);
      
// //       const translations = await Promise.all(
// //         toTranslate.map(async (text) => {
// //           try {
// //             const translated = await translate(text, { to: googleLangCode });
            
// //             // Cache the result
// //             const cacheKey = `${text}_${googleLangCode}`;
// //             translationCache.set(cacheKey, {
// //               translation: translated,
// //               timestamp: Date.now()
// //             });
            
// //             return translated;
// //           } catch (err) {
// //             console.error(`Translation failed for "${text}":`, err.message);
// //             return text;
// //           }
// //         })
// //       );

// //       // Fill in translated results
// //       translateIndices.forEach((originalIndex, i) => {
// //         results[originalIndex] = translations[i];
// //       });
// //     }

// //     console.log(`⚡ CACHED translation completed (${toTranslate.length} new, ${texts.length - toTranslate.length} cached)`);
// //     res.json({ translations: results });

// //   } catch (error) {
// //     console.error('Translation error:', error);
// //     res.json({ translations: texts });
// //   }
// // });

// router.post('/translate-batch', async (req, res) => {
//   const { texts, targetLanguage } = req.body;

//   try {
//     if (targetLanguage === 'en') {
//       return res.json({ translations: texts });
//     }

//     const languageMap = {
//       'en': 'en',
//       'zh': 'zh-cn', 
//       'ms': 'ms',
//       'ta': 'ta'
//     };

//     const googleLangCode = languageMap[targetLanguage] || targetLanguage;

//     console.log(`🌍 TURBO batch translating ${texts.length} texts to: ${targetLanguage}`);

//     const results = [];
//     const toTranslate = [];
//     const translateIndices = [];

//     // Check cache first
//     texts.forEach((text, index) => {
//       if (!text || !text.trim()) {
//         results[index] = text;
//         return;
//       }

//       const cacheKey = `${text.trim()}_${googleLangCode}`;
//       const cached = translationCache.get(cacheKey);
      
//       if (cached && (Date.now() - cached.timestamp) < CACHE_EXPIRY) {
//         results[index] = cached.translation;
//       } else {
//         toTranslate.push(text.trim());
//         translateIndices.push(index);
//       }
//     });

//     // 🚀 TURBO: Translate all uncached texts in full parallel (no batching)
//     if (toTranslate.length > 0) {
//       console.log(`🚀 TURBO translating ${toTranslate.length} texts in full parallel`);
      
//       const translations = await Promise.all(
//         toTranslate.map(async (text, index) => {
//           try {
//             // Small staggered delay to avoid hitting rate limits
//             await new Promise(resolve => setTimeout(resolve, index * 10)); // 10ms stagger
            
//             const translated = await translate(text, { to: googleLangCode });
            
//             // Cache the result
//             const cacheKey = `${text}_${googleLangCode}`;
//             translationCache.set(cacheKey, {
//               translation: translated,
//               timestamp: Date.now()
//             });
            
//             return translated;
//           } catch (err) {
//             console.error(`Translation failed for "${text}":`, err.message);
//             return text;
//           }
//         })
//       );

//       // Fill in translated results
//       translateIndices.forEach((originalIndex, i) => {
//         results[originalIndex] = translations[i];
//       });
//     }

//     console.log(`⚡ TURBO translation completed (${toTranslate.length} new, ${texts.length - toTranslate.length} cached)`);
//     res.json({ translations: results });

//   } catch (error) {
//     console.error('Translation error:', error);
//     res.json({ translations: texts });
//   }
// });


// // Keep the single translation route
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


// // ---------------- IMAGE CHAT ROUTE ----------------------------------------------------------------------------------------------------------------------------------------------****
// router.post("/chat-image", (req, res) => {
//   console.log("🔥 Hit /patient/chat-image (Busboy version). Content-Type:", req.headers["content-type"]);

//   const contentType = req.headers["content-type"] || "";
//   if (!contentType.startsWith("multipart/form-data")) {
//     return res.status(400).json({ error: "Expected multipart/form-data" });
//   }

//   // Values we’ll fill from Busboy
//   let imageBuffer = null;
//   let imageMime = "";
//   let caption = "";
//   let patientId = "";
//   let language = "en";

//   const busboy = Busboy({ headers: req.headers });

//   // ---- FILE FIELD ----
//   busboy.on("file", (fieldname, file, info) => {
//   const { filename, encoding, mimeType } = info;
//   console.log("📷 Busboy got file field:", fieldname, filename, mimeType);

//   if (fieldname !== "image") {
//     // Ignore any other file fields
//     file.resume();
//     return;
//   }

//   imageMime = mimeType || "";
//   const chunks = [];

//   file.on("data", (data) => {
//     chunks.push(data);
//   });

//   file.on("end", () => {
//     imageBuffer = Buffer.concat(chunks);
//     console.log("✅ Finished reading image, size:", imageBuffer.length);
//   });
// });


//   // ---- NORMAL FIELDS ----
//   busboy.on("field", (fieldname, val) => {
//     console.log("✏️ Busboy field:", fieldname, "=", val);
//     if (fieldname === "caption") caption = val;
//     if (fieldname === "patientId") patientId = val;
//     if (fieldname === "language") language = val || "en";
//   });

//   busboy.on("error", (err) => {
//     console.error("❌ Busboy error in /chat-image:", err);
//     return res.status(500).json({ error: "Upload error" });
//   });

//   // ---- WHEN ALL PARTS ARE READ ----
//   busboy.on("finish", async () => {
//     console.log("🎯 Entered /chat-image AFTER busboy");

//     try {
//       const userLanguage = language || "en";
//       const userId = patientId;

//       if (!imageBuffer) {
//         console.log("🛑 [/chat-image] No file in request.");
//         return res.json({
//           reply: await translateReply("⚠️ No image received.", userLanguage),
//         });
//       }
//       if (!imageMime || !imageMime.startsWith("image/")) {
//         console.log("🛑 [/chat-image] Uploaded file is not an image. Mimetype:", imageMime);
//         return res.json({
//           reply: await translateReply("⚠️ Please upload a valid image file.", userLanguage),
//         });
//       }

//       // Session (unchanged)
//       session[userId] = session[userId] || {
//         state: "idle",
//         triageStage: null,
//         messages: [],
//         pendingSlot: null,
//         pendingSlotData: null,
//       };
//       const s = session[userId];

//       // Helpers (same as before)
//       const VLM_MODEL = "gpt-4o-mini";
//       const GATE_MODEL = "gpt-4o-mini";

//       function safeParseJSON(str) {
//         try {
//           return JSON.parse(str);
//         } catch {
//           return null;
//         }
//       }

//       function splitInternalAndDisplay(full) {
//         const raw = (full || "").trim();
//         if (!raw) return { internal: "", display: "" };
//         const parts = raw.split(/-{3,}/);
//         if (parts.length < 2) {
//           return {
//             internal: "",
//             display: raw.replace(/\[DISPLAY MESSAGE[^\]]*\]/i, "").trim(),
//           };
//         }
//         const internal = parts[parts.length - 2] || "";
//         const display = (parts[parts.length - 1] || "")
//           .replace(/\[DISPLAY MESSAGE[^\]]*\]/i, "")
//           .trim();
//         return { internal, display };
//       }

//       function grabLine(internal, re, fallback) {
//         const m = internal.match(re);
//         return m && m[1] ? m[1].trim() : fallback;
//       }

//       function normalizeCategory(catRaw) {
//         if (!catRaw) return "Unknown";
//         const c = catRaw.toLowerCase().trim();
//         if (c.startsWith("msk")) return "MSK";
//         if (c.includes("wound")) return "wound care";
//         if (c.includes("nail")) return "nail surgery";
//         if (c.includes("high") && c.includes("risk")) return "high risk footcare";
//         if (c.includes("footcare")) return "high risk footcare";
//         return catRaw.trim();
//       }

//       function normalizeUrgency(uRaw, cat) {
//         let u = parseInt(uRaw, 10);
//         if (!Number.isFinite(u)) {
//           const c = (cat || "").toLowerCase();
//           if (c.includes("wound")) u = 1;
//           else if (c.includes("nail")) u = 2;
//           else if (c.includes("high")) u = 3;
//           else if (c.includes("msk")) u = 4;
//           else u = 4;
//         }
//         if (u < 1) u = 1;
//         if (u > 4) u = 4;
//         return u;
//       }

//       // ===== Convert image to data URL (uses imageBuffer/imageMime now) =====
//       const b64 = imageBuffer.toString("base64");
//       const dataUrl = `data:${imageMime};base64,${b64}`;

//       // ================= 1) IMAGE GATE =================
//       const gateMsg = [
//         {
//           type: "text",
//           text: `You are an image gatekeeper. Decide if this image is a clear photo of a HUMAN FOOT (or feet) useful for podiatry triage.
// Return ONLY compact JSON like: {"valid": true, "reason": "short reason"}.

// valid=true ONLY IF:
// - A human foot is clearly visible (bare or clearly visible even if partly covered).
// - Image is not excessively blurry/overexposed/too dark.
// - Foot fills a reasonable portion of the frame.

// valid=false for: hands, faces, pets/animals, landscapes, documents/screenshots, x-rays, memes, drawings, shoes-only (no visible foot).

// Be strict. Output JSON only.`,
//         },
//         { type: "image_url", image_url: { url: dataUrl } },
//       ];

//       const gate = await openai.chat.completions.create({
//         model: GATE_MODEL,
//         temperature: 0,
//         messages: [
//           {
//             role: "system",
//             content:
//               "Return ONLY JSON with keys {valid:boolean, reason:string} and nothing else.",
//           },
//           { role: "user", content: gateMsg },
//         ],
//       });

//       const gateRaw = gate.choices?.[0]?.message?.content?.trim() || "";
//       const gateJSON = safeParseJSON(gateRaw) || {
//         valid: false,
//         reason: "unparseable_response",
//       };

//       if (gateJSON.valid !== true) {
//         const askForProperPhoto =
//           "⚠️ I can’t clearly see a foot in this photo. Please upload a clear, well-lit photo of the affected foot. " +
//           "Show the area of concern (wound/redness/nail) and avoid socks or heavy filters.";
//         return res.json({
//           reply: await translateReply(askForProperPhoto, userLanguage),
//         });
//       }

//       // ================= 2) TRIAGE PROMPT (vision) =================
//       const visionPrompt = `You are a podiatry triage assistant. Consider BOTH the patient's conversation history/caption (if any) and the uploaded foot image.

// Classify into exactly one:
// - wound care: presence of wound, signs of infection (redness, swelling, pain, pus, warmth), gangrene, neuropathic/ischaemic/neuroischaemic wounds/ulcers
// - nail surgery: ingrown toenail, involuted toenail
// - high risk footcare: callus, corns, warts, pathological toenails
// - MSK: foot pain, footwear issues, plantar fasciitis, posterior tibial tendon dysfunction, limb length discrepancy, hallux valgus/bunions, metatarsalgia

// If the photo shows no obvious pathology, state that plainly (e.g., “No visible wound or infection on the photo”), and use MSK (level 4) unless the caption suggests otherwise.

// IMPORTANT: Do NOT set Urgency=1 unless at least ONE of these is visibly/clearly present OR stated by the caption:
// open wound OR drainage/pus OR necrosis/black tissue OR spreading redness (lymphangitic streaks) OR malodour OR fever/chills. 
// General redness/swelling alone is NOT enough for Urgency 1.

// Assign urgency:
// - wound care → 1 (most urgent)
// - nail surgery → 2
// - high risk footcare → 3
// - MSK → 4 (least urgent)
// Also provide an Initial diagnosis.

// Return EXACTLY this format with three dashes (---) separating sections:

// [INTERNAL DATA]
// Category: <MSK / wound care / nail surgery / high risk footcare>
// Diagnosis: <Short diagnosis>
// Urgency level: <1 to 4>
// Summary: A brief clinical-style note for the podiatrist (what the patient said, duration/severity, infection signs, impression, urgency)
// Evidence:
//   open_wound: <true|false>
//   drainage_pus: <true|false>
//   necrosis_black_tissue: <true|false>
//   spreading_redness: <true|false>
//   general_redness_swelling: <true|false>
//   malodour: <true|false>
//   fever_chills: <true|false>
// RiskFactors:
//   diabetes_neuropathy: <true|false>
//   recent_trauma: <true|false>
// Confidence: <0.0-1.0>

// ---

// [DISPLAY MESSAGE, SH]
// Start with:
// - 1 → "You need to see a podiatrist urgently."
// - 2 → "You should see a podiatrist soon."
// - 3 → "This should be checked by a podiatrist."
// - 4 → "This is not urgent, but a podiatrist can help manage the issue."
// <br><br>
// While you wait for your appointment, here's what you should do:<br>
// • Tip 1<br>
// • Tip 2<br>
// • Tip 3<br>
// (Do not display internal data to the patient.)`; 

//       const triageMsgsBase = [
//         { role: "system", content: "You are a careful, empathetic podiatry triage assistant." },
//         { role: "user", content: [{ type: "text", text: visionPrompt }] },
//       ];

//       const userPayload = [];
//       if (caption && caption.trim())
//         userPayload.push({ type: "text", text: `Patient caption: ${caption}` });
//       userPayload.push({ type: "image_url", image_url: { url: dataUrl } });
//       triageMsgsBase.push({ role: "user", content: userPayload });

//       async function callVLMOnce() {
//         return openai.chat.completions.create({
//           model: VLM_MODEL,
//           temperature: 0.2,
//           messages: triageMsgsBase,
//         });
//       }

//       let completion,
//         attempt = 0;
//       while (attempt < 2) {
//         try {
//           completion = await callVLMOnce();
//           break;
//         } catch (e) {
//           attempt++;
//           if (attempt >= 2) throw e;
//         }
//       }

//       const full = completion.choices?.[0]?.message?.content || "";
//       const { internal, display: rawDisplay } = splitInternalAndDisplay(full);

//       // Parse internal (same as before)
//       const rawCategory = grabLine(internal, /Category:\s*([^\n\r]+)/i, "Unknown");
//       let category = normalizeCategory(rawCategory);
//       const diagnosis = grabLine(internal, /Diagnosis:\s*([^\n\r]+)/i, "Unclear");
//       let urgencyLevel = normalizeUrgency(
//         grabLine(internal, /Urgency level:\s*(\d)/i, ""),
//         category
//       );
//       let summary =
//         (internal.match(/Summary:\s*([\s\S]*?)$/i)?.[1] || "No summary available.").trim();
//       if (typeof summary !== "string" || !summary.trim()) {
//         summary = "No summary available.";
//       }

//       let display = rawDisplay.replace(/\[DISPLAY MESSAGE[^\]]*\]/i, "").trim();
//       if (!display) {
//         const firstLine =
//           urgencyLevel === 1
//             ? "You need to see a podiatrist urgently."
//             : urgencyLevel === 2
//             ? "You should see a podiatrist soon."
//             : urgencyLevel === 3
//             ? "This should be checked by a podiatrist."
//             : "This is not urgent, but a podiatrist can help manage the issue.";
//         display = `${firstLine}<br><br>While you wait for your appointment, here's what you should do:<br>• Keep the area clean and dry<br>• Avoid tight footwear<br>• Reduce load and monitor symptoms`;
//       }

//       // ================= 3) RULE SAFETY LAYER (unchanged) =================
//       {
//         const fixed = applyTriageRules({
//           category,
//           urgency: urgencyLevel,
//           summary,
//           freeText: caption,
//           probs: undefined,
//         });
//         category = fixed.category;
//         urgencyLevel = fixed.urgency;
//         if (typeof fixed.summary === "string" && fixed.summary) summary = fixed.summary;
//       }

//       function pickFlag(re, src) {
//         const m = src.match(re);
//         if (!m) return false;
//         const v = (m[1] || "").trim().toLowerCase();
//         return v === "true" || v === "yes";
//       }

//       const evidence = {
//         openWound: pickFlag(/open_wound:\s*(true|false)/i, internal),
//         drainagePus: pickFlag(/drainage_pus:\s*(true|false)/i, internal),
//         necrosis: pickFlag(/necrosis_black_tissue:\s*(true|false)/i, internal),
//         spreadingRedness: pickFlag(/spreading_redness:\s*(true|false)/i, internal),
//         generalRedness: pickFlag(/general_redness_swelling:\s*(true|false)/i, internal),
//         malodour: pickFlag(/malodour:\s*(true|false)/i, internal),
//         feverChills: pickFlag(/fever_chills:\s*(true|false)/i, internal),
//         diabetesNeuropathy: pickFlag(/diabetes_neuropathy:\s*(true|false)/i, internal),
//         recentTrauma: pickFlag(/recent_trauma:\s*(true|false)/i, internal),
//       };

//       const strongInfection =
//         evidence.openWound ||
//         evidence.drainagePus ||
//         evidence.necrosis ||
//         evidence.spreadingRedness ||
//         evidence.malodour ||
//         evidence.feverChills;

//       if (urgencyLevel === 1 && !strongInfection) {
//         console.log(
//           "🧯 Downgrading Urgency 1 (no strong infection evidence). Evidence:",
//           evidence
//         );

//         s.state = "confirm_infection_check";
//         s.proposed = {
//           category,
//           diagnosis,
//           urgencyLevel: 2,
//           summary,
//           display,
//           language: userLanguage,
//         };

//         const confirmMsg =
//           "❓ Can you confirm you do NOT have ANY open wounds, pus, signs of infections, fever/chills?";
//         return res.json({ reply: await translateReply(confirmMsg, userLanguage) });
//       }

//       console.log("🔎 Evidence flags:", evidence, "| strongInfection:", strongInfection);

//       if (typeof summary !== "string" || !summary.trim()) {
//         summary = "No summary available.";
//       }

//       s.urgencyLevel = urgencyLevel;
//       s.category = category;
//       s.diagnosis = diagnosis;
//       s.summary = summary;
//       s.cleanedDisplay = display;

//       console.log("🧠 Image triage result:");
//       console.log("Category:", category);
//       console.log("Diagnosis:", diagnosis);
//       console.log("Urgency level:", urgencyLevel);
//       console.log("Summary:", summary);
//       console.log("=========================");

//       // ================= UPLOAD IMAGE TO FIREBASE STORAGE =================
//       let imageUrl = null;
//       try {
//         const timestamp = Date.now();
//         const fileExtension = imageMime.split("/")[1];
//         const fileName = `patient_images/${userId}_${timestamp}.${fileExtension}`;
//         const file = bucket.file(fileName);

//         await file.save(imageBuffer, {
//           metadata: {
//             contentType: imageMime,
//             metadata: {
//               patientId: userId,
//               uploadedAt: new Date().toISOString(),
//               caption: caption || "",
//             },
//           },
//         });

//         await file.makePublic();
//         imageUrl = `https://storage.googleapis.com/${bucket.name}/${fileName}`;
//         s.imageUrl = imageUrl;
//         console.log("✅ Image uploaded:", imageUrl);
//       } catch (err) {
//         console.error("⚠️ Storage upload failed:", err);
//       }

//       // ================= 4) Confirm infection if NOT urgent (unchanged behavior) =================
//     if (urgencyLevel !== 1) {
//       s.state = "confirm_infection_check";
//       s.proposed = { category, diagnosis, urgencyLevel, summary, display, language: userLanguage };

//       const confirmMsg =
//         "❓ I don’t clearly see an open wound, pus, black tissue, red streaks, or fever/chills. " +
//         "Can you confirm you do NOT have ANY of these symptoms right now? (yes/no)";

//       return res.json({ reply: await translateReply(confirmMsg, userLanguage) });
//     }

//     // ================= 5) Availability & booking flow (IDENTICAL to yours) =================
//     {
//       // const now = new Date();
//       // let minDate = new Date(now);
//       const now = new Date();
//       now.setHours(0, 0, 0, 0);  // Set to start of today
//       let minDate = new Date(now);
//       let maxDate = new Date(now);

//       const existingSnap = await db.collection("Appointments")
//         .where("patientId", "==", userId)
//         .where("status", "==", "scheduled")
//         .where("scheduledDate", ">=", now)
//         .orderBy("scheduledDate")
//         .get();

//       if (!existingSnap.empty) {
//         const existingAppt = existingSnap.docs[0].data();
//         const existingUrgency = existingAppt?.urgencyLevel ?? 4;

//         if (existingSnap.size > 1) {
//           display = `⚠️ You have ${existingSnap.size} upcoming appointments.<br>` +
//             `Please ensure this new issue is necessary to book.<br><br>` +
//             display;
//         }

//         if (urgencyLevel >= existingUrgency) {
//           const nextHalfHour = new Date(existingAppt.scheduledDate.toDate().getTime() + 30 * 60 * 1000);

//           const followUpSnap = await db.collection("Availability")
//             .where("status", "==", "available")
//             .where("availableDate", "==", admin.firestore.Timestamp.fromDate(nextHalfHour))
//             .where("podId", "==", existingAppt.podId)
//             .limit(1)
//             .get();

//           if (!followUpSnap.empty) {
//             const slotDoc = followUpSnap.docs[0];
//             const slotData = slotDoc.data();

//             const formattedDate = new Date(slotData.availableDate.toDate()).toLocaleString("en-SG", {
//               weekday: "long", year: "numeric", month: "long", day: "numeric",
//               hour: "2-digit", minute: "2-digit", hour12: true, timeZone: "Asia/Singapore"
//             });

//             s.state = "awaiting_confirmation";
//             s.pendingSlot = slotDoc;
//             s.pendingSlotData = slotData;

//             return res.json({
//               reply: await translateReply(
//                 `${display}<br><br>📌 You already have an appointment scheduled. I found a follow-up slot right after it on <b>${formattedDate}</b> with podiatrist <b>${slotData.podId}</b>.<br>Would you like to book this additional slot?`,
//                 userLanguage
//               )
//             });
//           }

//           minDate = new Date(existingAppt.scheduledDate.toDate());
//         }
//       }

//       // Urgency → window (same mapping)
//       // if (urgencyLevel === 1) {
//       //   minDate.setDate(now.getDate());
//       //   maxDate.setDate(now.getDate() + 2);
//       // } 

//       if (urgencyLevel === 1) {
//         const sgTime = new Date().toLocaleString('en-US', { timeZone: 'Asia/Singapore' });
        //const currentHour = new Date(sgTime).getHours();
        
//         if (currentHour >= 16 || currentHour < 8) {
//           minDate.setDate(now.getDate() + 1);
//           minDate.setHours(8, 0, 0, 0);
//           maxDate.setDate(now.getDate() + 2);
//         } else {
//           minDate = new Date();
//           minDate.setHours(minDate.getHours() + 1);
//           maxDate.setDate(now.getDate() + 2);
//         }
//       }
//       else if (urgencyLevel === 2) {
//         minDate.setDate(now.getDate() + 1);
//         maxDate.setDate(now.getDate() + 7);
//       } else if (urgencyLevel === 3) {
//         minDate.setDate(now.getDate() + 3);
//         maxDate.setDate(now.getDate() + 14);
//       } else {
//         minDate.setDate(now.getDate() + 5);
//         maxDate.setDate(now.getDate() + 21);
//       }

//       const slotQuery = await db.collection("Availability")
//         .where("status", "==", "available")
//         .where("availableDate", ">=", minDate)
//         .where("availableDate", "<=", maxDate)
//         .orderBy("availableDate")
//         .limit(1)
//         .get();

//       if (slotQuery.empty) {
//         s.state = "idle";
//         s.triageStage = null;
//         return res.json({
//           reply: await translateReply(`${display}\n\n⚠️ Sorry no appointments slots are found, please contact us.`, userLanguage)
//         });
//       }

//       const slotDoc = slotQuery.docs[0];
//       const slotData = slotDoc.data();

//       const formattedDate = new Date(
//         slotData.availableDate.toDate ? slotData.availableDate.toDate() : slotData.availableDate
//       ).toLocaleString("en-SG", {
//         weekday: "long",
//         year: "numeric",
//         month: "long",
//         day: "numeric",
//         hour: "2-digit",
//         minute: "2-digit",
//         hour12: true,
//         timeZone: "Asia/Singapore"
//       });

//       s.state = "awaiting_confirmation";
//       s.triageStage = null;
//       s.pendingSlot = slotDoc;
//       s.pendingSlotData = slotData;
//       s.cleanedDisplay = display;

//       const responseMessage = `${display.trim()}<br><br>📅 I found a slot on <b>${formattedDate}</b> with podiatrist <b>${slotData.podId}</b>. Would you like to book this appointment?`;
//       return res.json({ reply: await translateReply(responseMessage, userLanguage) });
//     }

//     } catch (err) {
//       console.error("❌ /patient/chat-image error:", err);
//       return res.json({ reply: "⚠️ Image analysis failed on the server." });
//     }
//   });

//   // On Firebase Functions, body is in req.rawBody
//   if (req.rawBody) {
//     busboy.end(req.rawBody);
//   } else {
//     // Local dev fallback
//     req.pipe(busboy);
//   }
// });

// /*
// // ---------------- IMAGE CHAT ROUTE ----------------------------------------------------------------------------------------------------------------------------------------------****
// router.post("/chat-image", async (req, res) => {
//   console.log("🎯 Entered /chat-image AFTER multer");
//   console.log("📸 multer file:", req.file ? "YES" : "NO FILE");
//   console.log("📝 body:", req.body);
//         console.log("Entered chat image route!!!!!!!!!");
//   try {
//     const { patientId, language, caption = "" } = req.body;
//     const userLanguage = language || "en";
//     const userId = patientId;

//     if (!req.file) {
//       console.log("🛑 [/chat-image] No file in request.");
//       return res.json({ reply: await translateReply("⚠️ No image received.", userLanguage) });
//     }
//     if (!req.file.mimetype || !req.file.mimetype.startsWith("image/")) {
//       console.log("🛑 [/chat-image] Uploaded file is not an image. Mimetype:", req.file.mimetype);
//       return res.json({ reply: await translateReply("⚠️ Please upload a valid image file.", userLanguage) });
//     }

//     // Session (unchanged)
//     session[userId] = session[userId] || {
//       state: "idle",
//       triageStage: null,
//       messages: [],
//       pendingSlot: null,
//       pendingSlotData: null
//     };
//     const s = session[userId];

//     // Helpers (new small utilities)
//     const VLM_MODEL = "gpt-4o-mini";
//     const GATE_MODEL = "gpt-4o-mini";

//     function safeParseJSON(str) {
//       try { return JSON.parse(str); } catch { return null; }
//     }

//     function splitInternalAndDisplay(full) {
//       // handle none / one / many '---'
//       const raw = (full || "").trim();
//       if (!raw) return { internal: "", display: "" };
//       const parts = raw.split(/-{3,}/); // one or more dashes line
//       if (parts.length < 2) {
//         // no separator; treat all as display
//         return { internal: "", display: raw.replace(/\[DISPLAY MESSAGE[^\]]*\]/i, "").trim() };
//       }
//       // choose the last two blocks in case the model produced multiple
//       const internal = parts[parts.length - 2] || "";
//       const display = (parts[parts.length - 1] || "").replace(/\[DISPLAY MESSAGE[^\]]*\]/i, "").trim();
//       return { internal, display };
//     }

//     function grabLine(internal, re, fallback) {
//       const m = internal.match(re);
//       return (m && m[1] ? m[1].trim() : fallback);
//     }

//     function normalizeCategory(catRaw) {
//       if (!catRaw) return "Unknown";
//       const c = catRaw.toLowerCase().trim();
//       if (c.startsWith("msk")) return "MSK";
//       if (c.includes("wound")) return "wound care";
//       if (c.includes("nail")) return "nail surgery";
//       if (c.includes("high") && c.includes("risk")) return "high risk footcare";
//       if (c.includes("footcare")) return "high risk footcare";
//       return catRaw.trim(); // keep original if unknown
//     }

//     function normalizeUrgency(uRaw, cat) {
//       let u = parseInt(uRaw, 10);
//       if (!Number.isFinite(u)) {
//         // fallback from category
//         const c = (cat || "").toLowerCase();
//         if (c.includes("wound")) u = 1;
//         else if (c.includes("nail")) u = 2;
//         else if (c.includes("high")) u = 3;
//         else if (c.includes("msk")) u = 4;
//         else u = 4;
//       }
//       // clamp to 1..4
//       if (u < 1) u = 1;
//       if (u > 4) u = 4;
//       return u;
//     }

//     // Convert image → data URL (unchanged)
//     const b64 = req.file.buffer.toString("base64");
//     const dataUrl = `data:${req.file.mimetype};base64,${b64}`;

   

//     // ================= 1) IMAGE GATE (same purpose, slightly clearer prompt) =================
//     const gateMsg = [
//       {
//         type: "text", text:
//           `You are an image gatekeeper. Decide if this image is a clear photo of a HUMAN FOOT (or feet) useful for podiatry triage.
// Return ONLY compact JSON like: {"valid": true, "reason": "short reason"}.

// valid=true ONLY IF:
// - A human foot is clearly visible (bare or clearly visible even if partly covered).
// - Image is not excessively blurry/overexposed/too dark.
// - Foot fills a reasonable portion of the frame.

// valid=false for: hands, faces, pets/animals, landscapes, documents/screenshots, x-rays, memes, drawings, shoes-only (no visible foot).

// Be strict. Output JSON only.`
//       },
//       { type: "image_url", image_url: { url: dataUrl } }
//     ];

//     const gate = await openai.chat.completions.create({
//       model: GATE_MODEL,
//       temperature: 0,
//       messages: [
//         { role: "system", content: "Return ONLY JSON with keys {valid:boolean, reason:string} and nothing else." },
//         { role: "user", content: gateMsg }
//       ]
//     });

//     const gateRaw = gate.choices?.[0]?.message?.content?.trim() || "";
//     const gateJSON = safeParseJSON(gateRaw) || { valid: false, reason: "unparseable_response" };

//     if (gateJSON.valid !== true) {
//       const askForProperPhoto =
//         "⚠️ I can’t clearly see a foot in this photo. " +
//         "Please upload a clear, well-lit photo of the affected foot. " +
//         "Show the area of concern (wound/redness/nail) and avoid socks or heavy filters.";
//       return res.json({ reply: await translateReply(askForProperPhoto, userLanguage) });
//     }

//     // ================= 2) TRIAGE PROMPT (vision) with small retry =================
//     const visionPrompt =
//       `You are a podiatry triage assistant. Consider BOTH the patient's conversation history/caption (if any) and the uploaded foot image.

// Classify into exactly one:
// - wound care: presence of wound, signs of infection (redness, swelling, pain, pus, warmth), gangrene, neuropathic/ischaemic/neuroischaemic wounds/ulcers
// - nail surgery: ingrown toenail, involuted toenail
// - high risk footcare: callus, corns, warts, pathological toenails
// - MSK: foot pain, footwear issues, plantar fasciitis, posterior tibial tendon dysfunction, limb length discrepancy, hallux valgus/bunions, metatarsalgia

// If the photo shows no obvious pathology, state that plainly (e.g., “No visible wound or infection on the photo”), and use MSK (level 4) unless the caption suggests otherwise.

// IMPORTANT: Do NOT set Urgency=1 unless at least ONE of these is visibly/clearly present OR stated by the caption:
// open wound OR drainage/pus OR necrosis/black tissue OR spreading redness (lymphangitic streaks) OR malodour OR fever/chills. 
// General redness/swelling alone is NOT enough for Urgency 1.

// Assign urgency:
// - wound care → 1 (most urgent)
// - nail surgery → 2
// - high risk footcare → 3
// - MSK → 4 (least urgent)
// Also provide an Initial diagnosis.

// Return EXACTLY this format with three dashes (---) separating sections:

// [INTERNAL DATA]
// Category: <MSK / wound care / nail surgery / high risk footcare>
// Diagnosis: <Short diagnosis>
// Urgency level: <1 to 4>
// Summary: A brief clinical-style note for the podiatrist (what the patient said, duration/severity, infection signs, impression, urgency)
// Evidence:
//   open_wound: <true|false>
//   drainage_pus: <true|false>
//   necrosis_black_tissue: <true|false>
//   spreading_redness: <true|false>
//   general_redness_swelling: <true|false>
//   malodour: <true|false>
//   fever_chills: <true|false>
// RiskFactors:
//   diabetes_neuropathy: <true|false>
//   recent_trauma: <true|false>
// Confidence: <0.0-1.0>

// ---

// [DISPLAY MESSAGE, SH]
// Start with:
// - 1 → "You need to see a podiatrist urgently."
// - 2 → "You should see a podiatrist soon."
// - 3 → "This should be checked by a podiatrist."
// - 4 → "This is not urgent, but a podiatrist can help manage the issue."
// <br><br>
// While you wait for your appointment, here's what you should do:<br>
// • Tip 1<br>
// • Tip 2<br>
// • Tip 3<br>
// (Do not display internal data to the patient.)`;


//     const triageMsgsBase = [
//       { role: "system", content: "You are a careful, empathetic podiatry triage assistant." },
//       { role: "user", content: [{ type: "text", text: visionPrompt }] }
//     ];
//     const userPayload = [];
//     if (caption && caption.trim()) userPayload.push({ type: "text", text: `Patient caption: ${caption}` });
//     userPayload.push({ type: "image_url", image_url: { url: dataUrl } });
//     triageMsgsBase.push({ role: "user", content: userPayload });

//     async function callVLMOnce() {
//       return openai.chat.completions.create({
//         model: VLM_MODEL,
//         temperature: 0.2,
//         messages: triageMsgsBase
//       });
//     }
//     // tiny retry for transient issues
//     let completion, attempt = 0;
//     while (attempt < 2) {
//       try { completion = await callVLMOnce(); break; }
//       catch (e) { attempt++; if (attempt >= 2) throw e; }
//     }

//     const full = completion.choices?.[0]?.message?.content || "";
//     const { internal, display: rawDisplay } = splitInternalAndDisplay(full);

//     // Parse internal (more robust)
//     const rawCategory = grabLine(internal, /Category:\s*([^\n\r]+)/i, "Unknown");
//     let category = normalizeCategory(rawCategory);
//     const diagnosis = grabLine(internal, /Diagnosis:\s*([^\n\r]+)/i, "Unclear");
//     let urgencyLevel = normalizeUrgency(grabLine(internal, /Urgency level:\s*(\d)/i, ""), category);
//     let summary = (internal.match(/Summary:\s*([\s\S]*?)$/i)?.[1] || "No summary available.").trim();

//     // Make sure summary is never undefined or empty
//     if (typeof summary !== "string" || !summary.trim()) {
//       summary = "No summary available.";
//     }


//     // Clean display safely
//     let display = rawDisplay.replace(/\[DISPLAY MESSAGE[^\]]*\]/i, "").trim();
//     if (!display) {
//       // if model forgot the section, synthesize a minimal safe message
//       const firstLine =
//         urgencyLevel === 1 ? "You need to see a podiatrist urgently." :
//           urgencyLevel === 2 ? "You should see a podiatrist soon." :
//             urgencyLevel === 3 ? "This should be checked by a podiatrist." :
//               "This is not urgent, but a podiatrist can help manage the issue.";
//       display = `${firstLine}<br><br>While you wait for your appointment, here's what you should do:<br>• Keep the area clean and dry<br>• Avoid tight footwear<br>• Reduce load and monitor symptoms`;
//     }

//     // ================= 3) RULE SAFETY LAYER (same as yours) =================
//     {
//       const fixed = applyTriageRules({
//         category,
//         urgency: urgencyLevel,
//         summary,
//         freeText: caption,
//         probs: undefined
//       });
//       category = fixed.category;
//       urgencyLevel = fixed.urgency;
//       if (typeof fixed.summary === "string" && fixed.summary) summary = fixed.summary;
//     }

//     // --- Evidence flags parsing (NEW) ---
//     function pickFlag(re, src) {
//       const m = src.match(re);
//       if (!m) return false;
//       const v = (m[1] || "").trim().toLowerCase();
//       return v === "true" || v === "yes";
//     }

//     const evidence = {
//       openWound: pickFlag(/open_wound:\s*(true|false)/i, internal),
//       drainagePus: pickFlag(/drainage_pus:\s*(true|false)/i, internal),
//       necrosis: pickFlag(/necrosis_black_tissue:\s*(true|false)/i, internal),
//       spreadingRedness: pickFlag(/spreading_redness:\s*(true|false)/i, internal),
//       generalRedness: pickFlag(/general_redness_swelling:\s*(true|false)/i, internal),
//       malodour: pickFlag(/malodour:\s*(true|false)/i, internal),
//       feverChills: pickFlag(/fever_chills:\s*(true|false)/i, internal),
//       diabetesNeuropathy: pickFlag(/diabetes_neuropathy:\s*(true|false)/i, internal),
//       recentTrauma: pickFlag(/recent_trauma:\s*(true|false)/i, internal),
//     };

//     const strongInfection =
//       evidence.openWound ||
//       evidence.drainagePus ||
//       evidence.necrosis ||
//       evidence.spreadingRedness ||
//       evidence.malodour ||
//       evidence.feverChills;

//     // If the model set level 1 but we don't have strong infection evidence,
//     // don't auto-escalate. Ask the user to confirm like your non-urgent flow.
//     if (urgencyLevel === 1 && !strongInfection) {
//       console.log("🧯 Downgrading Urgency 1 (no strong infection evidence). Evidence:", evidence);

//       s.state = "confirm_infection_check";
//       // propose a cautious level 2 by default
//       s.proposed = { category, diagnosis, urgencyLevel: 2, summary, display, language: userLanguage };

//       const confirmMsg =
//         "❓ Can you confirm you do NOT have ANY open wounds, pus, signs of infections, fever/chills?";
//       return res.json({ reply: await translateReply(confirmMsg, userLanguage) });
//     }

//     // Debug: show what the model 'saw'
//     console.log("🔎 Evidence flags:", evidence, "| strongInfection:", strongInfection);


//     // Make sure the summary is valid before saving to session
//     if (typeof summary !== "string" || !summary.trim()) {
//       summary = "No summary available.";
//     }

//     s.urgencyLevel = urgencyLevel;
//     s.category = category;
//     s.diagnosis = diagnosis;
//     s.summary = summary;
//     s.cleanedDisplay = display;


//     // ===== DEBUG LOGGING =====
//     console.log("🧠 Image triage result:");
//     console.log("Category:", category);
//     console.log("Diagnosis:", diagnosis);
//     console.log("Urgency level:", urgencyLevel);
//     console.log("Summary:", summary);
//     console.log("=========================");

//      // ================= UPLOAD IMAGE TO FIREBASE STORAGE =================
//     let imageUrl = null;
//     try {
//       const timestamp = Date.now();
//       const fileExtension = req.file.mimetype.split('/')[1];
//       const fileName = `patient_images/${userId}_${timestamp}.${fileExtension}`;
//       const file = bucket.file(fileName);

//       await file.save(req.file.buffer, {
//         metadata: {
//           contentType: req.file.mimetype,
//           metadata: {
//             patientId: userId,
//             uploadedAt: new Date().toISOString(),
//             caption: caption || ''
//           }
//         }
//       });

//       await file.makePublic();
//       imageUrl = `https://storage.googleapis.com/${bucket.name}/${fileName}`;
//       s.imageUrl = imageUrl;
//       console.log("✅ Image uploaded:", imageUrl);
//     } catch (err) {
//       console.error("⚠️ Storage upload failed:", err);
//     }

//     // ================= 4) Confirm infection if NOT urgent (unchanged behavior) =================
//     if (urgencyLevel !== 1) {
//       s.state = "confirm_infection_check";
//       s.proposed = { category, diagnosis, urgencyLevel, summary, display, language: userLanguage };

//       const confirmMsg =
//         "❓ I don’t clearly see an open wound, pus, black tissue, red streaks, or fever/chills. " +
//         "Can you confirm you do NOT have ANY of these symptoms right now? (yes/no)";

//       return res.json({ reply: await translateReply(confirmMsg, userLanguage) });
//     }

//     // ================= 5) Availability & booking flow (IDENTICAL to yours) =================
//     {
//       const now = new Date();
//       let minDate = new Date(now);
//       let maxDate = new Date(now);

//       const existingSnap = await db.collection("Appointments")
//         .where("patientId", "==", userId)
//         .where("status", "==", "scheduled")
//         .orderBy("scheduledDate")
//         .get();

//       if (!existingSnap.empty) {
//         const existingAppt = existingSnap.docs[0].data();
//         const existingUrgency = existingAppt?.urgencyLevel ?? 4;

//         if (existingSnap.size > 1) {
//           display = `⚠️ You have ${existingSnap.size} upcoming appointments.<br>` +
//             `Please ensure this new issue is necessary to book.<br><br>` +
//             display;
//         }

//         if (urgencyLevel >= existingUrgency) {
//           const nextHalfHour = new Date(existingAppt.scheduledDate.toDate().getTime() + 30 * 60 * 1000);

//           const followUpSnap = await db.collection("Availability")
//             .where("status", "==", "available")
//             .where("availableDate", "==", admin.firestore.Timestamp.fromDate(nextHalfHour))
//             .where("podId", "==", existingAppt.podId)
//             .limit(1)
//             .get();

//           if (!followUpSnap.empty) {
//             const slotDoc = followUpSnap.docs[0];
//             const slotData = slotDoc.data();

//             const formattedDate = new Date(slotData.availableDate.toDate()).toLocaleString("en-SG", {
//               weekday: "long", year: "numeric", month: "long", day: "numeric",
//               hour: "2-digit", minute: "2-digit", hour12: true, timeZone: "Asia/Singapore"
//             });

//             s.state = "awaiting_confirmation";
//             s.pendingSlot = slotDoc;
//             s.pendingSlotData = slotData;

//             return res.json({
//               reply: await translateReply(
//                 `${display}<br><br>📌 You already have an appointment scheduled. I found a follow-up slot right after it on <b>${formattedDate}</b> with podiatrist <b>${slotData.podId}</b>.<br>Would you like to book this additional slot?`,
//                 userLanguage
//               )
//             });
//           }

//           minDate = new Date(existingAppt.scheduledDate.toDate());
//         }
//       }

//       // Urgency → window (same mapping)
//       if (urgencyLevel === 1) {
//         minDate.setDate(now.getDate());
//         maxDate.setDate(now.getDate() + 2);
//       } else if (urgencyLevel === 2) {
//         minDate.setDate(now.getDate() + 1);
//         maxDate.setDate(now.getDate() + 7);
//       } else if (urgencyLevel === 3) {
//         minDate.setDate(now.getDate() + 3);
//         maxDate.setDate(now.getDate() + 14);
//       } else {
//         minDate.setDate(now.getDate() + 5);
//         maxDate.setDate(now.getDate() + 21);
//       }

//       const slotQuery = await db.collection("Availability")
//         .where("status", "==", "available")
//         .where("availableDate", ">=", minDate)
//         .where("availableDate", "<=", maxDate)
//         .orderBy("availableDate")
//         .limit(1)
//         .get();

//       if (slotQuery.empty) {
//         s.state = "idle";
//         s.triageStage = null;
//         return res.json({
//           reply: await translateReply(`${display}\n\n⚠️ Sorry no appointments slots are found, please contact us.`, userLanguage)
//         });
//       }

//       const slotDoc = slotQuery.docs[0];
//       const slotData = slotDoc.data();

//       const formattedDate = new Date(
//         slotData.availableDate.toDate ? slotData.availableDate.toDate() : slotData.availableDate
//       ).toLocaleString("en-SG", {
//         weekday: "long",
//         year: "numeric",
//         month: "long",
//         day: "numeric",
//         hour: "2-digit",
//         minute: "2-digit",
//         hour12: true,
//         timeZone: "Asia/Singapore"
//       });

//       s.state = "awaiting_confirmation";
//       s.triageStage = null;
//       s.pendingSlot = slotDoc;
//       s.pendingSlotData = slotData;
//       s.cleanedDisplay = display;

//       const responseMessage = `${display.trim()}<br><br>📅 I found a slot on <b>${formattedDate}</b> with podiatrist <b>${slotData.podId}</b>. Would you like to book this appointment?`;
//       return res.json({ reply: await translateReply(responseMessage, userLanguage) });
//     }

//   } catch (err) {
//     console.error("❌ /patient/chat-image error:", err);
//     return res.json({ reply: "⚠️ Image analysis failed on the server." });
//   }
// });

// */


// router.post("/reset-session", (req, res) => {
//   const { patientId } = req.body;
//   delete session[patientId]; // Clear server memory for that user
//   res.json({ success: true });
// });




// module.exports = router;


const express = require("express");
const cors = require("cors");
const { OpenAI } = require("openai");
const path = require("path");
const router = express.Router();
const { db, admin, bucket } = require("./firebase");
const translate = require('translate-google');
const translationCache = new Map();
const CACHE_EXPIRY = 10 * 60 * 1000; // 10 minutes

const Busboy = require("busboy");

// Use real key in Cloud Functions (from secrets), but a dummy string during local deploy
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || "dummy-openai-key",
});

if (!process.env.OPENAI_API_KEY) {
  console.warn("⚠️ OPENAI_API_KEY is not set. OpenAI calls will fail until the secret is configured in Cloud Functions.");
}

// key = fake session ID (for now, assume 1 user)
const session = {};

// === Test-case Accuracy Rules (minimal, deterministic) ===
const WORDS = {
  nailSurgery: [
    "ingrown", "ingrown toenail", "paronychia", "granulation", "pincer nail",
    "nail spike", "onychocryptosis", "nail wedge", "nail surgery", "partial avulsion"
  ],
  woundCare: [
    "ulcer", "open wound", "non-healing", "discharge", "pus", "slough", "eschar",
    "debride", "infection", "cellulitis", "maceration", "weeping", "exudate"
  ],
  highRisk: [
    "diabetic", "diabetes", "neuropathy", "loss of sensation", "pvd", "ischemia",
    "poor circulation", "charcot"
  ],
  msk: [
    "plantar fasciitis", "fasciitis", "tendon", "tendinitis", "sprain",
    "strain", "heel pain", "arch pain", "achilles", "metatarsalgia", "stress fracture"
  ],
  redFlags: [
    "fever", "chills", "red streak", "streaking", "spreading redness", "black tissue",
    "gangrene", "malodour", "odor", "foul smell", "warmth", "eschar", "boggy",
    "can't feel", "cannot feel", "numb", "tingling", "loss of sensation", "recent trauma",
    "post-op", "postoperative", "exposed bone"
  ]
};

// simple contains-any
const hit = (text, list) => {
  if (!text) return false;
  const t = text.toLowerCase();
  return list.some(w => t.includes(w));
};

// Core fixer used by both TEXT and IMAGE flows.
// Inputs come from your existing model result; returns adjusted label/urgency.
function applyTriageRules({ category, urgency, summary, freeText, probs }) {
  let cat = category;
  let urg = Number(urgency) || 4;

  // 1) Safety before all: red flags or any wound-care probability >= 0.30 => urgency 1
  const redFlag = hit(freeText, WORDS.redFlags) || hit(summary, WORDS.redFlags);
  if (redFlag || (probs && (probs["wound care"] || 0) >= 0.30)) urg = Math.min(urg, 1);

  // 2) Diabetes / neuropathy / poor circulation => move to High-Risk unless already wound care + keep high urgency
  const hiRiskCue = hit(freeText, WORDS.highRisk) || hit(summary, WORDS.highRisk);
  if (hiRiskCue && cat !== "wound care") {
    cat = "high risk footcare";
    urg = Math.min(urg, 2);
  }

  // 3) Clear nail keywords => Nail Surgery (common false negative in tests)
  if (hit(freeText, WORDS.nailSurgery) || hit(summary, WORDS.nailSurgery)) {
    cat = "nail surgery";
    urg = Math.min(urg, 2);
  }

  // 4) Clear wound terms => Wound Care (overrides MSK/high-risk mislabels)
  if (hit(freeText, WORDS.woundCare) || hit(summary, WORDS.woundCare)) {
    cat = "wound care";
    urg = Math.min(urg, 1);
  }

  // 5) MSK cues to MSK if nothing urgent triggered (helps MSK↔️others confusion)
  if (hit(freeText, WORDS.msk) || hit(summary, WORDS.msk)) {
    if (urg > 2 && cat !== "wound care") cat = "MSK";
  }

  return { category: cat, urgency: urg };
}


// Translate helper function
async function translateReply(text, lang) {
  if (!text || lang === 'en') return text;

  // Normalize language code
  const normalizedLang = lang === 'zh' ? 'zh-CN' : lang;

  try {
    const translated = await translate(text, { to: normalizedLang });
    return translated;
  } catch (err) {
    console.error("❌ Translation error:", err);
    return text;
  }
}





// ************************************************* PATIENT LOGIC **************************************************************************

router.post("/chat", async (req, res) => {
  console.log("/chat route");

  const { message, patientId, language } = req.body;

  const userId = patientId;
  const messageText = message.toLowerCase(); // same result as before
  const userLanguage = language || 'en'; // fallback to 'en' if not provided
  console.log("🌐 Language for translation:", userLanguage);




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



  console.log("🆕 Incoming message:", message);
  console.log("📦 Session state at start:", s);

  try {
    // *************** STEP 2: TRIAGE INTENT *******************

    // ✅ Handle the infection confirmation follow-up from the image flow
    if (s.state === "confirm_infection_check") {
      const answer = (message || "").toLowerCase();

      // If the patient says YES → they confirm NO infection signs → proceed with non–wound care plan
      if (answer.includes("yes")) {
        const { category, diagnosis, urgencyLevel, summary, display, language } = s.proposed || {};
        s.category = category || s.category;
        s.diagnosis = diagnosis || s.diagnosis;
        s.urgencyLevel = urgencyLevel || s.urgencyLevel || 4;
        s.summary = summary || s.summary;
        s.cleanedDisplay = display || s.cleanedDisplay;

        s.state = "idle";
        s.triageStage = null;
        delete s.proposed;

        // ===== Reuse your existing availability logic (same as after text classification) =====
        // const now = new Date();
        // let minDate = new Date();
        const now = new Date();
        now.setHours(0, 0, 0, 0);  // Set to start of today
        let minDate = new Date();
        let maxDate = new Date();
        const urgencyLevelFinal = s.urgencyLevel;
        let cleanedDisplay = s.cleanedDisplay;
        const lang = language || userLanguage;

        const existingSnap = await db.collection("Appointments")
          .where("patientId", "==", userId)
          .where("status", "==", "scheduled")
          .where("scheduledDate", ">=", now)
          .orderBy("scheduledDate")
          .get();

        if (!existingSnap.empty) {
          const existingAppt = existingSnap.docs[0].data();
          const existingUrgency = existingAppt?.urgencyLevel ?? 4;

          if (existingSnap.size > 1) {
            cleanedDisplay = `⚠️ You have ${existingSnap.size} upcoming appointments.<br>` +
              `Please ensure this new issue is necessary to book.<br><br>` + cleanedDisplay;
          }

          if (urgencyLevelFinal >= existingUrgency) {
            const nextHalfHour = new Date(existingAppt.scheduledDate.toDate().getTime() + 30 * 60 * 1000);

            const followUpSnap = await db.collection("Availability")
              .where("status", "==", "available")
              .where("availableDate", "==", admin.firestore.Timestamp.fromDate(nextHalfHour))
              .where("podId", "==", existingAppt.podId)
              .limit(1)
              .get();

            if (!followUpSnap.empty) {
              const slotDoc = followUpSnap.docs[0];
              const slotData = slotDoc.data();
              const formattedDate = new Date(slotData.availableDate.toDate()).toLocaleString("en-SG", {
                weekday: "long", year: "numeric", month: "long", day: "numeric",
                hour: "2-digit", minute: "2-digit", hour12: true, timeZone: "Asia/Singapore"
              });

              s.state = "awaiting_confirmation";
              s.pendingSlot = slotDoc;
              s.pendingSlotData = slotData;

              return res.json({
                reply: await translateReply(
                  `${cleanedDisplay}<br><br>📌 You already have an appointment scheduled. I found a follow-up slot right after it on <b>${formattedDate}</b> with podiatrist <b>${slotData.podId}</b>.<br>Would you like to book this additional slot?`,
                  lang
                )
              });
            }

            minDate = new Date(existingAppt.scheduledDate.toDate());
          }
        }

        if (urgencyLevelFinal === 1) {
          minDate.setDate(now.getDate());
          maxDate.setDate(now.getDate() + 2);
        } else if (urgencyLevelFinal === 2) {
          minDate.setDate(now.getDate() + 1);
          maxDate.setDate(now.getDate() + 7);
        } else if (urgencyLevelFinal === 3) {
          minDate.setDate(now.getDate() + 3);
          maxDate.setDate(now.getDate() + 14);
        } else {
          minDate.setDate(now.getDate() + 5);
          maxDate.setDate(now.getDate() + 21);
        }

        const slotQuery = await db.collection("Availability")
          .where("status", "==", "available")
          .where("availableDate", ">=", minDate)
          .where("availableDate", "<=", maxDate)
          .orderBy("availableDate")
          .limit(1)
          .get();

        if (slotQuery.empty) {
          s.state = "idle";
          return res.json({
            reply: await translateReply(`${cleanedDisplay}\n\n⚠️ Sorry no appointments slots are found, please contact us.`, lang)
          });
        }

        const slotDoc = slotQuery.docs[0];
        const slotData = slotDoc.data();
        const formattedDate = new Date(
          slotData.availableDate.toDate ? slotData.availableDate.toDate() : slotData.availableDate
        ).toLocaleString("en-SG", {
          weekday: "long", year: "numeric", month: "long", day: "numeric",
          hour: "2-digit", minute: "2-digit", hour12: true, timeZone: "Asia/Singapore"
        });

        s.state = "awaiting_confirmation";
        s.pendingSlot = slotDoc;
        s.pendingSlotData = slotData;
        s.cleanedDisplay = cleanedDisplay;

        return res.json({
          reply: await translateReply(
            `${cleanedDisplay.trim()}<br><br>📅 I found a slot on <b>${formattedDate}</b> with podiatrist <b>${slotData.podId}</b>. Would you like to book this appointment?`,
            lang
          )
        });
      }

      // If the patient says NO (i.e., they DO have infection/wound signs) → upgrade to wound care level 1
      if (answer.includes("no")) {
        s.state = "idle";
        s.triageStage = null;
        s.category = "wound care";
        s.diagnosis = s.diagnosis || "Possible wound infection";
        s.urgencyLevel = 1;
        s.summary = s.summary ?? s.proposed?.summary ?? "No summary available.";


        let cleanedDisplay =
          `⚠️ Since you may have symptoms of a wound or infection, I’ll treat this as urgent wound care.<br>` +
          `You need to see a podiatrist urgently. Let me find the soonest available slot.`;

        const lang = s.proposed?.language || userLanguage;
        delete s.proposed;

        // Urgent booking window
        const now = new Date();
        now.setHours(0, 0, 0, 0); 
        let minDate = new Date();
        let maxDate = new Date();
        minDate.setDate(now.getDate());
        maxDate.setDate(now.getDate() + 2);
        

        const existingSnap = await db.collection("Appointments")
          .where("patientId", "==", userId)
          .where("status", "==", "scheduled")
          .where("scheduledDate", ">=", now)
          .orderBy("scheduledDate")
          .get();

        if (!existingSnap.empty && existingSnap.size > 1) {
          cleanedDisplay = `⚠️ You have ${existingSnap.size} upcoming appointments.<br>` +
            `Please ensure this new issue is necessary to book.<br><br>` + cleanedDisplay;
        }

        const slotQuery = await db.collection("Availability")
          .where("status", "==", "available")
          .where("availableDate", ">=", minDate)
          .where("availableDate", "<=", maxDate)
          .orderBy("availableDate")
          .limit(1)
          .get();

        if (slotQuery.empty) {
          s.state = "idle";
          return res.json({
            reply: await translateReply(`${cleanedDisplay}\n\n⚠️ Sorry no appointments slots are found, please contact us.`, lang)
          });
        }

        const slotDoc = slotQuery.docs[0];
        const slotData = slotDoc.data();
        const formattedDate = new Date(
          slotData.availableDate.toDate ? slotData.availableDate.toDate() : slotData.availableDate
        ).toLocaleString("en-SG", {
          weekday: "long", year: "numeric", month: "long", day: "numeric",
          hour: "2-digit", minute: "2-digit", hour12: true, timeZone: "Asia/Singapore"
        });

        s.state = "awaiting_confirmation";
        s.pendingSlot = slotDoc;
        s.pendingSlotData = slotData;
        s.cleanedDisplay = cleanedDisplay;

        return res.json({
          reply: await translateReply(
            `${cleanedDisplay.trim()}<br><br>📅 I found a slot on <b>${formattedDate}</b> with podiatrist <b>${slotData.podId}</b>. Would you like to book this appointment?`,
            lang
          )
        });
      }

      // Not a clear yes/no
      return res.json({ reply: await translateReply("❓ Please reply with 'yes' or 'no'.", userLanguage) });
    }


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
      s.messages.push({ role: "user", content: message });
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
          { role: "user", content: message }
        ]
      });

      const followUp = clarification.choices[0].message.content;

      // Set triageStage to clarification
      s.triageStage = "clarification";

      // Return translated follow up question
      return res.json({ reply: await translateReply(followUp, userLanguage) });
    }

    // IF IN TRIAGE STATE AND CLARIFICATION TRIAGE STAGE
    if (s.state === "triage" && s.triageStage === "clarification") {
      console.log("🔍 Handling clarification response...");

      s.messages.push({ role: "user", content: message }); // update user message to session message history
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
      let summary = summaryMatch?.[1]?.trim() || "No summary available.";

      // Clean display message (remove tag and trim)
      let cleanedDisplay = lastDisplay.replace(/\[DISPLAY MESSAGE.*?\]/i, "").trim();

      // Extract internal info
      const categoryMatch = lastInternal.match(/Category:\s*(.*)/i);
      const diagnosisMatch = lastInternal.match(/Diagnosis:\s*(.*)/i);
      const urgencyMatch = lastInternal.match(/Urgency level:\s*(\d)/i);

      let category = categoryMatch?.[1]?.trim() || "Unknown";
      let diagnosis = diagnosisMatch?.[1]?.trim() || "Unclear";
      let urgencyLevel = parseInt(urgencyMatch?.[1]) || 4;

      // Test-case correction layer (TEXT)
      {
        const fixed = applyTriageRules({
          category,
          urgency: urgencyLevel,
          summary,
          freeText: fullSymptomHistory, // the text you built just above
          probs: undefined               // you don't parse probs here; it's fine to omit
        });
        category = fixed.category;
        urgencyLevel = fixed.urgency;
        summary = fixed.summary ?? summary;
      }



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
      // const now = new Date();
      // let minDate = new Date();
      // Set appointemnt urgency
      const now = new Date();
      now.setHours(0, 0, 0, 0);  // Set to start of today
      let minDate = new Date();
      let maxDate = new Date();

      const existingSnap = await db.collection("Appointments")
        .where("patientId", "==", userId)
        .where("status", "==", "scheduled")
        .where("scheduledDate", ">=", now)
        .orderBy("scheduledDate")
        .get();


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
              reply: await translateReply(`${cleanedDisplay}<br><br>📌 You already have an appointment scheduled. I found a follow-up slot right after it on <b>${formattedDate}</b> with podiatrist <b>${slotData.podId}</b>.<br>Would you like to book this additional slot?`, userLanguage)
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

      // if (urgencyLevel === 1) {
      //   // Wound care – immediate
      //   minDate.setDate(now.getDate());       // today
      //   maxDate.setDate(now.getDate() + 2);   // up to 2 days
      // } 
      if (urgencyLevel === 1) {
        // Wound care – immediate
        const sgTime = new Date().toLocaleString('en-US', { timeZone: 'Asia/Singapore' });
        const currentHour = new Date(sgTime).getHours();
        
        // If it's after 4 PM (last slot at 5pm needs 1hr buffer) or before 8 AM
        if (currentHour >= 16 || currentHour < 8) {
          // Too late for today, start from tomorrow 8 AM
          minDate.setDate(now.getDate() + 1);
          minDate.setHours(8, 0, 0, 0);  // Tomorrow at 8 AM
          maxDate.setDate(now.getDate() + 2);
        } else {
          // Still within business hours - search from now + 1 hour
          minDate = new Date();
          minDate.setHours(minDate.getHours() + 1);  // At least 1 hour from now
          maxDate.setDate(now.getDate() + 2);
        }
      }
      else if (urgencyLevel === 2) {
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
          return res.json({ reply: await translateReply(`${cleanedDisplay}\n\n⚠️ Sorry no appointments slots are found, please contact us.`, userLanguage) });

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

        return res.json({ reply: await translateReply(responseMessage, userLanguage) });


      } catch (err) {
        console.error("❌ Error finding available slot:", err);
        s.state = "idle";
        s.triageStage = null;
        return res.json({ reply: `${cleanedDisplay}\n\n⚠️ An error occurred while checking availability.` });
      }
    }

    // Step 3: User confirms appointment
    if (s.state === "awaiting_confirmation") {
      const answer = message.toLowerCase();

      if (answer.includes("yes")) {
        const slotDoc = s.pendingSlot;
        const slotData = s.pendingSlotData;

        // Count current scheduled appointments
        const existingAppts = await db.collection("Appointments")
          .where("patientId", "==", userId)
          .where("status", "==", "scheduled")
          .get();

        const summaryToSave = (s.summary ?? s.proposed?.summary ?? "No summary available.");
        const categoryToSave = (s.category ?? s.proposed?.category ?? "Unknown");
        const diagnosisToSave = (s.diagnosis ?? s.proposed?.diagnosis ?? "Unclear");
        const urgencyToSave = (typeof s.urgencyLevel === "number" ? s.urgencyLevel
          : (s.proposed?.urgencyLevel ?? 4));

        const appointmentData = {
          patientId: userId,
          podId: slotData.podId,
          scheduledDate: slotData.availableDate,
          status: "scheduled",
          urgencyLevel: urgencyToSave,
          category: categoryToSave,
          initialDiagnosis: diagnosisToSave,
          summary: summaryToSave,
          triageDateTime: admin.firestore.Timestamp.now(),
          imageUrl: s.imageUrl || null,        // ← ADD THIS
          imageCaption: null,        // ← ADD THIS
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
          reply: await translateReply(`✅ Appointment confirmed for <b>${formattedDate}</b> with podiatrist <b>${slotData.podId}</b>.`, userLanguage)
        });

      }

      if (answer.includes("no")) {
        s.state = "idle";
        s.pendingSlot = null;
        s.pendingSlotData = null;
        return res.json({ reply: await translateReply("❌ No worries. Let me know if you'd like me to check another slot or start over.", userLanguage) });
      }

      return res.json({ reply: await translateReply("❓ Please reply with 'yes' or 'no' to confirm your appointment.", userLanguage) });
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
            reply: await translateReply("📅 You don't have any upcoming appointments at the moment.", userLanguage)
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
          const formattedDate = appt.scheduledDate.toDate().toLocaleString(userLanguage, {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
            hour12: true,
            timeZone: "Asia/Singapore"
          });

          const template = await translateReply("📅 You have an appointment on <b>{date}</b> - <b>{name}</b>.", userLanguage);
          const reply = template.replace("{date}", formattedDate).replace("{name}", podiatristName);

          return res.json({ reply });

        } else {
          const replies = await Promise.all(allAppts.map(async appt => {
            const podiatristName = await getPodiatristName(appt.podId);
            const formattedDate = appt.scheduledDate.toDate().toLocaleString(userLanguage, {
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
              hour12: true,
              timeZone: "Asia/Singapore"
            });
            return `📅 ${formattedDate} - ${podiatristName}`;
          }));

          const template = await translateReply(
            "📋 Here are your upcoming appointments:<br><br>{list}<br><br>Let me know if you have a foot symptom and want to make another appointment!",
            userLanguage
          );
          const reply = template.replace("{list}", replies.join("<br>"));

          return res.json({ reply });


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
      reply: await translateReply("I'm not sure what you mean. You can type 'triage' or 'appointment'.", userLanguage)
    });


  } catch (err) {
    console.error("Chat error (patient):", err);
    return res.status(500).json({
      reply: await translateReply("⚠️ Something went wrong on the server.", userLanguage)
    });

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

    // // Get appointment
    // const apptSnapshot = await db.collection("Appointments")
      // Get next upcoming appointment (future only)
      // Get next upcoming appointment (from today onwards)
      const now = new Date();
      now.setHours(0, 0, 0, 0);  // Set to midnight (start of today)
      const apptSnapshot = await db.collection("Appointments")
      .where("patientId", "==", patientId)
      .where("status", "==", "scheduled")
      .where("scheduledDate", ">=", now)
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
    // const allApptsSnap = await db.collection("Appointments")
    //   .where("patientId", "==", patientId)
    //   .where("status", "==", "scheduled")
    //   .orderBy("scheduledDate")
    //   .get();

    const allApptsSnap = await db.collection("Appointments")
      .where("patientId", "==", patientId)
      .where("status", "==", "scheduled")
      .where("scheduledDate", ">=", now)    // ← ADD THIS NEW LINE
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


// // Smooth batch translation endpoint
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

//     // Filter out empty texts and store mapping
//     const textMapping = [];
//     const nonEmptyTexts = [];

//     texts.forEach((text, index) => {
//       if (text && text.trim()) {
//         textMapping.push({ originalIndex: index, textIndex: nonEmptyTexts.length });
//         nonEmptyTexts.push(text.trim());
//       } else {
//         textMapping.push({ originalIndex: index, textIndex: -1, isEmpty: true });
//       }
//     });

//     if (nonEmptyTexts.length === 0) {
//       return res.json({ translations: texts });
//     }

//     // Always use individual translations for maximum reliability
//     // This avoids all separator/marker extraction issues
//     console.log('📝 Using individual translations for maximum reliability');

//     const translatedTexts = await Promise.all(
//       nonEmptyTexts.map(async (text, index) => {
//         try {
//           // Add small delay between requests to avoid rate limiting
//           if (index > 0) {
//             await new Promise(resolve => setTimeout(resolve, 50));
//           }

//           const result = await translate(text, { to: googleLangCode });
//           console.log(`✓ Translated ${index + 1}/${nonEmptyTexts.length}: "${text}" -> "${result}"`);
//           return result;
//         } catch (err) {
//           console.error(`✗ Translation failed for "${text}":`, err);
//           return text; // Return original if translation fails
//         }
//       })
//     );

//     // Reconstruct the full translations array
//     const fullTranslations = new Array(texts.length);

//     textMapping.forEach(({ originalIndex, textIndex, isEmpty }) => {
//       if (isEmpty) {
//         fullTranslations[originalIndex] = texts[originalIndex]; // Keep empty as is
//       } else {
//         fullTranslations[originalIndex] = translatedTexts[textIndex] || texts[originalIndex];
//       }
//     });

//     console.log(`✅ All individual translations completed successfully`);
//     res.json({ translations: fullTranslations });

//   } catch (error) {
//     console.error('Translation error:', error);
//     // Return original texts if everything fails
//     res.json({ translations: texts });
//   }
// });

// router.post('/translate-batch', async (req, res) => {
//   const { texts, targetLanguage } = req.body;

//   try {
//     if (targetLanguage === 'en') {
//       return res.json({ translations: texts });
//     }

//     const languageMap = {
//       'en': 'en',
//       'zh': 'zh-cn', 
//       'ms': 'ms',
//       'ta': 'ta'
//     };

//     const googleLangCode = languageMap[targetLanguage] || targetLanguage;

//     console.log(`🌍 CACHED batch translating ${texts.length} texts to: ${targetLanguage}`);

//     const results = [];
//     const toTranslate = [];
//     const translateIndices = [];

//     // Check cache first
//     texts.forEach((text, index) => {
//       if (!text || !text.trim()) {
//         results[index] = text;
//         return;
//       }

//       const cacheKey = `${text.trim()}_${googleLangCode}`;
//       const cached = translationCache.get(cacheKey);
      
//       if (cached && (Date.now() - cached.timestamp) < CACHE_EXPIRY) {
//         results[index] = cached.translation;
//         console.log(`📦 Cache hit: "${text.trim()}"`);
//       } else {
//         toTranslate.push(text.trim());
//         translateIndices.push(index);
//       }
//     });

//     // Translate uncached texts
//     if (toTranslate.length > 0) {
//       console.log(`🔄 Translating ${toTranslate.length} new texts`);
      
//       const translations = await Promise.all(
//         toTranslate.map(async (text) => {
//           try {
//             const translated = await translate(text, { to: googleLangCode });
            
//             // Cache the result
//             const cacheKey = `${text}_${googleLangCode}`;
//             translationCache.set(cacheKey, {
//               translation: translated,
//               timestamp: Date.now()
//             });
            
//             return translated;
//           } catch (err) {
//             console.error(`Translation failed for "${text}":`, err.message);
//             return text;
//           }
//         })
//       );

//       // Fill in translated results
//       translateIndices.forEach((originalIndex, i) => {
//         results[originalIndex] = translations[i];
//       });
//     }

//     console.log(`⚡ CACHED translation completed (${toTranslate.length} new, ${texts.length - toTranslate.length} cached)`);
//     res.json({ translations: results });

//   } catch (error) {
//     console.error('Translation error:', error);
//     res.json({ translations: texts });
//   }
// });

router.post('/translate-batch', async (req, res) => {
  const { texts, targetLanguage } = req.body;

  try {
    if (targetLanguage === 'en') {
      return res.json({ translations: texts });
    }

    const languageMap = {
      'en': 'en',
      'zh': 'zh-cn', 
      'ms': 'ms',
      'ta': 'ta'
    };

    const googleLangCode = languageMap[targetLanguage] || targetLanguage;

    console.log(`🌍 TURBO batch translating ${texts.length} texts to: ${targetLanguage}`);

    const results = [];
    const toTranslate = [];
    const translateIndices = [];

    // Check cache first
    texts.forEach((text, index) => {
      if (!text || !text.trim()) {
        results[index] = text;
        return;
      }

      const cacheKey = `${text.trim()}_${googleLangCode}`;
      const cached = translationCache.get(cacheKey);
      
      if (cached && (Date.now() - cached.timestamp) < CACHE_EXPIRY) {
        results[index] = cached.translation;
      } else {
        toTranslate.push(text.trim());
        translateIndices.push(index);
      }
    });

    // 🚀 TURBO: Translate all uncached texts in full parallel (no batching)
    if (toTranslate.length > 0) {
      console.log(`🚀 TURBO translating ${toTranslate.length} texts in full parallel`);
      
      const translations = await Promise.all(
        toTranslate.map(async (text, index) => {
          try {
            // Small staggered delay to avoid hitting rate limits
            await new Promise(resolve => setTimeout(resolve, index * 10)); // 10ms stagger
            
            const translated = await translate(text, { to: googleLangCode });
            
            // Cache the result
            const cacheKey = `${text}_${googleLangCode}`;
            translationCache.set(cacheKey, {
              translation: translated,
              timestamp: Date.now()
            });
            
            return translated;
          } catch (err) {
            console.error(`Translation failed for "${text}":`, err.message);
            return text;
          }
        })
      );

      // Fill in translated results
      translateIndices.forEach((originalIndex, i) => {
        results[originalIndex] = translations[i];
      });
    }

    console.log(`⚡ TURBO translation completed (${toTranslate.length} new, ${texts.length - toTranslate.length} cached)`);
    res.json({ translations: results });

  } catch (error) {
    console.error('Translation error:', error);
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


// ---------------- IMAGE CHAT ROUTE ----------------------------------------------------------------------------------------------------------------------------------------------****
router.post("/chat-image", (req, res) => {
  console.log("🔥 Hit /patient/chat-image (Busboy version). Content-Type:", req.headers["content-type"]);

  const contentType = req.headers["content-type"] || "";
  if (!contentType.startsWith("multipart/form-data")) {
    return res.status(400).json({ error: "Expected multipart/form-data" });
  }

  // Values we’ll fill from Busboy
  let imageBuffer = null;
  let imageMime = "";
  let caption = "";
  let patientId = "";
  let language = "en";

  const busboy = Busboy({ headers: req.headers });

  // ---- FILE FIELD ----
  busboy.on("file", (fieldname, file, info) => {
  const { filename, encoding, mimeType } = info;
  console.log("📷 Busboy got file field:", fieldname, filename, mimeType);

  if (fieldname !== "image") {
    // Ignore any other file fields
    file.resume();
    return;
  }

  imageMime = mimeType || "";
  const chunks = [];

  file.on("data", (data) => {
    chunks.push(data);
  });

  file.on("end", () => {
    imageBuffer = Buffer.concat(chunks);
    console.log("✅ Finished reading image, size:", imageBuffer.length);
  });
});


  // ---- NORMAL FIELDS ----
  busboy.on("field", (fieldname, val) => {
    console.log("✏️ Busboy field:", fieldname, "=", val);
    if (fieldname === "caption") caption = val;
    if (fieldname === "patientId") patientId = val;
    if (fieldname === "language") language = val || "en";
  });

  busboy.on("error", (err) => {
    console.error("❌ Busboy error in /chat-image:", err);
    return res.status(500).json({ error: "Upload error" });
  });

  // ---- WHEN ALL PARTS ARE READ ----
  busboy.on("finish", async () => {
    console.log("🎯 Entered /chat-image AFTER busboy");

    try {
      const userLanguage = language || "en";
      const userId = patientId;

      if (!imageBuffer) {
        console.log("🛑 [/chat-image] No file in request.");
        return res.json({
          reply: await translateReply("⚠️ No image received.", userLanguage),
        });
      }
      if (!imageMime || !imageMime.startsWith("image/")) {
        console.log("🛑 [/chat-image] Uploaded file is not an image. Mimetype:", imageMime);
        return res.json({
          reply: await translateReply("⚠️ Please upload a valid image file.", userLanguage),
        });
      }

      // Session (unchanged)
      session[userId] = session[userId] || {
        state: "idle",
        triageStage: null,
        messages: [],
        pendingSlot: null,
        pendingSlotData: null,
      };
      const s = session[userId];

      // Helpers (same as before)
      const VLM_MODEL = "gpt-4o-mini";
      const GATE_MODEL = "gpt-4o-mini";

      function safeParseJSON(str) {
        try {
          return JSON.parse(str);
        } catch {
          return null;
        }
      }

      function splitInternalAndDisplay(full) {
        const raw = (full || "").trim();
        if (!raw) return { internal: "", display: "" };
        const parts = raw.split(/-{3,}/);
        if (parts.length < 2) {
          return {
            internal: "",
            display: raw.replace(/\[DISPLAY MESSAGE[^\]]*\]/i, "").trim(),
          };
        }
        const internal = parts[parts.length - 2] || "";
        const display = (parts[parts.length - 1] || "")
          .replace(/\[DISPLAY MESSAGE[^\]]*\]/i, "")
          .trim();
        return { internal, display };
      }

      function grabLine(internal, re, fallback) {
        const m = internal.match(re);
        return m && m[1] ? m[1].trim() : fallback;
      }

      function normalizeCategory(catRaw) {
        if (!catRaw) return "Unknown";
        const c = catRaw.toLowerCase().trim();
        if (c.startsWith("msk")) return "MSK";
        if (c.includes("wound")) return "wound care";
        if (c.includes("nail")) return "nail surgery";
        if (c.includes("high") && c.includes("risk")) return "high risk footcare";
        if (c.includes("footcare")) return "high risk footcare";
        return catRaw.trim();
      }

      function normalizeUrgency(uRaw, cat) {
        let u = parseInt(uRaw, 10);
        if (!Number.isFinite(u)) {
          const c = (cat || "").toLowerCase();
          if (c.includes("wound")) u = 1;
          else if (c.includes("nail")) u = 2;
          else if (c.includes("high")) u = 3;
          else if (c.includes("msk")) u = 4;
          else u = 4;
        }
        if (u < 1) u = 1;
        if (u > 4) u = 4;
        return u;
      }

      // ===== Convert image to data URL (uses imageBuffer/imageMime now) =====
      const b64 = imageBuffer.toString("base64");
      const dataUrl = `data:${imageMime};base64,${b64}`;

      // ================= 1) IMAGE GATE =================
      const gateMsg = [
        {
          type: "text",
          text: `You are an image gatekeeper. Decide if this image is a clear photo of a HUMAN FOOT (or feet) useful for podiatry triage.
Return ONLY compact JSON like: {"valid": true, "reason": "short reason"}.

valid=true ONLY IF:
- A human foot is clearly visible (bare or clearly visible even if partly covered).
- Image is not excessively blurry/overexposed/too dark.
- Foot fills a reasonable portion of the frame.

valid=false for: hands, faces, pets/animals, landscapes, documents/screenshots, x-rays, memes, drawings, shoes-only (no visible foot).

Be strict. Output JSON only.`,
        },
        { type: "image_url", image_url: { url: dataUrl } },
      ];

      const gate = await openai.chat.completions.create({
        model: GATE_MODEL,
        temperature: 0,
        messages: [
          {
            role: "system",
            content:
              "Return ONLY JSON with keys {valid:boolean, reason:string} and nothing else.",
          },
          { role: "user", content: gateMsg },
        ],
      });

      const gateRaw = gate.choices?.[0]?.message?.content?.trim() || "";
      const gateJSON = safeParseJSON(gateRaw) || {
        valid: false,
        reason: "unparseable_response",
      };

      if (gateJSON.valid !== true) {
        const askForProperPhoto =
          "⚠️ I can’t clearly see a foot in this photo. Please upload a clear, well-lit photo of the affected foot. " +
          "Show the area of concern (wound/redness/nail) and avoid socks or heavy filters.";
        return res.json({
          reply: await translateReply(askForProperPhoto, userLanguage),
        });
      }

      // ================= 2) TRIAGE PROMPT (vision) =================
      const visionPrompt = `You are a podiatry triage assistant. Consider BOTH the patient's conversation history/caption (if any) and the uploaded foot image.

Classify into exactly one:
- wound care: presence of wound, signs of infection (redness, swelling, pain, pus, warmth), gangrene, neuropathic/ischaemic/neuroischaemic wounds/ulcers
- nail surgery: ingrown toenail, involuted toenail
- high risk footcare: callus, corns, warts, pathological toenails
- MSK: foot pain, footwear issues, plantar fasciitis, posterior tibial tendon dysfunction, limb length discrepancy, hallux valgus/bunions, metatarsalgia

If the photo shows no obvious pathology, state that plainly (e.g., “No visible wound or infection on the photo”), and use MSK (level 4) unless the caption suggests otherwise.

IMPORTANT: Do NOT set Urgency=1 unless at least ONE of these is visibly/clearly present OR stated by the caption:
open wound OR drainage/pus OR necrosis/black tissue OR spreading redness (lymphangitic streaks) OR malodour OR fever/chills. 
General redness/swelling alone is NOT enough for Urgency 1.

Assign urgency:
- wound care → 1 (most urgent)
- nail surgery → 2
- high risk footcare → 3
- MSK → 4 (least urgent)
Also provide an Initial diagnosis.

Return EXACTLY this format with three dashes (---) separating sections:

[INTERNAL DATA]
Category: <MSK / wound care / nail surgery / high risk footcare>
Diagnosis: <Short diagnosis>
Urgency level: <1 to 4>
Summary: A brief clinical-style note for the podiatrist (what the patient said, duration/severity, infection signs, impression, urgency)
Evidence:
  open_wound: <true|false>
  drainage_pus: <true|false>
  necrosis_black_tissue: <true|false>
  spreading_redness: <true|false>
  general_redness_swelling: <true|false>
  malodour: <true|false>
  fever_chills: <true|false>
RiskFactors:
  diabetes_neuropathy: <true|false>
  recent_trauma: <true|false>
Confidence: <0.0-1.0>

---

[DISPLAY MESSAGE, SH]
Start with:
- 1 → "You need to see a podiatrist urgently."
- 2 → "You should see a podiatrist soon."
- 3 → "This should be checked by a podiatrist."
- 4 → "This is not urgent, but a podiatrist can help manage the issue."
<br><br>
While you wait for your appointment, here's what you should do:<br>
• Tip 1<br>
• Tip 2<br>
• Tip 3<br>
(Do not display internal data to the patient.)`; 

      const triageMsgsBase = [
        { role: "system", content: "You are a careful, empathetic podiatry triage assistant." },
        { role: "user", content: [{ type: "text", text: visionPrompt }] },
      ];

      const userPayload = [];
      if (caption && caption.trim())
        userPayload.push({ type: "text", text: `Patient caption: ${caption}` });
      userPayload.push({ type: "image_url", image_url: { url: dataUrl } });
      triageMsgsBase.push({ role: "user", content: userPayload });

      async function callVLMOnce() {
        return openai.chat.completions.create({
          model: VLM_MODEL,
          temperature: 0.2,
          messages: triageMsgsBase,
        });
      }

      let completion,
        attempt = 0;
      while (attempt < 2) {
        try {
          completion = await callVLMOnce();
          break;
        } catch (e) {
          attempt++;
          if (attempt >= 2) throw e;
        }
      }

      const full = completion.choices?.[0]?.message?.content || "";
      const { internal, display: rawDisplay } = splitInternalAndDisplay(full);

      // Parse internal (same as before)
      const rawCategory = grabLine(internal, /Category:\s*([^\n\r]+)/i, "Unknown");
      let category = normalizeCategory(rawCategory);
      const diagnosis = grabLine(internal, /Diagnosis:\s*([^\n\r]+)/i, "Unclear");
      let urgencyLevel = normalizeUrgency(
        grabLine(internal, /Urgency level:\s*(\d)/i, ""),
        category
      );
      let summary =
        (internal.match(/Summary:\s*([\s\S]*?)$/i)?.[1] || "No summary available.").trim();
      if (typeof summary !== "string" || !summary.trim()) {
        summary = "No summary available.";
      }

      let display = rawDisplay.replace(/\[DISPLAY MESSAGE[^\]]*\]/i, "").trim();
      if (!display) {
        const firstLine =
          urgencyLevel === 1
            ? "You need to see a podiatrist urgently."
            : urgencyLevel === 2
            ? "You should see a podiatrist soon."
            : urgencyLevel === 3
            ? "This should be checked by a podiatrist."
            : "This is not urgent, but a podiatrist can help manage the issue.";
        display = `${firstLine}<br><br>While you wait for your appointment, here's what you should do:<br>• Keep the area clean and dry<br>• Avoid tight footwear<br>• Reduce load and monitor symptoms`;
      }

      // ================= 3) RULE SAFETY LAYER (unchanged) =================
      {
        const fixed = applyTriageRules({
          category,
          urgency: urgencyLevel,
          summary,
          freeText: caption,
          probs: undefined,
        });
        category = fixed.category;
        urgencyLevel = fixed.urgency;
        if (typeof fixed.summary === "string" && fixed.summary) summary = fixed.summary;
      }

      function pickFlag(re, src) {
        const m = src.match(re);
        if (!m) return false;
        const v = (m[1] || "").trim().toLowerCase();
        return v === "true" || v === "yes";
      }

      const evidence = {
        openWound: pickFlag(/open_wound:\s*(true|false)/i, internal),
        drainagePus: pickFlag(/drainage_pus:\s*(true|false)/i, internal),
        necrosis: pickFlag(/necrosis_black_tissue:\s*(true|false)/i, internal),
        spreadingRedness: pickFlag(/spreading_redness:\s*(true|false)/i, internal),
        generalRedness: pickFlag(/general_redness_swelling:\s*(true|false)/i, internal),
        malodour: pickFlag(/malodour:\s*(true|false)/i, internal),
        feverChills: pickFlag(/fever_chills:\s*(true|false)/i, internal),
        diabetesNeuropathy: pickFlag(/diabetes_neuropathy:\s*(true|false)/i, internal),
        recentTrauma: pickFlag(/recent_trauma:\s*(true|false)/i, internal),
      };

      const strongInfection =
        evidence.openWound ||
        evidence.drainagePus ||
        evidence.necrosis ||
        evidence.spreadingRedness ||
        evidence.malodour ||
        evidence.feverChills;

      if (urgencyLevel === 1 && !strongInfection) {
        console.log(
          "🧯 Downgrading Urgency 1 (no strong infection evidence). Evidence:",
          evidence
        );

        s.state = "confirm_infection_check";
        s.proposed = {
          category,
          diagnosis,
          urgencyLevel: 2,
          summary,
          display,
          language: userLanguage,
        };

        const confirmMsg =
          "❓ Can you confirm you do NOT have ANY open wounds, pus, signs of infections, fever/chills?";
        return res.json({ reply: await translateReply(confirmMsg, userLanguage) });
      }

      console.log("🔎 Evidence flags:", evidence, "| strongInfection:", strongInfection);

      if (typeof summary !== "string" || !summary.trim()) {
        summary = "No summary available.";
      }

      s.urgencyLevel = urgencyLevel;
      s.category = category;
      s.diagnosis = diagnosis;
      s.summary = summary;
      s.cleanedDisplay = display;

      console.log("🧠 Image triage result:");
      console.log("Category:", category);
      console.log("Diagnosis:", diagnosis);
      console.log("Urgency level:", urgencyLevel);
      console.log("Summary:", summary);
      console.log("=========================");

      // ================= UPLOAD IMAGE TO FIREBASE STORAGE =================
      let imageUrl = null;
      try {
        const timestamp = Date.now();
        const fileExtension = imageMime.split("/")[1];
        const fileName = `patient_images/${userId}_${timestamp}.${fileExtension}`;
        const file = bucket.file(fileName);

        await file.save(imageBuffer, {
          metadata: {
            contentType: imageMime,
            metadata: {
              patientId: userId,
              uploadedAt: new Date().toISOString(),
              caption: caption || "",
            },
          },
        });

        await file.makePublic();
        imageUrl = `https://storage.googleapis.com/${bucket.name}/${fileName}`;
        s.imageUrl = imageUrl;
        console.log("✅ Image uploaded:", imageUrl);
      } catch (err) {
        console.error("⚠️ Storage upload failed:", err);
      }

      // ================= 4) Confirm infection if NOT urgent (unchanged behavior) =================
    if (urgencyLevel !== 1) {
      s.state = "confirm_infection_check";
      s.proposed = { category, diagnosis, urgencyLevel, summary, display, language: userLanguage };

      const confirmMsg =
        "❓ I don’t clearly see an open wound, pus, black tissue, red streaks, or fever/chills. " +
        "Can you confirm you do NOT have ANY of these symptoms right now? (yes/no)";

      return res.json({ reply: await translateReply(confirmMsg, userLanguage) });
    }

    // ================= 5) Availability & booking flow (IDENTICAL to yours) =================
    {
      // const now = new Date();
      // let minDate = new Date(now);
      const now = new Date();  // Current time for checking business hours
      const todayMidnight = new Date();
      todayMidnight.setHours(0, 0, 0, 0);  // Midnight for appointment filtering
      let minDate = new Date();
      let maxDate = new Date();

      const existingSnap = await db.collection("Appointments")
        .where("patientId", "==", userId)
        .where("status", "==", "scheduled")
        .where("scheduledDate", ">=", todayMidnight)
        .orderBy("scheduledDate")
        .get();

      if (!existingSnap.empty) {
        const existingAppt = existingSnap.docs[0].data();
        const existingUrgency = existingAppt?.urgencyLevel ?? 4;

        if (existingSnap.size > 1) {
          display = `⚠️ You have ${existingSnap.size} upcoming appointments.<br>` +
            `Please ensure this new issue is necessary to book.<br><br>` +
            display;
        }

        if (urgencyLevel >= existingUrgency) {
          const nextHalfHour = new Date(existingAppt.scheduledDate.toDate().getTime() + 30 * 60 * 1000);

          const followUpSnap = await db.collection("Availability")
            .where("status", "==", "available")
            .where("availableDate", "==", admin.firestore.Timestamp.fromDate(nextHalfHour))
            .where("podId", "==", existingAppt.podId)
            .limit(1)
            .get();

          if (!followUpSnap.empty) {
            const slotDoc = followUpSnap.docs[0];
            const slotData = slotDoc.data();

            const formattedDate = new Date(slotData.availableDate.toDate()).toLocaleString("en-SG", {
              weekday: "long", year: "numeric", month: "long", day: "numeric",
              hour: "2-digit", minute: "2-digit", hour12: true, timeZone: "Asia/Singapore"
            });

            s.state = "awaiting_confirmation";
            s.pendingSlot = slotDoc;
            s.pendingSlotData = slotData;

            return res.json({
              reply: await translateReply(
                `${display}<br><br>📌 You already have an appointment scheduled. I found a follow-up slot right after it on <b>${formattedDate}</b> with podiatrist <b>${slotData.podId}</b>.<br>Would you like to book this additional slot?`,
                userLanguage
              )
            });
          }

          minDate = new Date(existingAppt.scheduledDate.toDate());
        }
      }

      // Urgency → window (same mapping)
      // if (urgencyLevel === 1) {
      //   minDate.setDate(now.getDate());
      //   maxDate.setDate(now.getDate() + 2);
      // } 

      if (urgencyLevel === 1) {
        const sgTime = new Date().toLocaleString('en-US', { timeZone: 'Asia/Singapore' });
        const currentHour = new Date(sgTime).getHours();
        
        // if (currentHour >= 16 || currentHour < 8) {
        //   minDate.setDate(now.getDate() + 1);
        //   minDate.setHours(8, 0, 0, 0);
        //   maxDate.setDate(now.getDate() + 2);
        if (currentHour >= 16 || currentHour < 8) {
          const tomorrow = new Date();
          tomorrow.setDate(tomorrow.getDate() + 1);
          tomorrow.setHours(8, 0, 0, 0);
          minDate = tomorrow;
          
          const dayAfter = new Date();
          dayAfter.setDate(dayAfter.getDate() + 2);
          maxDate = dayAfter;
        } else {
          minDate = new Date();
          minDate.setHours(minDate.getHours() + 1);
          const twoDaysLater = new Date();
          twoDaysLater.setDate(twoDaysLater.getDate() + 2);
          maxDate = twoDaysLater;
        }
      }
      else if (urgencyLevel === 2) {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        minDate = tomorrow;
        
        const oneWeekLater = new Date();
        oneWeekLater.setDate(oneWeekLater.getDate() + 7);
        maxDate = oneWeekLater;
      } else if (urgencyLevel === 3) {
        const threeDaysLater = new Date();
        threeDaysLater.setDate(threeDaysLater.getDate() + 3);
        minDate = threeDaysLater;
        
        const twoWeeksLater = new Date();
        twoWeeksLater.setDate(twoWeeksLater.getDate() + 14);
        maxDate = twoWeeksLater;
      } else {
        const fiveDaysLater = new Date();
        fiveDaysLater.setDate(fiveDaysLater.getDate() + 5);
        minDate = fiveDaysLater;
        
        const threeWeeksLater = new Date();
        threeWeeksLater.setDate(threeWeeksLater.getDate() + 21);
        maxDate = threeWeeksLater;
      }

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
          reply: await translateReply(`${display}\n\n⚠️ Sorry no appointments slots are found, please contact us.`, userLanguage)
        });
      }

      const slotDoc = slotQuery.docs[0];
      const slotData = slotDoc.data();

      const formattedDate = new Date(
        slotData.availableDate.toDate ? slotData.availableDate.toDate() : slotData.availableDate
      ).toLocaleString("en-SG", {
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
      s.cleanedDisplay = display;

      const responseMessage = `${display.trim()}<br><br>📅 I found a slot on <b>${formattedDate}</b> with podiatrist <b>${slotData.podId}</b>. Would you like to book this appointment?`;
      return res.json({ reply: await translateReply(responseMessage, userLanguage) });
    }

    } catch (err) {
      console.error("❌ /patient/chat-image error:", err);
      return res.json({ reply: "⚠️ Image analysis failed on the server." });
    }
  });

  // On Firebase Functions, body is in req.rawBody
  if (req.rawBody) {
    busboy.end(req.rawBody);
  } else {
    // Local dev fallback
    req.pipe(busboy);
  }
});

/*
// ---------------- IMAGE CHAT ROUTE ----------------------------------------------------------------------------------------------------------------------------------------------****
router.post("/chat-image", async (req, res) => {
  console.log("🎯 Entered /chat-image AFTER multer");
  console.log("📸 multer file:", req.file ? "YES" : "NO FILE");
  console.log("📝 body:", req.body);
        console.log("Entered chat image route!!!!!!!!!");
  try {
    const { patientId, language, caption = "" } = req.body;
    const userLanguage = language || "en";
    const userId = patientId;

    if (!req.file) {
      console.log("🛑 [/chat-image] No file in request.");
      return res.json({ reply: await translateReply("⚠️ No image received.", userLanguage) });
    }
    if (!req.file.mimetype || !req.file.mimetype.startsWith("image/")) {
      console.log("🛑 [/chat-image] Uploaded file is not an image. Mimetype:", req.file.mimetype);
      return res.json({ reply: await translateReply("⚠️ Please upload a valid image file.", userLanguage) });
    }

    // Session (unchanged)
    session[userId] = session[userId] || {
      state: "idle",
      triageStage: null,
      messages: [],
      pendingSlot: null,
      pendingSlotData: null
    };
    const s = session[userId];

    // Helpers (new small utilities)
    const VLM_MODEL = "gpt-4o-mini";
    const GATE_MODEL = "gpt-4o-mini";

    function safeParseJSON(str) {
      try { return JSON.parse(str); } catch { return null; }
    }

    function splitInternalAndDisplay(full) {
      // handle none / one / many '---'
      const raw = (full || "").trim();
      if (!raw) return { internal: "", display: "" };
      const parts = raw.split(/-{3,}/); // one or more dashes line
      if (parts.length < 2) {
        // no separator; treat all as display
        return { internal: "", display: raw.replace(/\[DISPLAY MESSAGE[^\]]*\]/i, "").trim() };
      }
      // choose the last two blocks in case the model produced multiple
      const internal = parts[parts.length - 2] || "";
      const display = (parts[parts.length - 1] || "").replace(/\[DISPLAY MESSAGE[^\]]*\]/i, "").trim();
      return { internal, display };
    }

    function grabLine(internal, re, fallback) {
      const m = internal.match(re);
      return (m && m[1] ? m[1].trim() : fallback);
    }

    function normalizeCategory(catRaw) {
      if (!catRaw) return "Unknown";
      const c = catRaw.toLowerCase().trim();
      if (c.startsWith("msk")) return "MSK";
      if (c.includes("wound")) return "wound care";
      if (c.includes("nail")) return "nail surgery";
      if (c.includes("high") && c.includes("risk")) return "high risk footcare";
      if (c.includes("footcare")) return "high risk footcare";
      return catRaw.trim(); // keep original if unknown
    }

    function normalizeUrgency(uRaw, cat) {
      let u = parseInt(uRaw, 10);
      if (!Number.isFinite(u)) {
        // fallback from category
        const c = (cat || "").toLowerCase();
        if (c.includes("wound")) u = 1;
        else if (c.includes("nail")) u = 2;
        else if (c.includes("high")) u = 3;
        else if (c.includes("msk")) u = 4;
        else u = 4;
      }
      // clamp to 1..4
      if (u < 1) u = 1;
      if (u > 4) u = 4;
      return u;
    }

    // Convert image → data URL (unchanged)
    const b64 = req.file.buffer.toString("base64");
    const dataUrl = `data:${req.file.mimetype};base64,${b64}`;

   

    // ================= 1) IMAGE GATE (same purpose, slightly clearer prompt) =================
    const gateMsg = [
      {
        type: "text", text:
          `You are an image gatekeeper. Decide if this image is a clear photo of a HUMAN FOOT (or feet) useful for podiatry triage.
Return ONLY compact JSON like: {"valid": true, "reason": "short reason"}.

valid=true ONLY IF:
- A human foot is clearly visible (bare or clearly visible even if partly covered).
- Image is not excessively blurry/overexposed/too dark.
- Foot fills a reasonable portion of the frame.

valid=false for: hands, faces, pets/animals, landscapes, documents/screenshots, x-rays, memes, drawings, shoes-only (no visible foot).

Be strict. Output JSON only.`
      },
      { type: "image_url", image_url: { url: dataUrl } }
    ];

    const gate = await openai.chat.completions.create({
      model: GATE_MODEL,
      temperature: 0,
      messages: [
        { role: "system", content: "Return ONLY JSON with keys {valid:boolean, reason:string} and nothing else." },
        { role: "user", content: gateMsg }
      ]
    });

    const gateRaw = gate.choices?.[0]?.message?.content?.trim() || "";
    const gateJSON = safeParseJSON(gateRaw) || { valid: false, reason: "unparseable_response" };

    if (gateJSON.valid !== true) {
      const askForProperPhoto =
        "⚠️ I can’t clearly see a foot in this photo. " +
        "Please upload a clear, well-lit photo of the affected foot. " +
        "Show the area of concern (wound/redness/nail) and avoid socks or heavy filters.";
      return res.json({ reply: await translateReply(askForProperPhoto, userLanguage) });
    }

    // ================= 2) TRIAGE PROMPT (vision) with small retry =================
    const visionPrompt =
      `You are a podiatry triage assistant. Consider BOTH the patient's conversation history/caption (if any) and the uploaded foot image.

Classify into exactly one:
- wound care: presence of wound, signs of infection (redness, swelling, pain, pus, warmth), gangrene, neuropathic/ischaemic/neuroischaemic wounds/ulcers
- nail surgery: ingrown toenail, involuted toenail
- high risk footcare: callus, corns, warts, pathological toenails
- MSK: foot pain, footwear issues, plantar fasciitis, posterior tibial tendon dysfunction, limb length discrepancy, hallux valgus/bunions, metatarsalgia

If the photo shows no obvious pathology, state that plainly (e.g., “No visible wound or infection on the photo”), and use MSK (level 4) unless the caption suggests otherwise.

IMPORTANT: Do NOT set Urgency=1 unless at least ONE of these is visibly/clearly present OR stated by the caption:
open wound OR drainage/pus OR necrosis/black tissue OR spreading redness (lymphangitic streaks) OR malodour OR fever/chills. 
General redness/swelling alone is NOT enough for Urgency 1.

Assign urgency:
- wound care → 1 (most urgent)
- nail surgery → 2
- high risk footcare → 3
- MSK → 4 (least urgent)
Also provide an Initial diagnosis.

Return EXACTLY this format with three dashes (---) separating sections:

[INTERNAL DATA]
Category: <MSK / wound care / nail surgery / high risk footcare>
Diagnosis: <Short diagnosis>
Urgency level: <1 to 4>
Summary: A brief clinical-style note for the podiatrist (what the patient said, duration/severity, infection signs, impression, urgency)
Evidence:
  open_wound: <true|false>
  drainage_pus: <true|false>
  necrosis_black_tissue: <true|false>
  spreading_redness: <true|false>
  general_redness_swelling: <true|false>
  malodour: <true|false>
  fever_chills: <true|false>
RiskFactors:
  diabetes_neuropathy: <true|false>
  recent_trauma: <true|false>
Confidence: <0.0-1.0>

---

[DISPLAY MESSAGE, SH]
Start with:
- 1 → "You need to see a podiatrist urgently."
- 2 → "You should see a podiatrist soon."
- 3 → "This should be checked by a podiatrist."
- 4 → "This is not urgent, but a podiatrist can help manage the issue."
<br><br>
While you wait for your appointment, here's what you should do:<br>
• Tip 1<br>
• Tip 2<br>
• Tip 3<br>
(Do not display internal data to the patient.)`;


    const triageMsgsBase = [
      { role: "system", content: "You are a careful, empathetic podiatry triage assistant." },
      { role: "user", content: [{ type: "text", text: visionPrompt }] }
    ];
    const userPayload = [];
    if (caption && caption.trim()) userPayload.push({ type: "text", text: `Patient caption: ${caption}` });
    userPayload.push({ type: "image_url", image_url: { url: dataUrl } });
    triageMsgsBase.push({ role: "user", content: userPayload });

    async function callVLMOnce() {
      return openai.chat.completions.create({
        model: VLM_MODEL,
        temperature: 0.2,
        messages: triageMsgsBase
      });
    }
    // tiny retry for transient issues
    let completion, attempt = 0;
    while (attempt < 2) {
      try { completion = await callVLMOnce(); break; }
      catch (e) { attempt++; if (attempt >= 2) throw e; }
    }

    const full = completion.choices?.[0]?.message?.content || "";
    const { internal, display: rawDisplay } = splitInternalAndDisplay(full);

    // Parse internal (more robust)
    const rawCategory = grabLine(internal, /Category:\s*([^\n\r]+)/i, "Unknown");
    let category = normalizeCategory(rawCategory);
    const diagnosis = grabLine(internal, /Diagnosis:\s*([^\n\r]+)/i, "Unclear");
    let urgencyLevel = normalizeUrgency(grabLine(internal, /Urgency level:\s*(\d)/i, ""), category);
    let summary = (internal.match(/Summary:\s*([\s\S]*?)$/i)?.[1] || "No summary available.").trim();

    // Make sure summary is never undefined or empty
    if (typeof summary !== "string" || !summary.trim()) {
      summary = "No summary available.";
    }


    // Clean display safely
    let display = rawDisplay.replace(/\[DISPLAY MESSAGE[^\]]*\]/i, "").trim();
    if (!display) {
      // if model forgot the section, synthesize a minimal safe message
      const firstLine =
        urgencyLevel === 1 ? "You need to see a podiatrist urgently." :
          urgencyLevel === 2 ? "You should see a podiatrist soon." :
            urgencyLevel === 3 ? "This should be checked by a podiatrist." :
              "This is not urgent, but a podiatrist can help manage the issue.";
      display = `${firstLine}<br><br>While you wait for your appointment, here's what you should do:<br>• Keep the area clean and dry<br>• Avoid tight footwear<br>• Reduce load and monitor symptoms`;
    }

    // ================= 3) RULE SAFETY LAYER (same as yours) =================
    {
      const fixed = applyTriageRules({
        category,
        urgency: urgencyLevel,
        summary,
        freeText: caption,
        probs: undefined
      });
      category = fixed.category;
      urgencyLevel = fixed.urgency;
      if (typeof fixed.summary === "string" && fixed.summary) summary = fixed.summary;
    }

    // --- Evidence flags parsing (NEW) ---
    function pickFlag(re, src) {
      const m = src.match(re);
      if (!m) return false;
      const v = (m[1] || "").trim().toLowerCase();
      return v === "true" || v === "yes";
    }

    const evidence = {
      openWound: pickFlag(/open_wound:\s*(true|false)/i, internal),
      drainagePus: pickFlag(/drainage_pus:\s*(true|false)/i, internal),
      necrosis: pickFlag(/necrosis_black_tissue:\s*(true|false)/i, internal),
      spreadingRedness: pickFlag(/spreading_redness:\s*(true|false)/i, internal),
      generalRedness: pickFlag(/general_redness_swelling:\s*(true|false)/i, internal),
      malodour: pickFlag(/malodour:\s*(true|false)/i, internal),
      feverChills: pickFlag(/fever_chills:\s*(true|false)/i, internal),
      diabetesNeuropathy: pickFlag(/diabetes_neuropathy:\s*(true|false)/i, internal),
      recentTrauma: pickFlag(/recent_trauma:\s*(true|false)/i, internal),
    };

    const strongInfection =
      evidence.openWound ||
      evidence.drainagePus ||
      evidence.necrosis ||
      evidence.spreadingRedness ||
      evidence.malodour ||
      evidence.feverChills;

    // If the model set level 1 but we don't have strong infection evidence,
    // don't auto-escalate. Ask the user to confirm like your non-urgent flow.
    if (urgencyLevel === 1 && !strongInfection) {
      console.log("🧯 Downgrading Urgency 1 (no strong infection evidence). Evidence:", evidence);

      s.state = "confirm_infection_check";
      // propose a cautious level 2 by default
      s.proposed = { category, diagnosis, urgencyLevel: 2, summary, display, language: userLanguage };

      const confirmMsg =
        "❓ Can you confirm you do NOT have ANY open wounds, pus, signs of infections, fever/chills?";
      return res.json({ reply: await translateReply(confirmMsg, userLanguage) });
    }

    // Debug: show what the model 'saw'
    console.log("🔎 Evidence flags:", evidence, "| strongInfection:", strongInfection);


    // Make sure the summary is valid before saving to session
    if (typeof summary !== "string" || !summary.trim()) {
      summary = "No summary available.";
    }

    s.urgencyLevel = urgencyLevel;
    s.category = category;
    s.diagnosis = diagnosis;
    s.summary = summary;
    s.cleanedDisplay = display;


    // ===== DEBUG LOGGING =====
    console.log("🧠 Image triage result:");
    console.log("Category:", category);
    console.log("Diagnosis:", diagnosis);
    console.log("Urgency level:", urgencyLevel);
    console.log("Summary:", summary);
    console.log("=========================");

     // ================= UPLOAD IMAGE TO FIREBASE STORAGE =================
    let imageUrl = null;
    try {
      const timestamp = Date.now();
      const fileExtension = req.file.mimetype.split('/')[1];
      const fileName = `patient_images/${userId}_${timestamp}.${fileExtension}`;
      const file = bucket.file(fileName);

      await file.save(req.file.buffer, {
        metadata: {
          contentType: req.file.mimetype,
          metadata: {
            patientId: userId,
            uploadedAt: new Date().toISOString(),
            caption: caption || ''
          }
        }
      });

      await file.makePublic();
      imageUrl = `https://storage.googleapis.com/${bucket.name}/${fileName}`;
      s.imageUrl = imageUrl;
      console.log("✅ Image uploaded:", imageUrl);
    } catch (err) {
      console.error("⚠️ Storage upload failed:", err);
    }

    // ================= 4) Confirm infection if NOT urgent (unchanged behavior) =================
    if (urgencyLevel !== 1) {
      s.state = "confirm_infection_check";
      s.proposed = { category, diagnosis, urgencyLevel, summary, display, language: userLanguage };

      const confirmMsg =
        "❓ I don’t clearly see an open wound, pus, black tissue, red streaks, or fever/chills. " +
        "Can you confirm you do NOT have ANY of these symptoms right now? (yes/no)";

      return res.json({ reply: await translateReply(confirmMsg, userLanguage) });
    }

    // ================= 5) Availability & booking flow (IDENTICAL to yours) =================
    {
      const now = new Date();
      let minDate = new Date(now);
      let maxDate = new Date(now);

      const existingSnap = await db.collection("Appointments")
        .where("patientId", "==", userId)
        .where("status", "==", "scheduled")
        .orderBy("scheduledDate")
        .get();

      if (!existingSnap.empty) {
        const existingAppt = existingSnap.docs[0].data();
        const existingUrgency = existingAppt?.urgencyLevel ?? 4;

        if (existingSnap.size > 1) {
          display = `⚠️ You have ${existingSnap.size} upcoming appointments.<br>` +
            `Please ensure this new issue is necessary to book.<br><br>` +
            display;
        }

        if (urgencyLevel >= existingUrgency) {
          const nextHalfHour = new Date(existingAppt.scheduledDate.toDate().getTime() + 30 * 60 * 1000);

          const followUpSnap = await db.collection("Availability")
            .where("status", "==", "available")
            .where("availableDate", "==", admin.firestore.Timestamp.fromDate(nextHalfHour))
            .where("podId", "==", existingAppt.podId)
            .limit(1)
            .get();

          if (!followUpSnap.empty) {
            const slotDoc = followUpSnap.docs[0];
            const slotData = slotDoc.data();

            const formattedDate = new Date(slotData.availableDate.toDate()).toLocaleString("en-SG", {
              weekday: "long", year: "numeric", month: "long", day: "numeric",
              hour: "2-digit", minute: "2-digit", hour12: true, timeZone: "Asia/Singapore"
            });

            s.state = "awaiting_confirmation";
            s.pendingSlot = slotDoc;
            s.pendingSlotData = slotData;

            return res.json({
              reply: await translateReply(
                `${display}<br><br>📌 You already have an appointment scheduled. I found a follow-up slot right after it on <b>${formattedDate}</b> with podiatrist <b>${slotData.podId}</b>.<br>Would you like to book this additional slot?`,
                userLanguage
              )
            });
          }

          minDate = new Date(existingAppt.scheduledDate.toDate());
        }
      }

      // Urgency → window (same mapping)
      if (urgencyLevel === 1) {
        minDate.setDate(now.getDate());
        maxDate.setDate(now.getDate() + 2);
      } else if (urgencyLevel === 2) {
        minDate.setDate(now.getDate() + 1);
        maxDate.setDate(now.getDate() + 7);
      } else if (urgencyLevel === 3) {
        const threeDaysLater = new Date();
        threeDaysLater.setDate(threeDaysLater.getDate() + 3);
        minDate = threeDaysLater;
        
        const twoWeeksLater = new Date();
        twoWeeksLater.setDate(twoWeeksLater.getDate() + 14);
        maxDate = twoWeeksLater;
      } else {
        const fiveDaysLater = new Date();
        fiveDaysLater.setDate(fiveDaysLater.getDate() + 5);
        minDate = fiveDaysLater;
        
        const threeWeeksLater = new Date();
        threeWeeksLater.setDate(threeWeeksLater.getDate() + 21);
        maxDate = threeWeeksLater;
      }

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
          reply: await translateReply(`${display}\n\n⚠️ Sorry no appointments slots are found, please contact us.`, userLanguage)
        });
      }

      const slotDoc = slotQuery.docs[0];
      const slotData = slotDoc.data();

      const formattedDate = new Date(
        slotData.availableDate.toDate ? slotData.availableDate.toDate() : slotData.availableDate
      ).toLocaleString("en-SG", {
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
      s.cleanedDisplay = display;

      const responseMessage = `${display.trim()}<br><br>📅 I found a slot on <b>${formattedDate}</b> with podiatrist <b>${slotData.podId}</b>. Would you like to book this appointment?`;
      return res.json({ reply: await translateReply(responseMessage, userLanguage) });
    }

  } catch (err) {
    console.error("❌ /patient/chat-image error:", err);
    return res.json({ reply: "⚠️ Image analysis failed on the server." });
  }
});

*/


router.post("/reset-session", (req, res) => {
  const { patientId } = req.body;
  delete session[patientId]; // Clear server memory for that user
  res.json({ success: true });
});




module.exports = router;