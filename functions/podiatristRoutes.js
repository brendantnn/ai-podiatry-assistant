// // // ========================================
// // // PODIATRIST ROUTES – FULL + FIXED VERSION
// // // ========================================
// // const express = require("express");
// // const router = express.Router();
// // const { db, admin } = require("./firebase");

// // function normalizeAppointment(doc) {
// //   const data = doc.data();

// //   return {
// //     apptId: doc.id,
// //     patientId: data.patientId || data.patient_id || "",
// //     name: data.patientName || data.name || "",
// //     category: data.category || "",
// //     initialDiagnosis: data.initialDiagnosis || data.diagnosis || "",
// //     summary: data.summary || "",
// //     date: data.date || data.scheduledDate || "",
// //     time: data.time || data.scheduledTime || "",
// //     urgencyLevel: data.urgencyLevel || 4,
// //     status: data.status || "scheduled",
// //     podId: data.podId || "",
// //   };
// // }


// // /* ============================================================
// //    1) GET ALL APPOINTMENTS FOR POD (QUEUE TAB) - FIXED
// //    ============================================================ */
// // router.post("/podiatrist-get-appointments-all", async (req, res) => {
// //   const { podId } = req.body;

// //   try {
// //     console.log('📊 Fetching appointments for pod:', podId);
    
// //     // 🔧 FIX: Remove orderBy to avoid composite index requirement
// //     const snapshot = await db.collection("Appointments")
// //       .where("podId", "==", podId)
// //       .where("status", "==", "scheduled")
// //       .get();

// //     console.log(`📊 Found ${snapshot.size} appointments for pod ${podId}`);

// //     const appointments = [];

// //     for (const doc of snapshot.docs) {
// //       const data = doc.data();

// //       // Fetch patient details
// //       const patientSnap = await db.collection("Users")
// //         .where("userId", "==", data.patientId)
// //         .limit(1)
// //         .get();
// //       const patientData = !patientSnap.empty ? patientSnap.docs[0].data() : {};

// //       // Format date and time safely
// //       let formattedDate = 'TBD';
// //       let formattedTime = 'TBD';
// //       let sortableDate = new Date(0);
      
// //       if (data.scheduledDate && data.scheduledDate.toDate) {
// //         const dateObj = data.scheduledDate.toDate();
// //         sortableDate = dateObj;
// //         formattedDate = dateObj.toLocaleDateString("en-SG", {
// //           day: "numeric",
// //           month: "long",
// //           year: "numeric"
// //         });
// //         formattedTime = dateObj.toLocaleTimeString("en-SG", {
// //           hour: "2-digit",
// //           minute: "2-digit",
// //           hour12: true
// //         });
// //       }

// //       appointments.push({
// //         apptId: doc.id,
// //         patientId: data.patientId,
// //         name: `${patientData.firstName || ""} ${patientData.lastName || ""}`.trim() || "Unknown Patient",
// //         category: data.category || "General",
// //         initialDiagnosis: data.initialDiagnosis || "Assessment pending",
// //         date: formattedDate,
// //         time: formattedTime,
// //         status: data.status,
// //         urgencyLevel: data.urgencyLevel || 4,
// //         summary: data.summary || "No summary available",
// //         podId: data.podId,
// //         imageUrl: data.imageUrl || null,           // ← ADD THIS
// //         imageCaption: null,   // ← ADD THIS
// //         sortableDate: sortableDate
// //       });
// //     }

// //     // 🔧 FIX: Sort in memory
// //     appointments.sort((a, b) => {
// //       if (a.urgencyLevel !== b.urgencyLevel) {
// //         return a.urgencyLevel - b.urgencyLevel;
// //       }
// //       return a.sortableDate - b.sortableDate;
// //     });

// //     // Remove sortableDate before sending
// //     appointments.forEach(apt => delete apt.sortableDate);

// //     console.log(`✅ Returning ${appointments.length} appointments for pod ${podId}`);
// //     res.json({ success: true, appointments });

// //   } catch (err) {
// //     console.error("❌ Error fetching appointments:", err);
// //     console.error("Error details:", err.message, err.code);
// //     res.status(500).json({ 
// //       success: false, 
// //       error: err.message,
// //       errorCode: err.code,
// //       appointments: []
// //     });
// //   }
// // });

// // /* ============================================================
// //    2) GET ALL APPOINTMENTS (ALL PATIENTS TAB) - FIXED
// //    ============================================================ */
// // router.post("/get-all-appointments", async (req, res) => {
// //   try {
// //     console.log('📊 Fetching all appointments...');
    
// //     // 🔧 FIX: Remove orderBy to avoid composite index requirement
// //     // We'll sort in memory instead
// //     const snapshot = await db.collection("Appointments")
// //       .where("status", "in", ["scheduled", "completed", "cancelled"])
// //       .get();

// //     console.log(`📊 Found ${snapshot.size} total appointments`);

// //     const appointments = [];

// //     for (const doc of snapshot.docs) {
// //       const data = doc.data();

// //       // Fetch patient details
// //       const patientSnap = await db.collection("Users")
// //         .where("userId", "==", data.patientId)
// //         .limit(1)
// //         .get();
// //       const patientData = !patientSnap.empty ? patientSnap.docs[0].data() : {};

// //       // Format date and time safely
// //       let formattedDate = 'TBD';
// //       let formattedTime = 'TBD';
// //       let sortableDate = new Date(0); // Default to epoch for sorting
      
// //       if (data.scheduledDate && data.scheduledDate.toDate) {
// //         const dateObj = data.scheduledDate.toDate();
// //         sortableDate = dateObj;
// //         formattedDate = dateObj.toLocaleDateString("en-SG", {
// //           day: "numeric",
// //           month: "long",
// //           year: "numeric"
// //         });
// //         formattedTime = dateObj.toLocaleTimeString("en-SG", {
// //           hour: "2-digit",
// //           minute: "2-digit",
// //           hour12: true
// //         });
// //       }

// //       appointments.push({
// //         apptId: doc.id,
// //         patientId: data.patientId,
// //         name: `${patientData.firstName || ""} ${patientData.lastName || ""}`.trim() || "Unknown Patient",
// //         category: data.category || "General",
// //         initialDiagnosis: data.initialDiagnosis || "Assessment pending",
// //         date: formattedDate,
// //         time: formattedTime,
// //         status: data.status,
// //         urgencyLevel: data.urgencyLevel || 4,
// //         summary: data.summary || "No summary available",
// //         podId: data.podId || "unassigned",
// //         imageUrl: data.imageUrl || null,           // ← ADD THIS
// //         imageCaption: null,   // ← ADD THIS
// //         sortableDate: sortableDate // For sorting
// //       });
// //     }

// //     // 🔧 FIX: Sort in memory instead of using Firestore orderBy
// //     appointments.sort((a, b) => {
// //       // First sort by urgency (1 = most urgent)
// //       if (a.urgencyLevel !== b.urgencyLevel) {
// //         return a.urgencyLevel - b.urgencyLevel;
// //       }
// //       // Then by date (earliest first)
// //       return a.sortableDate - b.sortableDate;
// //     });

// //     // Remove sortableDate before sending (not needed on client)
// //     appointments.forEach(apt => delete apt.sortableDate);

// //     console.log(`✅ Returning ${appointments.length} formatted appointments`);
// //     res.json({ success: true, appointments });

