// ========================================
// PODIATRIST ROUTES – FULL + FIXED VERSION
// ========================================
const express = require("express");
const router = express.Router();
const { db, admin, bucket } = require("./firebase");

function normalizeAppointment(doc) {
  const data = doc.data();

  return {
    apptId: doc.id,
    patientId: data.patientId || data.patient_id || "",
    name: data.patientName || data.name || "",
    category: data.category || "",
    initialDiagnosis: data.initialDiagnosis || data.diagnosis || "",
    summary: data.summary || "",
    date: data.date || data.scheduledDate || "",
    time: data.time || data.scheduledTime || "",
    urgencyLevel: data.urgencyLevel || 4,
    status: data.status || "scheduled",
    podId: data.podId || "",
    imageUrl: appt.imageUrl || null,        // ← ADD THIS
    imageCaption: null  // ← ADD THIS
  };
}


/* ============================================================
   1) GET ALL APPOINTMENTS FOR POD (QUEUE TAB) - FIXED
   ============================================================ */
router.post("/podiatrist-get-appointments-all", async (req, res) => {
  const { podId } = req.body;

  try {
    console.log('📊 Fetching appointments for pod:', podId);
    
    // 🔧 FIX: Remove orderBy to avoid composite index requirement
    const snapshot = await db.collection("Appointments")
      .where("podId", "==", podId)
      .where("status", "==", "scheduled")
      .get();

    console.log(`📊 Found ${snapshot.size} appointments for pod ${podId}`);

    const appointments = [];

    for (const doc of snapshot.docs) {
      const data = doc.data();

      // Fetch patient details
      const patientSnap = await db.collection("Users")
        .where("userId", "==", data.patientId)
        .limit(1)
        .get();
      const patientData = !patientSnap.empty ? patientSnap.docs[0].data() : {};

      // Format date and time safely
      let formattedDate = 'TBD';
      let formattedTime = 'TBD';
      let sortableDate = new Date(0);
      
      if (data.scheduledDate && data.scheduledDate.toDate) {
        const dateObj = data.scheduledDate.toDate();
        sortableDate = dateObj;
        formattedDate = dateObj.toLocaleDateString("en-SG", {
          day: "numeric",
          month: "long",
          year: "numeric"
        });
        formattedTime = dateObj.toLocaleTimeString("en-SG", {
          hour: "2-digit",
          minute: "2-digit",
          hour12: true
        });
      }

      appointments.push({
        apptId: doc.id,
        patientId: data.patientId,
        name: `${patientData.firstName || ""} ${patientData.lastName || ""}`.trim() || "Unknown Patient",
        category: data.category || "General",
        initialDiagnosis: data.initialDiagnosis || "Assessment pending",
        date: formattedDate,
        time: formattedTime,
        status: data.status,
        urgencyLevel: data.urgencyLevel || 4,
        summary: data.summary || "No summary available",
        podId: data.podId,
        sortableDate: sortableDate,
        imageUrl: appt.imageUrl || null,        // ← ADD THIS
        imageCaption: null  // ← ADD THIS
      });
    }

    // 🔧 FIX: Sort in memory
    appointments.sort((a, b) => {
      if (a.urgencyLevel !== b.urgencyLevel) {
        return a.urgencyLevel - b.urgencyLevel;
      }
      return a.sortableDate - b.sortableDate;
    });

    // Remove sortableDate before sending
    appointments.forEach(apt => delete apt.sortableDate);

    console.log(`✅ Returning ${appointments.length} appointments for pod ${podId}`);
    res.json({ success: true, appointments });

  } catch (err) {
    console.error("❌ Error fetching appointments:", err);
    console.error("Error details:", err.message, err.code);
    res.status(500).json({ 
      success: false, 
      error: err.message,
      errorCode: err.code,
      appointments: []
    });
  }
});

/* ============================================================
   2) GET ALL APPOINTMENTS (ALL PATIENTS TAB) - FIXED
   ============================================================ */