// //   } catch (err) {
// //     console.error("❌ Error fetching all appointments:", err);
// //     console.error("Error details:", err.message, err.code);
// //     res.status(500).json({ 
// //       success: false, 
// //       error: err.message,
// //       errorCode: err.code,
// //       appointments: [] // Return empty array on error
// //     });
// //   }
// // });

// // /* ============================================================
// //    3) GET PODIATRIST CALENDAR APPOINTMENTS
// //    ============================================================ */
// // router.post("/podiatrist-get-calendar", async (req, res) => {
// //   const { podId } = req.body;

// //   try {
// //     const snapshot = await db.collection("Appointments")
// //       .where("podId", "==", podId)
// //       .where("status", "==", "scheduled")
// //       .get();

// //     const appointments = [];

// //     for (const doc of snapshot.docs) {
// //       const data = doc.data();

// //       const patientSnap = await db.collection("Users")
// //         .where("userId", "==", data.patientId)
// //         .limit(1)
// //         .get();
// //       const patientData = !patientSnap.empty ? patientSnap.docs[0].data() : {};

// //       appointments.push({
// //         apptId: doc.id,
// //         patient: `${patientData.firstName || ""} ${patientData.lastName || ""}`.trim(),
// //         patientId: data.patientId,
// //         date: data.scheduledDate.toDate().toLocaleDateString("en-SG", {
// //           day: "numeric",
// //           month: "long",
// //           year: "numeric"
// //         }),
// //         time: data.scheduledDate.toDate().toLocaleTimeString("en-SG", {
// //           hour: "2-digit",
// //           minute: "2-digit",
// //           hour12: true
// //         }),
// //         category: data.category,
// //         initialDiagnosis: data.initialDiagnosis,
// //         urgencyLevel: data.urgencyLevel,
// //         summary: data.summary
// //       });
// //     }

// //     res.json({ success: true, appointments });

// //   } catch (err) {
// //     console.error("Error fetching calendar:", err);
// //     res.status(500).json({ success: false, error: err.message });
// //   }
// // });

// // /* ============================================================
// //    4) UPDATE APPOINTMENT
// //    ============================================================ */
// // router.post("/podiatrist-update-appointment", async (req, res) => {
// //   const { apptId, updateData } = req.body;

// //   try {
// //     const [date, time] = updateData.split(" ");
// //     const [year, month, day] = date.split("-");
// //     const [hours, minutes] = time.split(":");

// //     const newTimestamp = admin.firestore.Timestamp.fromDate(
// //       new Date(year, month - 1, day, hours, minutes)
// //     );

// //     await db.collection("Appointments").doc(apptId).update({
// //       scheduledDate: newTimestamp
// //     });

// //     res.json({ success: true });

// //   } catch (err) {
// //     console.error("Error updating appointment:", err);
// //     res.status(500).json({ success: false, error: err.message });
// //   }
// // });

// // /* ============================================================
// //    5) CANCEL APPOINTMENT
// //    ============================================================ */
// // router.post("/podiatrist-cancel-appointment", async (req, res) => {
// //   const { apptId } = req.body;

// //   try {
// //     await db.collection("Appointments").doc(apptId).update({
// //       status: "cancelled"
// //     });

// //     res.json({ success: true });

// //   } catch (err) {
// //     console.error("Error cancelling appointment:", err);
// //     res.status(500).json({ success: false, error: err.message });
// //   }
// // });

// // /* ============================================================
// //    6) DASHBOARD METRICS
// //    ============================================================ */
// // router.post("/get-dashboard-metrics", async (req, res) => {
// //   const { podiatristId } = req.body;

// //   try {
// //     const allAppts = await db.collection("Appointments")
// //       .where("podId", "==", podiatristId)
// //       .get();

// //     const scheduled = allAppts.docs.filter(doc => doc.data().status === "scheduled");
// //     const urgent = scheduled.filter(doc => doc.data().urgencyLevel <= 2);
// //     const completed = allAppts.docs.filter(doc => doc.data().status === "completed");

// //     res.json({
// //       success: true,
// //       metrics: {
// //         totalAppointments: scheduled.length,
// //         urgentCases: urgent.length,
// //         completedAppointments: completed.length
// //       }
// //     });

// //   } catch (err) {
// //     console.error("Error fetching metrics:", err);
// //     res.status(500).json({ success: false, error: err.message });
// //   }
// // });

// // /* ============================================================
// //    7) NOTIFICATIONS
// //    ============================================================ */
// // router.post("/get-notifications", async (req, res) => {
// //   const { podId } = req.body;

// //   try {
// //     const now = new Date();
// //     const next24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);

// //     const snapshot = await db.collection("Appointments")
// //       .where("podId", "==", podId)
// //       .where("status", "==", "scheduled")
// //       .get();

// //     const notifications = [];

// //     snapshot.forEach(doc => {
// //       const data = doc.data();
// //       const apptDate = data.scheduledDate.toDate();

// //       if (data.urgencyLevel === 1) {
// //         notifications.push({
// //           type: "urgent",
// //           message: `Urgent: ${data.patientId} - ${data.category}`,
// //           timestamp: data.triageDateTime?.toDate() || now,
// //           appointmentId: doc.id,
// //           patientId: data.patientId
// //         });

// //       } else if (apptDate >= now && apptDate <= next24h) {
// //         notifications.push({
// //           type: "upcoming",
// //           message: `Upcoming: ${data.patientId} in ${Math.round((apptDate - now) / 3600000)}h`,
// //           timestamp: now,
// //           appointmentId: doc.id,
// //           patientId: data.patientId
// //         });
// //       }
// //     });

// //     res.json({ success: true, notifications });

// //   } catch (err) {
// //     console.error("Error fetching notifications:", err);
// //     res.status(500).json({ success: false, error: err.message });
// //   }
// // });

// // /* ============================================================
// //    8) GET PODIATRIST NAME
// //    ============================================================ */
// // router.post("/get-podiatrist-name", async (req, res) => {
// //   const { podId } = req.body;

// //   try {
// //     const snapshot = await db.collection("Users")
// //       .where("userId", "==", podId)
// //       .where("role", "==", "podiatrist")
// //       .limit(1)
// //       .get();

// //     if (snapshot.empty) {
// //       return res.json({ success: false, message: "Podiatrist not found" });
// //     }

// //     const doc = snapshot.docs[0].data();
// //     const name = `${doc.firstName || ""} ${doc.lastName || ""}`.trim();

// //     res.json({ success: true, name });

// //   } catch (err) {
// //     console.error("Error fetching podiatrist name:", err);
// //     res.status(500).json({ success: false, error: err.message });
// //   }
// // });

// // /* ============================================================
// //    9) AI CHAT ROUTE (placeholder)
// //    ============================================================ */
// // router.post("/podiatrist-chat", async (req, res) => {
// //   const { message } = req.body;
// //   try {
// //     res.json({
// //       reply: `AI response for: ${message}`,
// //       patientData: null
// //     });

// //   } catch (err) {
// //     console.error("Error in AI chat:", err);
// //     res.status(500).json({ error: err.message });
// //   }
// // });

// // /* ============================================================
// //    10) GET SCHEDULE BY DATE
// //    ============================================================ */
// // router.post("/get-schedule-by-date", async (req, res) => {
// //   const { podId, podiatristId, targetDate } = req.body;
// //   const actualPodId = podId || podiatristId;

// //   try {
// //     let query = db.collection("Appointments")
// //       .where("podId", "==", actualPodId)
// //       .where("status", "==", "scheduled");

// //     if (targetDate && targetDate !== "all" && targetDate !== "today") {
// //       const [year, month, day] = targetDate.split("-");
// //       const start = new Date(year, month - 1, day, 0, 0, 0);
// //       const end = new Date(year, month - 1, day, 23, 59, 59);

// //       query = query
// //         .where("scheduledDate", ">=", admin.firestore.Timestamp.fromDate(start))
// //         .where("scheduledDate", "<=", admin.firestore.Timestamp.fromDate(end));
// //     }

// //     const snapshot = await query.get();

// //     const appointments = snapshot.docs.map(doc => ({
// //       scheduledDateTime: doc.data().scheduledDate.toDate().toISOString(),
// //       patientId: doc.data().patientId,
// //       category: doc.data().category,
// //       urgencyLevel: doc.data().urgencyLevel
// //     }));

// //     res.json({
// //       success: true,
// //       appointments,
// //       isEmpty: appointments.length === 0,
// //       date: targetDate
// //     });

// //   } catch (err) {
// //     console.error("Error fetching schedule:", err);
// //     res.status(500).json({ success: false, error: err.message });
// //   }
// // });

// // /* ============================================================
// //    11) GET URGENT CASES (NEW – REQUIRED BY AI CHAT)
// //    ============================================================ */
// // router.post("/get-urgent-cases", async (req, res) => {
// //   const { podId, podiatristId } = req.body;
// //   const actualPodId = podId || podiatristId;

// //   try {
// //     const snapshot = await db.collection("Appointments")
// //       .where("podId", "==", actualPodId)
// //       .where("status", "==", "scheduled")
// //       .where("urgencyLevel", "<=", 2)
// //       .orderBy("urgencyLevel", "asc")
// //       .orderBy("scheduledDate", "asc")
// //       .get();

// //     const urgentCases = [];

// //     for (const doc of snapshot.docs) {
// //       const data = doc.data();

// //       const patientSnap = await db.collection("Users")
// //         .where("userId", "==", data.patientId)
// //         .limit(1)
// //         .get();
// //       const patient = !patientSnap.empty ? patientSnap.docs[0].data() : {};

// //       urgentCases.push({
// //         apptId: doc.id,
// //         patientId: data.patientId,
// //         patientName: `${patient.firstName || ""} ${patient.lastName || ""}`.trim(),
// //         urgencyLevel: data.urgencyLevel,
// //         urgencyText: data.urgencyLevel === 1 ? "🚨 Urgent" : "⚠️ High",
// //         category: data.category,
// //         initialDiagnosis: data.initialDiagnosis,
// //         summary: data.summary,
// //         scheduledDate: data.scheduledDate.toDate().toLocaleString("en-SG", {
// //           day: "numeric",
// //           month: "long",
// //           year: "numeric",
// //           hour: "2-digit",
// //           minute: "2-digit",
// //           hour12: true
// //         })
// //       });
// //     }

// //     res.json({ success: true, urgentCases });

// //   } catch (err) {
// //     console.error("Error fetching urgent cases:", err);
// //     res.status(500).json({ success: false, error: err.message });
// //   }
// // });

// // /* ============================================================
// //    12) GET UPCOMING APPOINTMENTS (New)
// //    ============================================================ */
// // router.post("/get-upcoming-appointments", async (req, res) => {
// //   const { podId, podiatristId } = req.body;
// //   const actualPodId = podId || podiatristId;

// //   try {
// //     const now = new Date();
// //     const weekLater = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

// //     const snapshot = await db.collection("Appointments")
// //       .where("podId", "==", actualPodId)
// //       .where("status", "==", "scheduled")
// //       .where("scheduledDate", ">=", admin.firestore.Timestamp.fromDate(now))
// //       .where("scheduledDate", "<=", admin.firestore.Timestamp.fromDate(weekLater))
// //       .orderBy("scheduledDate", "asc")
// //       .get();

// //     const upcoming = [];

// //     for (const doc of snapshot.docs) {
// //       const data = doc.data();

// //       const patientSnap = await db.collection("Users")
// //         .where("userId", "==", data.patientId)
// //         .limit(1)
// //         .get();
// //       const patient = !patientSnap.empty ? patientSnap.docs[0].data() : {};

// //       upcoming.push({
// //         apptId: doc.id,
// //         patientId: data.patientId,
// //         patientName: `${patient.firstName || ""} ${patient.lastName || ""}`.trim(),
// //         urgencyLevel: data.urgencyLevel,
// //         category: data.category,
// //         initialDiagnosis: data.initialDiagnosis,
// //         summary: data.summary,
// //         scheduledDate: data.scheduledDate.toDate().toLocaleString()
// //       });
// //     }

// //     res.json({ success: true, upcomingAppointments: upcoming });

// //   } catch (err) {
// //     console.error("Error fetching upcoming appointments:", err);
// //     res.status(500).json({ success: false, error: err.message });
// //   }
// // });

// // /* ============================================================
// //    13) GET UPCOMING CASE SUMMARIES (AI Feature)
// //    ============================================================ */
// // router.post("/get-upcoming-case-summaries", async (req, res) => {
// //   const { podId, podiatristId } = req.body;
// //   const actualPodId = podId || podiatristId;

// //   try {
// //     const now = new Date();

// //     const snapshot = await db.collection("Appointments")
// //       .where("podId", "==", actualPodId)
// //       .where("status", "==", "scheduled")
// //       .orderBy("scheduledDate", "asc")
// //       .get();

// //     const cases = [];

// //     for (const doc of snapshot.docs) {
// //       const data = doc.data();

// //       const patientSnap = await db.collection("Users")
// //         .where("userId", "==", data.patientId)
// //         .limit(1)
// //         .get();
// //       const patient = !patientSnap.empty ? patientSnap.docs[0].data() : {};

// //       cases.push({
// //         apptId: doc.id,
// //         patientId: data.patientId,
// //         patientName: `${patient.firstName || ""} ${patient.lastName || ""}`.trim(),
// //         category: data.category,
// //         initialDiagnosis: data.initialDiagnosis,
// //         summary: data.summary,
// //         urgencyLevel: data.urgencyLevel,
// //         scheduledDate: data.scheduledDate.toDate().toLocaleString()
// //       });
// //     }

// //     res.json({ success: true, upcomingSummaries: cases });

// //   } catch (err) {
// //     console.error("Error fetching case summaries:", err);
// //     res.status(500).json({ success: false, error: err.message });
// //   }
// // });

// // /* ============================================================
// //    14) GET APPOINTMENTS FOR CALENDAR (calendar.js) - FIXED
// //    ============================================================ */
// // router.post("/podiatrist-get-appointments-scheduled", async (req, res) => {
// //   const { podId } = req.body;

// //   try {
// //     console.log('📅 Fetching scheduled appointments for calendar, pod:', podId);
    
// //     const snapshot = await db.collection("Appointments")
// //       .where("podId", "==", podId)
// //       .where("status", "==", "scheduled")
// //       .orderBy("scheduledDate", "asc")
// //       .get();

// //     console.log(`📅 Found ${snapshot.size} scheduled appointments for pod ${podId}`);

// //     const appointments = snapshot.docs.map(doc => {
// //       const data = doc.data();
      