router.post("/get-all-appointments", async (req, res) => {
  try {
    console.log('📊 Fetching all appointments...');
    
    // 🔧 FIX: Remove orderBy to avoid composite index requirement
    // We'll sort in memory instead
    const snapshot = await db.collection("Appointments")
      .where("status", "in", ["scheduled", "completed", "cancelled"])
      .get();

    console.log(`📊 Found ${snapshot.size} total appointments`);

    const appointments = [];

    for (const doc of snapshot.docs) {
      const data = doc.data();

      // Fetch patient details
      const patientSnap = await db.collection("Users")
        .where("userId", "==", data.patientId)
        .limit(1)
        .get();
      const patientData = !patientSnap.empty ? patientSnap.docs[0].data() : {};

      // Format date and time safely
      let formattedDate = 'TBD';
      let formattedTime = 'TBD';
      let sortableDate = new Date(0); // Default to epoch for sorting
      
      if (data.scheduledDate && data.scheduledDate.toDate) {
        const dateObj = data.scheduledDate.toDate();
        sortableDate = dateObj;
        formattedDate = dateObj.toLocaleDateString("en-SG", {
          day: "numeric",
          month: "long",
          year: "numeric"
        });
        formattedTime = dateObj.toLocaleTimeString("en-SG", {
          hour: "2-digit",
          minute: "2-digit",
          hour12: true
        });
      }

      appointments.push({
        apptId: doc.id,
        patientId: data.patientId,
        name: `${patientData.firstName || ""} ${patientData.lastName || ""}`.trim() || "Unknown Patient",
        category: data.category || "General",
        initialDiagnosis: data.initialDiagnosis || "Assessment pending",
        date: formattedDate,
        time: formattedTime,
        status: data.status,
        urgencyLevel: data.urgencyLevel || 4,
        summary: data.summary || "No summary available",
        podId: data.podId || "unassigned",
        sortableDate: sortableDate, // For sorting
        imageUrl: appt.imageUrl || null,        // ← ADD THIS
        imageCaption: appt.imageCaption || null  // ← ADD THIS
      });
    }

    // 🔧 FIX: Sort in memory instead of using Firestore orderBy
    appointments.sort((a, b) => {
      // First sort by urgency (1 = most urgent)
      if (a.urgencyLevel !== b.urgencyLevel) {
        return a.urgencyLevel - b.urgencyLevel;
      }
      // Then by date (earliest first)
      return a.sortableDate - b.sortableDate;
    });

    // Remove sortableDate before sending (not needed on client)
    appointments.forEach(apt => delete apt.sortableDate);

    console.log(`✅ Returning ${appointments.length} formatted appointments`);
    res.json({ success: true, appointments });

  } catch (err) {
    console.error("❌ Error fetching all appointments:", err);
    console.error("Error details:", err.message, err.code);
    res.status(500).json({ 
      success: false, 
      error: err.message,
      errorCode: err.code,
      appointments: [] // Return empty array on error
    });
  }
});

/* ============================================================
   3) GET PODIATRIST CALENDAR APPOINTMENTS
   ============================================================ */