// //       return {
// //         apptId: doc.id,
// //         patientId: data.patientId,
// //         urgencyLevel: data.urgencyLevel || 4,
// //         scheduledDate: data.scheduledDate.toDate().toISOString(),
// //         category: data.category || 'general',
// //         initialDiagnosis: data.initialDiagnosis || 'Assessment pending',
// //         summary: data.summary || 'No summary available'
// //       };
// //     });

// //     console.log('✅ Returning formatted appointments for calendar');
// //     res.json({ success: true, appointments });

// //   } catch (err) {
// //     console.error("❌ Error fetching scheduled appointments:", err);
// //     res.status(500).json({ 
// //       success: false, 
// //       error: err.message,
// //       appointments: []
// //     });
// //   }
// // });

// // /* ============================================================
// //    15) GET PODIATRIST AVAILABILITY (calendar.js)
// //    ============================================================ */
// // router.post("/podiatrist-get-availability", async (req, res) => {
// //   const { podId } = req.body;

// //   try {
// //     const snapshot = await db.collection("Appointments")
// //       .where("podId", "==", podId)
// //       .where("status", "==", "scheduled")
// //       .get();

// //     const slots = snapshot.docs.map(d => d.data().scheduledDate.toDate().toISOString());

// //     res.json({ success: true, bookedSlots: slots });

// //   } catch (err) {
// //     console.error("Error fetching availability:", err);
// //     res.status(500).json({ success: false, error: err.message });
// //   }
// // });

// // // EXPORT ROUTER
// // module.exports = router;

// // ========================================
// // COMPLETE PODIATRIST ROUTES - EXTRACTED FROM SERVER.JS
// // ========================================
// const express = require("express");
// const router = express.Router();
// const { db, admin } = require("./firebase");
// const { OpenAI } = require("openai");

// // Initialize OpenAI
// const openai = new OpenAI({
//   apiKey: process.env.OPENAI_API_KEY || "REMOVED_OPENAI_API_KEY"
// });

// // CACHE FOR FASTER RESPONSES
// let scheduleCache = new Map();
// const CACHE_DURATION = 30000; // 30 seconds

// function getCacheKey(targetDate, podiatristId) {
//   return `${targetDate}-${podiatristId}`;
// }

// function isValidCache(cacheEntry) {
//   return cacheEntry && (Date.now() - cacheEntry.timestamp) < CACHE_DURATION;
// }

// /* ============================================================
//    1) PODIATRIST AI CHAT
//    ============================================================ */
// router.post("/podiatrist-chat", async (req, res) => {
//   const userMessage = req.body.message;
//   const podiatristId = req.body.podiatristId || "pod_1";

//   try {
//     console.log('🤖 Podiatrist chat message:', userMessage);

//     // DETECT APPOINTMENT ANALYSIS REQUEST
//     const appointmentAnalysisPattern = /analyze appointment (\w+) for patient (patient_\d+)/i;
//     const appointmentMatch = userMessage.match(appointmentAnalysisPattern);
    
//     if (appointmentMatch) {
//       const appointmentId = appointmentMatch[1];
//       const patientId = appointmentMatch[2];
      
//       console.log('🔍 Analyzing specific appointment:', appointmentId, 'for patient:', patientId);
      
//       try {
//         // GET THE SPECIFIC APPOINTMENT BY ID
//         const appointmentDoc = await db.collection("Appointments").doc(appointmentId).get();
        
//         if (!appointmentDoc.exists) {
//           return res.json({
//             reply: "❌ **Appointment Not Found**\n\nThe specified appointment could not be found in the system.",
//             patientData: null
//           });
//         }
        
//         const appointmentData = appointmentDoc.data();
        
//         // Get patient details
//         let patientDetails = null;
//         try {
//           const userQuery = await db.collection("Users")
//             .where("userId", "==", patientId)
//             .limit(1)
//             .get();
          
//           if (!userQuery.empty) {
//             const userData = userQuery.docs[0].data();
//             patientDetails = {
//               name: `${userData.firstName} ${userData.lastName}`.trim(),
//               email: userData.email,
//               phone: userData.phoneNumber
//             };
//           }
//         } catch (e) {
//           console.error("Error fetching patient details:", e);
//         }

//         // Create system prompt with appointment details
//         const systemPrompt = `You are a clinical AI assistant for podiatrists at Singapore General Hospital.

// CURRENT USER: Dr. ${req.body.podiatristName || 'Unknown'}

// SPECIFIC APPOINTMENT ANALYSIS:
// - Patient: ${patientDetails ? patientDetails.name : patientId}
// - Appointment ID: ${appointmentId}
// - Status: ${appointmentData.status}
// - Date: ${appointmentData.scheduledDate ? appointmentData.scheduledDate.toDate().toLocaleDateString("en-SG") : 'Unknown'}
// - Category: ${appointmentData.category || 'Unknown'}
// - Urgency: ${appointmentData.urgencyLevel || 'Unknown'}
// - Initial Diagnosis: ${appointmentData.initialDiagnosis || 'Assessment pending'}
// - Summary: ${appointmentData.summary || 'No summary available'}

// Provide clinical analysis and recommendations for this specific scheduled appointment.`;

//         const chatCompletion = await openai.chat.completions.create({
//           model: "gpt-3.5-turbo",
//           messages: [
//             {
//               role: "system",
//               content: systemPrompt
//             },
//             {
//               role: "user",
//               content: `Provide clinical analysis for this appointment case.`
//             },
//           ],
//         });

//         return res.json({
//           reply: chatCompletion.choices[0].message.content,
//           patientData: patientDetails
//         });
        
//       } catch (error) {
//         console.error("❌ Error analyzing specific appointment:", error);
//         return res.json({
//           reply: "❌ **Error Analyzing Appointment**\n\nUnable to retrieve appointment details. Please try again.",
//           patientData: null
//         });
//       }
//     }

//     // GENERAL AI RESPONSE (no specific appointment)
//     const systemPrompt = `You are an AI clinical assistant for podiatrists at Singapore General Hospital.

// CURRENT USER: Dr. ${req.body.podiatristName || 'Unknown'}

// You help with clinical queries, patient management, and medical knowledge.
// Keep responses professional and evidence-based.`;

//     const chatCompletion = await openai.chat.completions.create({
//       model: "gpt-3.5-turbo",
//       messages: [
//         {
//           role: "system",
//           content: systemPrompt
//         },
//         {
//           role: "user",
//           content: userMessage
//         },
//       ],
//     });

//     return res.json({
//       reply: chatCompletion.choices[0].message.content,
//       patientData: null
//     });

//   } catch (err) {
//     console.error("❌ Podiatrist chat error:", err);
//     return res.status(500).json({ reply: "Something went wrong with the clinical assistant." });
//   }
// });

// /* ============================================================
//    2) GET ALL APPOINTMENTS (QUEUE TAB)
//    ============================================================ */
// router.post('/podiatrist-get-appointments-all', async (req, res) => {
//   const { podId } = req.body;
//   console.log("📊 Fetching queue info for:", podId);

//   try {
//     // Get appointments
//     const apptSnapshot = await db.collection("Appointments")
//       .where("podId", "==", podId)
//       .get();

//     let appointments = [];
//     if (!apptSnapshot.empty) {
//       const patientIds = [];

//       apptSnapshot.docs.forEach(doc => {
//         const appt = doc.data();
//         patientIds.push(appt.patientId);

//         // Add data to appointment object
//         const appointment = {
//           apptId: doc.id,
//           patientId: appt.patientId,
//           date: appt.scheduledDate.toDate().toLocaleDateString('en-SG', { year: 'numeric', month: 'long', day: 'numeric' }),
//           time: appt.scheduledDate.toDate().toLocaleTimeString('en-SG', { hour: '2-digit', minute: '2-digit', hour12: true }),
//           status: appt.status,
//           urgencyLevel: appt.urgencyLevel,
//           category: appt.category,
//           initialDiagnosis: appt.initialDiagnosis,
//           summary: appt.summary,
//           imageUrl: appt.imageUrl || null,
//           imageCaption: null
//         };
//         appointments.push(appointment);
//       });

//       // Get patient names
//       const userSnapshots = await db.collection("Users")
//         .where("userId", "in", patientIds)
//         .get();

//       const userMap = {};
//       userSnapshots.docs.forEach(userDoc => {
//         const userData = userDoc.data();
//         userMap[userData.userId] = userData.firstName + " " + userData.lastName;
//       });

//       // Add patient names to appointments
//       appointments = appointments.map(appt => ({
//         ...appt,
//         name: userMap[appt.patientId] || "Unknown"
//       }));

//       return res.json({
//         appointments
//       });

//     } else {
//       console.log("❌ No Appointments found");
//       return res.json({
//         response: "No Appointments Found",
//         appointments: null
//       });
//     }
//   } catch (error) {
//     console.error("❌ Error in /podiatrist-get-appointments-all:", error);
//     res.status(500).json({ error: "Failed to fetch all appointments" });
//   }
// });

// /* ============================================================
//    3) GET SCHEDULED APPOINTMENTS (CALENDAR)
//    ============================================================ */
// router.post('/podiatrist-get-appointments-scheduled', async (req, res) => {
//   const { podId } = req.body;
//   console.log("📅 Fetching calendar info for:", podId);

//   try {
//     // Get appointments
//     const apptSnapshot = await db.collection("Appointments")
//       .where("podId", "==", podId)
//       .where("status", "==", "scheduled")
//       .get();

//     let appointments = [];
//     if (!apptSnapshot.empty) {
//       const patientIds = [];

//       apptSnapshot.docs.forEach(doc => {
//         const appt = doc.data();
//         patientIds.push(appt.patientId);

//         const appointment = {
//           apptId: doc.id,
//           patientId: appt.patientId,
//           date: appt.scheduledDate.toDate().toLocaleDateString('en-SG', { year: 'numeric', month: 'long', day: 'numeric' }),
//           time: appt.scheduledDate.toDate().toLocaleTimeString('en-SG', { hour: '2-digit', minute: '2-digit', hour12: true }),
//           urgencyLevel: appt.urgencyLevel || 3,
//           category: appt.category || 'General',
//           initialDiagnosis: appt.initialDiagnosis || 'Assessment pending',
//           summary: appt.summary || 'No case summary available',
//           imageUrl: appt.imageUrl || null,
//           imageCaption: null
//         };
//         appointments.push(appointment);
//       });

//       // Get patient names
//       const userSnapshots = await db.collection("Users")
//         .where("userId", "in", patientIds)
//         .get();

//       const userMap = {};
//       userSnapshots.docs.forEach(userDoc => {
//         const userData = userDoc.data();
//         userMap[userData.userId] = userData.firstName + " " + userData.lastName;
//       });

//       // Add patient names
//       appointments = appointments.map(appt => ({
//         ...appt,
//         patient: userMap[appt.patientId] || "Unknown"
//       }));

//       return res.json({
//         appointments
//       });

//     } else {
//       console.log("❌ No Appointments found");
//       return res.json({
//         response: "No Appointments Found",
//         appointments: null
//       });
//     }
//   } catch (error) {
//     console.error("❌ Error in /podiatrist-get-appointments-scheduled:", error);
//     res.status(500).json({ error: "Failed to fetch scheduled appointments" });
//   }
// });

// /* ============================================================
//    4) UPDATE APPOINTMENT
//    ============================================================ */
// router.post('/podiatrist-update-appointment', async (req, res) => {
//   const { appointmentId, newDate, newTime, originalSlot } = req.body;
//   console.log("✏️ Updating appointment:", appointmentId);

//   try {
//     const appointmentRef = db.collection("Appointments").doc(appointmentId);
//     const appointmentDoc = await appointmentRef.get();

//     if (!appointmentDoc.exists) {
//       return res.status(404).json({ success: false, error: "Appointment not found" });
//     }

//     // Parse new date and time
//     const [year, month, day] = newDate.split('-');
//     const [hours, minutes] = newTime.split(':');
//     const newDateTime = new Date(year, month - 1, day, hours, minutes);

//     // Update appointment
//     await appointmentRef.update({
//       scheduledDate: admin.firestore.Timestamp.fromDate(newDateTime),
//       updatedAt: admin.firestore.Timestamp.now()
//     });

//     console.log("✅ Appointment updated successfully");
//     res.json({ success: true, message: "Appointment updated successfully" });

//   } catch (error) {
//     console.error("❌ Error updating appointment:", error);
//     res.status(500).json({ success: false, error: "Failed to update appointment" });
//   }
// });

// /* ============================================================
//    5) CANCEL APPOINTMENT
//    ============================================================ */
// router.post('/podiatrist-cancel-appointment', async (req, res) => {
//   const { appointmentId } = req.body;
//   console.log("🚫 Cancelling appointment:", appointmentId);

//   try {
//     const appointmentRef = db.collection("Appointments").doc(appointmentId);
//     const appointmentDoc = await appointmentRef.get();

//     if (!appointmentDoc.exists) {
//       return res.status(404).json({ success: false, error: "Appointment not found" });
//     }

//     // Update status to cancelled
//     await appointmentRef.update({
//       status: "cancelled",
//       cancelledAt: admin.firestore.Timestamp.now()
//     });

//     console.log("✅ Appointment cancelled successfully");
//     res.json({ success: true, message: "Appointment cancelled successfully" });

//   } catch (error) {
//     console.error("❌ Error cancelling appointment:", error);
//     res.status(500).json({ success: false, error: "Failed to cancel appointment" });
//   }
// });

// /* ============================================================
//    6) GET AVAILABILITY
//    ============================================================ */
// router.post('/podiatrist-get-availability', async (req, res) => {
//   const { podId } = req.body;
//   console.log("📅 Fetching availability for:", podId);

//   try {
//     const snapshot = await db.collection("Appointments")
//       .where("podId", "==", podId)
//       .where("status", "==", "scheduled")
//       .get();

//     const bookedSlots = snapshot.docs.map(doc => {
//       const data = doc.data();
//       return data.scheduledDate.toDate().toISOString();
//     });

//     res.json({ success: true, bookedSlots });

//   } catch (error) {
//     console.error("❌ Error fetching availability:", error);
//     res.status(500).json({ success: false, error: "Failed to fetch availability" });
//   }
// });

// /* ============================================================
//    7) GET PODIATRIST NAME
//    ============================================================ */
// router.post("/get-podiatrist-name", async (req, res) => {
//   const { podId } = req.body;

//   try {
//     const snapshot = await db.collection("Users")
//       .where("userId", "==", podId)
//       .where("role", "==", "podiatrist")
//       .limit(1)
//       .get();