router.post("/podiatrist-get-calendar", async (req, res) => {
  const { podId } = req.body;

  try {
    const snapshot = await db.collection("Appointments")
      .where("podId", "==", podId)
      .where("status", "==", "scheduled")
      .get();

    const appointments = [];

    for (const doc of snapshot.docs) {
      const data = doc.data();

      const patientSnap = await db.collection("Users")
        .where("userId", "==", data.patientId)
        .limit(1)
        .get();
      const patientData = !patientSnap.empty ? patientSnap.docs[0].data() : {};

      appointments.push({
        apptId: doc.id,
        patient: `${patientData.firstName || ""} ${patientData.lastName || ""}`.trim(),
        patientId: data.patientId,
        date: data.scheduledDate.toDate().toLocaleDateString("en-SG", {
          day: "numeric",
          month: "long",
          year: "numeric"
        }),
        time: data.scheduledDate.toDate().toLocaleTimeString("en-SG", {
          hour: "2-digit",
          minute: "2-digit",
          hour12: true
        }),
        category: data.category,
        initialDiagnosis: data.initialDiagnosis,
        urgencyLevel: data.urgencyLevel,
        summary: data.summary
      });
    }

    res.json({ success: true, appointments });

  } catch (err) {
    console.error("Error fetching calendar:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/* ============================================================
   4) UPDATE APPOINTMENT
   ============================================================ */
router.post("/podiatrist-update-appointment", async (req, res) => {
  const { apptId, updateData } = req.body;

  try {
    const [date, time] = updateData.split(" ");
    const [year, month, day] = date.split("-");
    const [hours, minutes] = time.split(":");

    const newTimestamp = admin.firestore.Timestamp.fromDate(
      new Date(year, month - 1, day, hours, minutes)
    );

    await db.collection("Appointments").doc(apptId).update({
      scheduledDate: newTimestamp
    });

    res.json({ success: true });

  } catch (err) {
    console.error("Error updating appointment:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/* ============================================================
   5) CANCEL APPOINTMENT
   ============================================================ */
router.post("/podiatrist-cancel-appointment", async (req, res) => {
  const { apptId } = req.body;

  try {
    await db.collection("Appointments").doc(apptId).update({
      status: "cancelled"
    });

    res.json({ success: true });

  } catch (err) {
    console.error("Error cancelling appointment:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/* ============================================================
   6) DASHBOARD METRICS
   ============================================================ */
router.post("/get-dashboard-metrics", async (req, res) => {
  const { podiatristId } = req.body;

  try {
    const allAppts = await db.collection("Appointments")
      .where("podId", "==", podiatristId)
      .get();

    const scheduled = allAppts.docs.filter(doc => doc.data().status === "scheduled");
    const urgent = scheduled.filter(doc => doc.data().urgencyLevel <= 2);
    const completed = allAppts.docs.filter(doc => doc.data().status === "completed");

    res.json({
      success: true,
      metrics: {
        totalAppointments: scheduled.length,
        urgentCases: urgent.length,
        completedAppointments: completed.length
      }
    });

  } catch (err) {
    console.error("Error fetching metrics:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/* ============================================================
   7) NOTIFICATIONS
   ============================================================ */
router.post("/get-notifications", async (req, res) => {
  const { podId } = req.body;

  try {
    const now = new Date();
    const next24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    const snapshot = await db.collection("Appointments")
      .where("podId", "==", podId)
      .where("status", "==", "scheduled")
      .get();

    const notifications = [];

    snapshot.forEach(doc => {
      const data = doc.data();
      const apptDate = data.scheduledDate.toDate();

      if (data.urgencyLevel === 1) {
        notifications.push({
          type: "urgent",
          message: `Urgent: ${data.patientId} - ${data.category}`,
          timestamp: data.triageDateTime?.toDate() || now,
          appointmentId: doc.id,
          patientId: data.patientId
        });

      } else if (apptDate >= now && apptDate <= next24h) {
        notifications.push({
          type: "upcoming",
          message: `Upcoming: ${data.patientId} in ${Math.round((apptDate - now) / 3600000)}h`,
          timestamp: now,
          appointmentId: doc.id,
          patientId: data.patientId
        });
      }
    });

    res.json({ success: true, notifications });

  } catch (err) {
    console.error("Error fetching notifications:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/* ============================================================
   8) GET PODIATRIST NAME
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
   9) AI CHAT ROUTE (placeholder)
   ============================================================ */
router.post("/podiatrist-chat", async (req, res) => {
  const { message } = req.body;
  try {
    res.json({
      reply: `AI response for: ${message}`,
      patientData: null
    });

  } catch (err) {
    console.error("Error in AI chat:", err);
    res.status(500).json({ error: err.message });
  }
});

/* ============================================================
   10) GET SCHEDULE BY DATE
   ============================================================ */
router.post("/get-schedule-by-date", async (req, res) => {
  const { podId, podiatristId, targetDate } = req.body;
  const actualPodId = podId || podiatristId;

  try {
    let query = db.collection("Appointments")
      .where("podId", "==", actualPodId)
      .where("status", "==", "scheduled");

    if (targetDate && targetDate !== "all" && targetDate !== "today") {
      const [year, month, day] = targetDate.split("-");
      const start = new Date(year, month - 1, day, 0, 0, 0);
      const end = new Date(year, month - 1, day, 23, 59, 59);

      query = query
        .where("scheduledDate", ">=", admin.firestore.Timestamp.fromDate(start))
        .where("scheduledDate", "<=", admin.firestore.Timestamp.fromDate(end));
    }

    const snapshot = await query.get();

    const appointments = snapshot.docs.map(doc => ({
      scheduledDateTime: doc.data().scheduledDate.toDate().toISOString(),
      patientId: doc.data().patientId,
      category: doc.data().category,
      urgencyLevel: doc.data().urgencyLevel
    }));

    res.json({
      success: true,
      appointments,
      isEmpty: appointments.length === 0,
      date: targetDate
    });

  } catch (err) {
    console.error("Error fetching schedule:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/* ============================================================
   11) GET URGENT CASES (NEW – REQUIRED BY AI CHAT)
   ============================================================ */
router.post("/get-urgent-cases", async (req, res) => {
  const { podId, podiatristId } = req.body;
  const actualPodId = podId || podiatristId;

  try {
    const snapshot = await db.collection("Appointments")
      .where("podId", "==", actualPodId)
      .where("status", "==", "scheduled")
      .where("urgencyLevel", "<=", 2)
      .orderBy("urgencyLevel", "asc")
      .orderBy("scheduledDate", "asc")
      .get();

    const urgentCases = [];

    for (const doc of snapshot.docs) {
      const data = doc.data();

      const patientSnap = await db.collection("Users")
        .where("userId", "==", data.patientId)
        .limit(1)
        .get();
      const patient = !patientSnap.empty ? patientSnap.docs[0].data() : {};

      urgentCases.push({
        apptId: doc.id,
        patientId: data.patientId,
        patientName: `${patient.firstName || ""} ${patient.lastName || ""}`.trim(),
        urgencyLevel: data.urgencyLevel,
        urgencyText: data.urgencyLevel === 1 ? "🚨 Urgent" : "⚠️ High",
        category: data.category,
        initialDiagnosis: data.initialDiagnosis,
        summary: data.summary,
        scheduledDate: data.scheduledDate.toDate().toLocaleString("en-SG", {
          day: "numeric",
          month: "long",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
          hour12: true
        })
      });
    }

    res.json({ success: true, urgentCases });

  } catch (err) {
    console.error("Error fetching urgent cases:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/* ============================================================
   12) GET UPCOMING APPOINTMENTS (New)
   ============================================================ */
router.post("/get-upcoming-appointments", async (req, res) => {
  const { podId, podiatristId } = req.body;
  const actualPodId = podId || podiatristId;

  try {
    const now = new Date();
    const weekLater = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    const snapshot = await db.collection("Appointments")
      .where("podId", "==", actualPodId)
      .where("status", "==", "scheduled")
      .where("scheduledDate", ">=", admin.firestore.Timestamp.fromDate(now))
      .where("scheduledDate", "<=", admin.firestore.Timestamp.fromDate(weekLater))
      .orderBy("scheduledDate", "asc")
      .get();

    const upcoming = [];

    for (const doc of snapshot.docs) {
      const data = doc.data();

      const patientSnap = await db.collection("Users")
        .where("userId", "==", data.patientId)
        .limit(1)
        .get();
      const patient = !patientSnap.empty ? patientSnap.docs[0].data() : {};

      upcoming.push({
        apptId: doc.id,
        patientId: data.patientId,
        patientName: `${patient.firstName || ""} ${patient.lastName || ""}`.trim(),
        urgencyLevel: data.urgencyLevel,
        category: data.category,
        initialDiagnosis: data.initialDiagnosis,
        summary: data.summary,
        scheduledDate: data.scheduledDate.toDate().toLocaleString()
      });
    }

    res.json({ success: true, upcomingAppointments: upcoming });

  } catch (err) {
    console.error("Error fetching upcoming appointments:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/* ============================================================
   13) GET UPCOMING CASE SUMMARIES (AI Feature)
   ============================================================ */
router.post("/get-upcoming-case-summaries", async (req, res) => {
  const { podId, podiatristId } = req.body;
  const actualPodId = podId || podiatristId;

  try {
    const now = new Date();

    const snapshot = await db.collection("Appointments")
      .where("podId", "==", actualPodId)
      .where("status", "==", "scheduled")
      .orderBy("scheduledDate", "asc")
      .get();

    const cases = [];

    for (const doc of snapshot.docs) {
      const data = doc.data();

      const patientSnap = await db.collection("Users")
        .where("userId", "==", data.patientId)
        .limit(1)
        .get();
      const patient = !patientSnap.empty ? patientSnap.docs[0].data() : {};

      cases.push({
        apptId: doc.id,
        patientId: data.patientId,
        patientName: `${patient.firstName || ""} ${patient.lastName || ""}`.trim(),
        category: data.category,
        initialDiagnosis: data.initialDiagnosis,
        summary: data.summary,
        urgencyLevel: data.urgencyLevel,
        scheduledDate: data.scheduledDate.toDate().toLocaleString()
      });
    }

    res.json({ success: true, upcomingSummaries: cases });

  } catch (err) {
    console.error("Error fetching case summaries:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/* ============================================================
   14) GET APPOINTMENTS FOR CALENDAR (calendar.js) - FIXED
   ============================================================ */
router.post("/podiatrist-get-appointments-scheduled", async (req, res) => {
  const { podId } = req.body;

  try {
    console.log('📅 Fetching scheduled appointments for calendar, pod:', podId);
    
    const snapshot = await db.collection("Appointments")
      .where("podId", "==", podId)
      .where("status", "==", "scheduled")
      .orderBy("scheduledDate", "asc")
      .get();

    console.log(`📅 Found ${snapshot.size} scheduled appointments for pod ${podId}`);

    const appointments = snapshot.docs.map(doc => {
      const data = doc.data();
      
      return {
        apptId: doc.id,
        patientId: data.patientId,
        urgencyLevel: data.urgencyLevel || 4,
        scheduledDate: data.scheduledDate.toDate().toISOString(),
        category: data.category || 'general',
        initialDiagnosis: data.initialDiagnosis || 'Assessment pending',
        summary: data.summary || 'No summary available'
      };
    });

    console.log('✅ Returning formatted appointments for calendar');
    res.json({ success: true, appointments });

  } catch (err) {
    console.error("❌ Error fetching scheduled appointments:", err);
    res.status(500).json({ 
      success: false, 
      error: err.message,
      appointments: []
    });
  }
});

/* ============================================================
   15) GET PODIATRIST AVAILABILITY (calendar.js)
   ============================================================ */
router.post("/podiatrist-get-availability", async (req, res) => {
  const { podId } = req.body;

  try {
    const snapshot = await db.collection("Appointments")
      .where("podId", "==", podId)
      .where("status", "==", "scheduled")
      .get();

    const slots = snapshot.docs.map(d => d.data().scheduledDate.toDate().toISOString());

    res.json({ success: true, bookedSlots: slots });

  } catch (err) {
    console.error("Error fetching availability:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// EXPORT ROUTER
module.exports = router;