//     if (snapshot.empty) {
//       return res.json({ success: false, message: "Podiatrist not found" });
//     }

//     const doc = snapshot.docs[0].data();
//     const name = `${doc.firstName || ""} ${doc.lastName || ""}`.trim();

//     res.json({ success: true, name });

//   } catch (err) {
//     console.error("Error fetching podiatrist name:", err);
//     res.status(500).json({ success: false, error: err.message });
//   }
// });

// // EXPORT ROUTER
// module.exports = router;

// ========================================
// COMPLETE PODIATRIST ROUTES - ALL ENDPOINTS
// ========================================
const express = require("express");
const router = express.Router();
const { db, admin } = require("./firebase");
const { OpenAI } = require("openai");

// Initialize OpenAI - Use environment variable in production
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || "REMOVED_OPENAI_API_KEY"
});

// CACHE FOR FASTER RESPONSES
let scheduleCache = new Map();
const CACHE_DURATION = 30000; // 30 seconds

function getCacheKey(targetDate, podiatristId) {
  return `${targetDate}-${podiatristId}`;
}

function isValidCache(cacheEntry) {
  return cacheEntry && (Date.now() - cacheEntry.timestamp) < CACHE_DURATION;
}

/* ============================================================
   1) PODIATRIST AI CHAT
   ============================================================ */
router.post("/podiatrist-chat", async (req, res) => {
  const userMessage = req.body.message;
  const podiatristId = req.body.podiatristId || "pod_1";

  try {
    console.log('🤖 Podiatrist chat message:', userMessage);

    // DETECT APPOINTMENT ANALYSIS REQUEST
    const appointmentAnalysisPattern = /analyze appointment (\w+) for patient (patient_\d+)/i;
    const appointmentMatch = userMessage.match(appointmentAnalysisPattern);
    
    if (appointmentMatch) {
      const appointmentId = appointmentMatch[1];
      const patientId = appointmentMatch[2];
      
      console.log('🔍 Analyzing specific appointment:', appointmentId, 'for patient:', patientId);
      
      try {
        const appointmentDoc = await db.collection("Appointments").doc(appointmentId).get();
        
        if (!appointmentDoc.exists) {
          return res.json({
            reply: "❌ **Appointment Not Found**\n\nThe specified appointment could not be found in the system.",
            patientData: null
          });
        }
        
        const appointmentData = appointmentDoc.data();
        
        // Get patient details
        let patientDetails = null;
        try {
          const userQuery = await db.collection("Users")
            .where("userId", "==", patientId)
            .limit(1)
            .get();
          
          if (!userQuery.empty) {
            const userData = userQuery.docs[0].data();
            patientDetails = {
              name: `${userData.firstName} ${userData.lastName}`.trim(),
              email: userData.email,
              phone: userData.phoneNumber
            };
          }
        } catch (e) {
          console.error("Error fetching patient details:", e);
        }

        const systemPrompt = `You are a clinical AI assistant for podiatrists at Singapore General Hospital.

CURRENT USER: Dr. ${req.body.podiatristName || 'Unknown'}

SPECIFIC APPOINTMENT ANALYSIS:
- Patient: ${patientDetails ? patientDetails.name : patientId}
- Appointment ID: ${appointmentId}
- Status: ${appointmentData.status}
- Date: ${appointmentData.scheduledDate ? appointmentData.scheduledDate.toDate().toLocaleDateString("en-SG", { timeZone: "Asia/Singapore" }) : 'Unknown'}
- Category: ${appointmentData.category || 'Unknown'}
- Urgency: ${appointmentData.urgencyLevel || 'Unknown'}
- Initial Diagnosis: ${appointmentData.initialDiagnosis || 'Assessment pending'}
- Summary: ${appointmentData.summary || 'No summary available'}

Provide clinical analysis and recommendations for this specific scheduled appointment.`;

        const chatCompletion = await openai.chat.completions.create({
          model: "gpt-3.5-turbo",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: `Provide clinical analysis for this appointment case.` }
          ],
        });

        return res.json({
          reply: chatCompletion.choices[0].message.content,
          patientData: patientDetails
        });
        
      } catch (error) {
        console.error("❌ Error analyzing specific appointment:", error);
        return res.json({
          reply: "❌ **Error Analyzing Appointment**\n\nUnable to retrieve appointment details. Please try again.",
          patientData: null
        });
      }
    }

    // GENERAL AI RESPONSE
    const systemPrompt = `You are an AI clinical assistant for podiatrists at Singapore General Hospital.

CURRENT USER: Dr. ${req.body.podiatristName || 'Unknown'}

You help with clinical queries, patient management, and medical knowledge. Keep responses professional and evidence-based.`;

    const chatCompletion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage }
      ],
    });

    return res.json({
      reply: chatCompletion.choices[0].message.content,
      patientData: null
    });

  } catch (err) {
    console.error("❌ Podiatrist chat error:", err);
    return res.status(500).json({ reply: "Something went wrong with the clinical assistant." });
  }
});

/* ============================================================
   2) GET ALL APPOINTMENTS (QUEUE TAB)
   ============================================================ */
router.post('/podiatrist-get-appointments-all', async (req, res) => {
  const { podId } = req.body;
  console.log("📊 Fetching queue info for:", podId);

  try {
    const apptSnapshot = await db.collection("Appointments")
      .where("podId", "==", podId)
      .get();

    let appointments = [];
    if (!apptSnapshot.empty) {
      const patientIds = [];

      apptSnapshot.docs.forEach(doc => {
        const appt = doc.data();
        patientIds.push(appt.patientId);

        const appointment = {
          apptId: doc.id,
          patientId: appt.patientId,
          date: appt.scheduledDate.toDate().toLocaleDateString('en-SG', { 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric',
            timeZone: 'Asia/Singapore'
          }),
          time: appt.scheduledDate.toDate().toLocaleTimeString('en-SG', { 
            hour: '2-digit', 
            minute: '2-digit', 
            hour12: true,
            timeZone: 'Asia/Singapore'
          }),
          status: appt.status,
          urgencyLevel: appt.urgencyLevel,
          category: appt.category,
          initialDiagnosis: appt.initialDiagnosis,
          summary: appt.summary,
          imageUrl: appt.imageUrl || null,
          imageCaption: appt.imageCaption || null
        };
        appointments.push(appointment);
      });

      const userSnapshots = await db.collection("Users")
        .where("userId", "in", patientIds)
        .get();

      const userMap = {};
      userSnapshots.docs.forEach(userDoc => {
        const userData = userDoc.data();
        userMap[userData.userId] = userData.firstName + " " + userData.lastName;
      });

      appointments = appointments.map(appt => ({
        ...appt,
        name: userMap[appt.patientId] || "Unknown"
      }));

      return res.json({ appointments });

    } else {
      console.log("❌ No Appointments found");
      return res.json({
        response: "No Appointments Found",
        appointments: null
      });
    }
  } catch (error) {
    console.error("❌ Error in /podiatrist-get-appointments-all:", error);
    res.status(500).json({ error: "Failed to fetch all appointments" });
  }
});

/* ============================================================
   3) GET SCHEDULED APPOINTMENTS (CALENDAR)
   ============================================================ */
router.post('/podiatrist-get-appointments-scheduled', async (req, res) => {
  const { podId } = req.body;
  console.log("📅 Fetching calendar info for:", podId);

  try {
    const apptSnapshot = await db.collection("Appointments")
      .where("podId", "==", podId)
      .where("status", "==", "scheduled")
      .get();

    let appointments = [];
    if (!apptSnapshot.empty) {
      const patientIds = [];

      apptSnapshot.docs.forEach(doc => {
        const appt = doc.data();
        patientIds.push(appt.patientId);

        const appointment = {
          apptId: doc.id,
          patientId: appt.patientId,
          date: appt.scheduledDate.toDate().toLocaleDateString('en-SG', { 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric',
            timeZone: 'Asia/Singapore'
          }),
          time: appt.scheduledDate.toDate().toLocaleTimeString('en-SG', { 
            hour: '2-digit', 
            minute: '2-digit', 
            hour12: true,
            timeZone: 'Asia/Singapore'
          }),
          urgencyLevel: appt.urgencyLevel || 3,
          category: appt.category || 'General',
          initialDiagnosis: appt.initialDiagnosis || 'Assessment pending',
          summary: appt.summary || 'No case summary available',
          imageUrl: appt.imageUrl || null,
          imageCaption: appt.imageCaption || null
        };
        appointments.push(appointment);
      });

      const userSnapshots = await db.collection("Users")
        .where("userId", "in", patientIds)
        .get();

      const userMap = {};
      userSnapshots.docs.forEach(userDoc => {
        const userData = userDoc.data();
        userMap[userData.userId] = userData.firstName + " " + userData.lastName;
      });

      appointments = appointments.map(appt => ({
        ...appt,
        patient: userMap[appt.patientId] || "Unknown"
      }));

      return res.json({ appointments });

    } else {
      console.log("❌ No Appointments found");
      return res.json({
        response: "No Appointments Found",
        appointments: null
      });
    }
  } catch (error) {
    console.error("❌ Error in /podiatrist-get-appointments-scheduled:", error);
    res.status(500).json({ error: "Failed to fetch scheduled appointments" });
  }
});

/* ============================================================
   4) UPDATE APPOINTMENT
   ============================================================ */
router.post('/podiatrist-update-appointment', async (req, res) => {
  const { appointmentId, newDate, newTime, originalSlot } = req.body;
  console.log("✏️ Updating appointment:", appointmentId);

  try {
    const appointmentRef = db.collection("Appointments").doc(appointmentId);
    const appointmentDoc = await appointmentRef.get();

    if (!appointmentDoc.exists) {
      return res.status(404).json({ success: false, error: "Appointment not found" });
    }

    const [year, month, day] = newDate.split('-');
    const [hours, minutes] = newTime.split(':');
    const newDateTime = new Date(year, month - 1, day, hours, minutes);

    await appointmentRef.update({
      scheduledDate: admin.firestore.Timestamp.fromDate(newDateTime),
      updatedAt: admin.firestore.Timestamp.now()
    });

    console.log("✅ Appointment updated successfully");
    res.json({ success: true, message: "Appointment updated successfully" });

  } catch (error) {
    console.error("❌ Error updating appointment:", error);
    res.status(500).json({ success: false, error: "Failed to update appointment" });
  }
});

/* ============================================================
   5) CANCEL APPOINTMENT
   ============================================================ */
router.post('/podiatrist-cancel-appointment', async (req, res) => {
  const { appointmentId } = req.body;
  console.log("🚫 Cancelling appointment:", appointmentId);

  try {
    const appointmentRef = db.collection("Appointments").doc(appointmentId);
    const appointmentDoc = await appointmentRef.get();

    if (!appointmentDoc.exists) {
      return res.status(404).json({ success: false, error: "Appointment not found" });
    }

    await appointmentRef.update({
      status: "cancelled",
      cancelledAt: admin.firestore.Timestamp.now()
    });

    console.log("✅ Appointment cancelled successfully");
    res.json({ success: true, message: "Appointment cancelled successfully" });

  } catch (error) {
    console.error("❌ Error cancelling appointment:", error);
    res.status(500).json({ success: false, error: "Failed to cancel appointment" });
  }
});

/* ============================================================
   6) GET AVAILABILITY
   ============================================================ */
router.post('/podiatrist-get-availability', async (req, res) => {
  const { podId } = req.body;
  console.log("📅 Fetching availability for:", podId);

  try {
    const snapshot = await db.collection("Appointments")
      .where("podId", "==", podId)
      .where("status", "==", "scheduled")
      .get();

    const bookedSlots = snapshot.docs.map(doc => {
      const data = doc.data();
      return data.scheduledDate.toDate().toISOString();
    });

    res.json({ success: true, bookedSlots });

  } catch (error) {
    console.error("❌ Error fetching availability:", error);
    res.status(500).json({ success: false, error: "Failed to fetch availability" });
  }
});

/* ============================================================
   7) GET PODIATRIST NAME
   ============================================================ */
router.post("/get-podiatrist-name", async (req, res) => {
  const { podId } = req.body;

  try {
    const snapshot = await db.collection("Users")
      .where("userId", "==", podId)
      .where("role", "==", "podiatrist")
      .limit(1)
      .get();

    if (snapshot.empty) {
      return res.json({ success: false, message: "Podiatrist not found" });
    }

    const doc = snapshot.docs[0].data();
    const name = `${doc.firstName || ""} ${doc.lastName || ""}`.trim();

    res.json({ success: true, name });

  } catch (err) {
    console.error("Error fetching podiatrist name:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/* ============================================================
   8) GET URGENT CASES (AI QUICK QUERY)
   ============================================================ */
router.post("/get-urgent-cases", async (req, res) => {
  const { podiatristId, podId } = req.body;
  const targetPodId = podId || podiatristId;
  
  console.log('🚨 Fetching urgent cases for pod:', targetPodId);

  try {
    const startDate = new Date('2025-01-01T00:00:00Z');
    const endDate = new Date('2025-12-31T23:59:59Z');

    const urgentQuery = await db.collection("Appointments")
      .where("scheduledDate", ">=", admin.firestore.Timestamp.fromDate(startDate))
      .where("scheduledDate", "<=", admin.firestore.Timestamp.fromDate(endDate))
      .where("status", "==", "scheduled")
      .where("podId", "==", targetPodId)
      .get();

    console.log(`📊 Found ${urgentQuery.size} total appointments for pod ${targetPodId}`);

    const urgentAppointments = [];

    for (const appointmentDoc of urgentQuery.docs) {
      const appointment = appointmentDoc.data();

      if (appointment.urgencyLevel === 1 || appointment.urgencyLevel === 2) {
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
          console.log(`⚠️ Patient lookup failed:`, patientError.message);
        }

        const urgentCase = {
          id: appointmentDoc.id,
          patientId: appointment.patientId,
          patientName: patientInfo.name,
          patientPhone: patientInfo.phone,
          patientEmail: patientInfo.email,
          scheduledDate: appointment.scheduledDate.toDate().toLocaleDateString('en-SG', { 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric',
            timeZone: 'Asia/Singapore'
          }),
          scheduledTime: appointment.scheduledDate.toDate().toLocaleTimeString('en-SG', { 
            hour: '2-digit', 
            minute: '2-digit', 
            hour12: true,
            timeZone: 'Asia/Singapore'
          }),
          urgencyLevel: appointment.urgencyLevel,
          urgencyText: appointment.urgencyLevel === 1 ? "🚨 Urgent - Wound Care" : "⚠️ High - Nail Surgery",
          category: appointment.category || 'General',
          initialDiagnosis: appointment.initialDiagnosis || 'Assessment pending',
          summary: appointment.summary || 'No case summary available',
          status: appointment.status,
          podId: appointment.podId
        };

        urgentAppointments.push(urgentCase);
      }
    }

    console.log(`🚨 Found ${urgentAppointments.length} urgent cases for pod ${targetPodId}`);

    return res.json({
      success: true,
      urgentCases: urgentAppointments,
      totalCount: urgentAppointments.length,
      hasUrgentCases: urgentAppointments.length > 0,
      podId: targetPodId,
      message: urgentAppointments.length > 0 ? 
        `Found ${urgentAppointments.length} urgent cases` : 
        `No urgent cases found - all appointments are medium to low priority`
    });

  } catch (error) {
    console.error("❌ Error fetching urgent cases:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to fetch urgent cases",
      urgentCases: [],
      totalCount: 0,
      hasUrgentCases: false
    });
  }
});

/* ============================================================
   9) GET UPCOMING CASE SUMMARIES (AI QUICK QUERY)
   ============================================================ */
router.post("/get-upcoming-case-summaries", async (req, res) => {
  const { podiatristId, podId } = req.body;
  const targetPodId = podId || podiatristId;
  
  console.log('📝 Fetching upcoming case summaries for pod:', targetPodId);

  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const oneWeekFromNow = new Date(today);
    oneWeekFromNow.setDate(today.getDate() + 7);
    oneWeekFromNow.setHours(23, 59, 59, 999);

    const caseSummariesQuery = await db.collection("Appointments")
      .where("scheduledDate", ">=", admin.firestore.Timestamp.fromDate(today))
      .where("scheduledDate", "<=", admin.firestore.Timestamp.fromDate(oneWeekFromNow))
      .where("status", "==", "scheduled")
      .where("podId", "==", targetPodId)
      .orderBy("scheduledDate", "asc")
      .get();

    console.log(`📊 Found ${caseSummariesQuery.size} appointments in next 7 days for pod ${targetPodId}`);

    if (caseSummariesQuery.empty) {
      return res.json({
        success: true,
        caseSummaries: [],
        totalCount: 0,
        podId: targetPodId,
        message: `No appointments scheduled in the next 7 days`
      });
    }

    const caseSummaries = [];

    for (const appointmentDoc of caseSummariesQuery.docs) {
      const appointment = appointmentDoc.data();
      const appointmentDate = appointment.scheduledDate.toDate();

      const timeDiff = appointmentDate - today;
      const daysUntil = Math.ceil(timeDiff / (1000 * 60 * 60 * 24));

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
        console.log(`⚠️ Patient lookup failed:`, patientError.message);
      }

      const getUrgencyText = (level) => {
        switch (level) {
          case 1: return "🚨 Urgent - Wound Care";
          case 2: return "⚠️ High - Nail Surgery";
          case 3: return "📋 Medium - High Risk Footcare";
          case 4: return "📝 Low - MSK";
          default: return "📋 Standard";
        }
      };

      const caseSummary = {
        id: appointmentDoc.id,
        patientId: appointment.patientId,
        patientName: patientInfo.name,
        patientPhone: patientInfo.phone,
        patientEmail: patientInfo.email,
        scheduledDate: appointmentDate.toLocaleDateString('en-SG', { 
          year: 'numeric', 
          month: 'long', 
          day: 'numeric',
          timeZone: 'Asia/Singapore'
        }),
        scheduledTime: appointmentDate.toLocaleTimeString('en-SG', { 
          hour: '2-digit', 
          minute: '2-digit', 
          hour12: true,
          timeZone: 'Asia/Singapore'
        }),
        daysUntil: daysUntil,
        urgencyLevel: appointment.urgencyLevel || 3,
        urgencyText: getUrgencyText(appointment.urgencyLevel || 3),
        category: appointment.category || 'General',
        initialDiagnosis: appointment.initialDiagnosis || 'Assessment pending',
        summary: appointment.summary || 'No case summary available',
        status: appointment.status,
        triageDate: appointment.triageDateTime ? 
          appointment.triageDateTime.toDate().toLocaleDateString('en-SG', { timeZone: 'Asia/Singapore' }) : 'N/A',
        podId: appointment.podId
      };

      caseSummaries.push(caseSummary);
    }

    console.log(`📝 Processed ${caseSummaries.length} case summaries for pod ${targetPodId}`);

    return res.json({
      success: true,
      caseSummaries: caseSummaries,
      totalCount: caseSummaries.length,
      podId: targetPodId,
      message: `Found ${caseSummaries.length} upcoming appointments`
    });

  } catch (error) {
    console.error("❌ Error fetching case summaries:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to fetch case summaries",
      caseSummaries: [],
      totalCount: 0
    });
  }
});

/* ============================================================
   10) GET SCHEDULE BY DATE (AI QUICK QUERY - TODAY)
   ============================================================ */
router.post("/get-schedule-by-date", async (req, res) => {
  const { podiatristId, targetDate, podId } = req.body;
  const targetPodId = podId || podiatristId;
  
  try {
    console.log('📅 Fetching schedule for date:', targetDate, 'pod:', targetPodId);

    let scheduleDate;
    if (targetDate && targetDate !== 'today') {
      scheduleDate = new Date(targetDate + 'T12:00:00+08:00');
    } else {
      scheduleDate = new Date();
    }

    const dateStr = scheduleDate.toISOString().split('T')[0];
    const startOfDay = new Date(dateStr + 'T00:00:00+08:00');
    const endOfDay = new Date(dateStr + 'T23:59:59.999+08:00');

    const appointmentsQuery = await db.collection("Appointments")
      .where("scheduledDate", ">=", admin.firestore.Timestamp.fromDate(startOfDay))
      .where("scheduledDate", "<=", admin.firestore.Timestamp.fromDate(endOfDay))
      .where("status", "==", "scheduled")
      .where("podId", "==", targetPodId)
      .get();

    console.log(`📊 Found ${appointmentsQuery.size} appointments for ${dateStr}`);

    if (appointmentsQuery.empty) {
      return res.json({
        success: true,
        appointments: [],
        totalCount: 0,
        message: `No appointments scheduled for ${scheduleDate.toLocaleDateString("en-SG", { timeZone: "Asia/Singapore" })}`
      });
    }

    const appointments = [];

    for (const appointmentDoc of appointmentsQuery.docs) {
      const appointment = appointmentDoc.data();

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
        appointmentId: appointmentDoc.id,
        patientId: appointment.patientId,
        patientName,
        scheduledDateTime: scheduledDate.toLocaleString("en-SG", {
          weekday: "short",
          month: "short",
          day: "numeric",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
          hour12: true,
          timeZone: "Asia/Singapore"
        }),
        category: appointment.category || "General",
        urgencyLevel: appointment.urgencyLevel || 4,
        initialDiagnosis: appointment.initialDiagnosis || 'Assessment pending',
        summary: appointment.summary || 'No summary available'
      });
    }

    console.log(`✅ Returning ${appointments.length} appointments`);

    return res.json({
      success: true,
      appointments: appointments,
      totalCount: appointments.length
    });

  } catch (error) {
    console.error("❌ Error fetching schedule:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to fetch schedule",
      appointments: [],
      totalCount: 0
    });
  }
});

// EXPORT ROUTER
module.exports = router;