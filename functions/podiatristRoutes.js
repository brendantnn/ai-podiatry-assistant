// ========================================
// COMPLETE PODIATRIST ROUTES - ALL ENDPOINTS
// Migrated from server.js for Firebase hosting
// ========================================
const express = require("express");
const router = express.Router();
const { db, admin } = require("./firebase");
const { OpenAI } = require("openai");

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || "REMOVED_OPENAI_API_KEY"
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

// Helper function for urgency text
function getUrgencyText(level) {
  switch (level) {
    case 1: return "🚨 Urgent - Wound Care";
    case 2: return "⚠️ High - Nail Surgery";
    case 3: return "📋 Medium - High Risk Footcare";
    case 4: return "📝 Low - MSK";
    default: return "📋 Standard";
  }
}

/* ============================================================
   1) PODIATRIST CHAT (AI ASSISTANT)
   ============================================================ */
router.post("/podiatrist-chat", async (req, res) => {
  const userMessage = req.body.message;
  const podiatristId = req.body.podiatristId || "pod1";

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
        // GET THE SPECIFIC APPOINTMENT BY ID
        const appointmentDoc = await db.collection("Appointments").doc(appointmentId).get();
        
        if (!appointmentDoc.exists) {
          return res.json({
            reply: "❌ **Appointment Not Found**\n\nThe specified appointment could not be found in the system.",
            patientData: null
          });
        }
        
        const appointmentData = appointmentDoc.data();
        console.log('📊 Appointment status:', appointmentData.status);
        
        // CHECK IF THIS SPECIFIC APPOINTMENT IS CANCELLED
        if (appointmentData.status === "cancelled") {
          console.log('🚫 Specific appointment is cancelled');
          
          // Get patient name
          let patientName = patientId;
          try {
            const userQuery = await db.collection("Users")
              .where("userId", "==", patientId)
              .limit(1)
              .get();
            
            if (!userQuery.empty) {
              const userData = userQuery.docs[0].data();
              patientName = `${userData.firstName} ${userData.lastName}`.trim();
            }
          } catch (e) {
            console.log('Could not fetch patient name');
          }
          
          const cancelledResponse = `❌ **Appointment Status: CANCELLED**

**Patient:** ${patientName} (${patientId})
**Appointment ID:** ${appointmentId}
**Original Date:** ${appointmentData.scheduledDate ? appointmentData.scheduledDate.toDate().toLocaleDateString("en-SG") : 'Unknown'}
**Category:** ${appointmentData.category || 'Unknown'}

This appointment has been cancelled and cannot be analyzed for clinical recommendations.

**Next Steps:**
- Contact the patient to reschedule if appropriate
- Review cancellation reason in patient records
- Consider priority rescheduling based on original urgency level

No clinical analysis is available for cancelled appointments.`;

          return res.json({
            reply: cancelledResponse,
            patientData: null
          });
        }
        
        // IF NOT CANCELLED, PROCEED WITH ANALYSIS
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
              gender: userData.gender
            };
          }
        } catch (e) {
          console.log('Could not fetch patient details');
        }
        
        // NORMAL CLINICAL ANALYSIS FOR ACTIVE APPOINTMENT
        const systemPrompt = `You are an AI clinical assistant for podiatrists at Singapore General Hospital.

CURRENT USER: Dr. ${req.body.podiatristName || 'Unknown'}

SPECIFIC APPOINTMENT ANALYSIS:
- Patient: ${patientDetails ? patientDetails.name : patientId}
- Appointment ID: ${appointmentId}
- Status: ${appointmentData.status}
- Date: ${appointmentData.scheduledDate ? appointmentData.scheduledDate.toDate().toLocaleDateString("en-SG") : 'Unknown'}
- Category: ${appointmentData.category || 'Unknown'}
- Urgency: ${appointmentData.urgencyLevel || 'Unknown'}
- Initial Diagnosis: ${appointmentData.initialDiagnosis || 'Assessment pending'}
- Summary: ${appointmentData.summary || 'No summary available'}

Provide clinical analysis and recommendations for this specific scheduled appointment.`;

        const chatCompletion = await openai.chat.completions.create({
          model: "gpt-3.5-turbo",
          messages: [
            {
              role: "system",
              content: systemPrompt
            },
            {
              role: "user",
              content: `Provide clinical analysis for this appointment case.`
            },
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

    // GENERAL AI RESPONSE (no specific appointment)
    const systemPrompt = `You are an AI clinical assistant for podiatrists at Singapore General Hospital.

CURRENT USER: Dr. ${req.body.podiatristName || 'Unknown'}

You help with clinical queries, patient management, and medical knowledge.
Keep responses professional and evidence-based.`;

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
      patientData: null
    });

  } catch (err) {
    console.error("❌ Podiatrist chat error:", err);
    return res.status(500).json({ reply: "Something went wrong with the clinical assistant." });
  }
});

/* ============================================================
   2) GET URGENT CASES
   ============================================================ */
router.post("/get-urgent-cases", async (req, res) => {
  const { podiatristId, podId } = req.body;
  const targetPodId = podId || podiatristId;
  
  console.log('🚨 Fetching urgent cases for pod:', targetPodId);

  if (!targetPodId) {
    return res.status(400).json({
      success: false,
      error: "No podId provided",
      urgentCases: [],
      totalCount: 0
    });
  }

  try {
    const urgentCasesQuery = await db.collection("Appointments")
      .where("podId", "==", targetPodId)
      .where("status", "==", "scheduled")
      .where("urgencyLevel", "in", [1, 2])
      .orderBy("urgencyLevel", "asc")
      .orderBy("scheduledDate", "asc")
      .get();

    console.log(`📊 Found ${urgentCasesQuery.size} urgent cases for pod ${targetPodId}`);

    if (urgentCasesQuery.empty) {
      return res.json({
        success: true,
        urgentCases: [],
        totalCount: 0,
        podId: targetPodId,
        message: 'No urgent cases found'
      });
    }

    const urgentCases = [];

    for (const appointmentDoc of urgentCasesQuery.docs) {
      const appointment = appointmentDoc.data();

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
        urgencyText: getUrgencyText(appointment.urgencyLevel),
        category: appointment.category || 'General',
        initialDiagnosis: appointment.initialDiagnosis || 'Assessment pending',
        summary: appointment.summary || 'No case summary available',
        status: appointment.status,
        podId: appointment.podId
      };

      urgentCases.push(urgentCase);
    }

    console.log(`🚨 Processed ${urgentCases.length} urgent cases for pod ${targetPodId}`);

    return res.json({
      success: true,
      urgentCases: urgentCases,
      totalCount: urgentCases.length,
      podId: targetPodId
    });

  } catch (error) {
    console.error("❌ Error fetching urgent cases:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to fetch urgent cases",
      message: error.message,
      urgentCases: [],
      totalCount: 0
    });
  }
});

/* ============================================================
   3) GET UPCOMING CASE SUMMARIES
   ============================================================ */
router.post("/get-upcoming-case-summaries", async (req, res) => {
  const { podiatristId, podId } = req.body;
  const targetPodId = podId || podiatristId;
  
  console.log('📝 Fetching upcoming case summaries for pod:', targetPodId);

  if (!targetPodId) {
    return res.status(400).json({
      success: false,
      error: "No podId provided",
      caseSummaries: [],
      totalCount: 0
    });
  }

  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const oneWeekFromNow = new Date(today);
    oneWeekFromNow.setDate(today.getDate() + 7);
    oneWeekFromNow.setHours(23, 59, 59, 999);

    const caseSummariesQuery = await db.collection("Appointments")
      .where("podId", "==", targetPodId)
      .where("status", "==", "scheduled")
      .where("scheduledDate", ">=", admin.firestore.Timestamp.fromDate(today))
      .where("scheduledDate", "<=", admin.firestore.Timestamp.fromDate(oneWeekFromNow))
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
      dateRange: {
        start: today.toLocaleDateString('en-SG'),
        end: oneWeekFromNow.toLocaleDateString('en-SG')
      }
    });

  } catch (error) {
    console.error("❌ Error fetching upcoming case summaries:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to fetch upcoming case summaries",
      message: error.message,
      caseSummaries: [],
      totalCount: 0
    });
  }
});

/* ============================================================
   4) GET TODAY'S SCHEDULE
   ============================================================ */
router.post("/get-todays-schedule", async (req, res) => {
  const { podiatristId, podId } = req.body;
  const targetPodId = podId || podiatristId;

  console.log("📅 Fetching today's schedule for pod:", targetPodId);

  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);

    const snapshot = await db.collection("Appointments")
      .where("podId", "==", targetPodId)
      .where("status", "==", "scheduled")
      .where("scheduledDate", ">=", admin.firestore.Timestamp.fromDate(today))
      .where("scheduledDate", "<", admin.firestore.Timestamp.fromDate(tomorrow))
      .orderBy("scheduledDate", "asc")
      .get();

    const appointments = [];
    
    for (const doc of snapshot.docs) {
      const appointment = doc.data();
      
      let patientName = appointment.patientId;
      try {
        const userQuery = await db.collection("Users")
          .where("userId", "==", appointment.patientId)
          .limit(1)
          .get();
        
        if (!userQuery.empty) {
          const userData = userQuery.docs[0].data();
          patientName = `${userData.firstName} ${userData.lastName}`.trim();
        }
      } catch (e) {
        console.log('Could not fetch patient name');
      }

      appointments.push({
        id: doc.id,
        patientId: appointment.patientId,
        patientName: patientName,
        scheduledTime: appointment.scheduledDate.toDate().toLocaleTimeString("en-SG", {
          hour: "2-digit",
          minute: "2-digit",
          hour12: true,
          timeZone: "Asia/Singapore"
        }),
        category: appointment.category || "General",
        urgencyLevel: appointment.urgencyLevel || 3,
        initialDiagnosis: appointment.initialDiagnosis || 'Assessment pending'
      });
    }

    res.json({
      success: true,
      appointments: appointments,
      totalCount: appointments.length,
      date: today.toLocaleDateString("en-SG", { 
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
        timeZone: "Asia/Singapore" 
      })
    });

  } catch (error) {
    console.error("❌ Error fetching today's schedule:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch today's schedule",
      appointments: [],
      totalCount: 0
    });
  }
});

/* ============================================================
   5) GET SCHEDULE BY DATE
   ============================================================ */
router.post("/get-schedule-by-date", async (req, res) => {
  const { podiatristId, podId, targetDate } = req.body;
  const finalPodId = podId || podiatristId;

  console.log("📅 Fetching schedule for date:", targetDate, "pod:", finalPodId);

  // Check cache first
  const cacheKey = getCacheKey(targetDate, finalPodId);
  const cachedData = scheduleCache.get(cacheKey);

  if (isValidCache(cachedData)) {
    console.log('✅ Returning cached schedule data');
    return res.json(cachedData.data);
  }

  try {
    const dateObj = new Date(targetDate);
    dateObj.setHours(0, 0, 0, 0);
    
    const nextDay = new Date(dateObj);
    nextDay.setDate(dateObj.getDate() + 1);

    const snapshot = await db.collection("Appointments")
      .where("podId", "==", finalPodId)
      .where("status", "==", "scheduled")
      .where("scheduledDate", ">=", admin.firestore.Timestamp.fromDate(dateObj))
      .where("scheduledDate", "<", admin.firestore.Timestamp.fromDate(nextDay))
      .orderBy("scheduledDate", "asc")
      .get();

    const appointments = [];
    
    for (const doc of snapshot.docs) {
      const appointment = doc.data();
      
      let patientName = appointment.patientId;
      try {
        const userQuery = await db.collection("Users")
          .where("userId", "==", appointment.patientId)
          .limit(1)
          .get();
        
        if (!userQuery.empty) {
          const userData = userQuery.docs[0].data();
          patientName = `${userData.firstName} ${userData.lastName}`.trim();
        }
      } catch (e) {
        console.log('Could not fetch patient name');
      }

      appointments.push({
        id: doc.id,
        patientId: appointment.patientId,
        patientName: patientName,
        scheduledTime: appointment.scheduledDate.toDate().toLocaleTimeString("en-SG", {
          hour: "2-digit",
          minute: "2-digit",
          hour12: true,
          timeZone: "Asia/Singapore"
        }),
        category: appointment.category || "General",
        urgencyLevel: appointment.urgencyLevel || 3,
        initialDiagnosis: appointment.initialDiagnosis || 'Assessment pending',
        summary: appointment.summary || 'No summary'
      });
    }

    const responseData = {
      success: true,
      appointments: appointments,
      totalCount: appointments.length,
      date: dateObj.toLocaleDateString("en-SG", { 
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
        timeZone: "Asia/Singapore" 
      })
    };

    // Cache the result
    scheduleCache.set(cacheKey, {
      data: responseData,
      timestamp: Date.now()
    });

    res.json(responseData);

  } catch (error) {
    console.error("❌ Error fetching schedule by date:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch schedule",
      appointments: [],
      totalCount: 0
    });
  }
});

/* ============================================================
   6) GET ALL APPOINTMENTS
   ============================================================ */
router.post("/get-all-appointments", async (req, res) => {
  const { podId } = req.body;
  console.log("📊 Fetching all appointments for pod:", podId);

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
          imageCaption: appt.imageCaption || null,
          podId: appt.podId || "unassigned"
        };
        appointments.push(appointment);
      });

      if (patientIds.length > 0) {
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
      }

      return res.json({ 
        success: true,
        appointments 
      });

    } else {
      console.log("❌ No Appointments found");
      return res.json({
        success: true,
        response: "No Appointments Found",
        appointments: []
      });
    }
  } catch (error) {
    console.error("❌ Error in /get-all-appointments:", error);
    res.status(500).json({ success: false, error: "Failed to fetch all appointments" });
  }
});

/* ============================================================
   7) UPDATE APPOINTMENT - FIXED
   ============================================================ */
router.post('/podiatrist-update-appointment', async (req, res) => {
  let { appointmentId, apptId, newDate, newTime, updateData, originalSlot } = req.body;
  
  const finalApptId = appointmentId || apptId;
  
  console.log("✏️ Updating appointment:", finalApptId);

  if (updateData && typeof updateData === 'string') {
    const [datePart, timePart] = updateData.split('T');
    newDate = datePart;
    newTime = timePart;
  }

  if (!finalApptId || !newDate || !newTime) {
    return res.status(400).json({ 
      success: false, 
      error: "Missing required parameters" 
    });
  }

  try {
    const appointmentRef = db.collection("Appointments").doc(finalApptId);
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
   8) CANCEL APPOINTMENT
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
   9) GET AVAILABILITY
   ============================================================ */
router.post('/podiatrist-get-availability', async (req, res) => {
  const { podId } = req.body;
  console.log("📅 Fetching availability for pod:", podId);

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
   10) GET PODIATRIST NAME
   ============================================================ */
router.post("/get-podiatrist-name", async (req, res) => {
  const { podId } = req.body;
  
  try {
    console.log('🔍 Looking up podiatrist name for:', podId);
    
    if (!podId || podId === 'unassigned') {
      return res.json({
        success: true,
        name: 'Unassigned',
        podId: podId
      });
    }
    
    const userQuery = await db.collection("Users")
      .where("userId", "==", podId)
      .get();
    
    if (!userQuery.empty) {
      const userData = userQuery.docs[0].data();
      
      if (userData.role === 'podiatrist') {
        let fullName = '';
        const firstName = userData.firstName || '';
        const lastName = userData.lastName || '';
        
        if (firstName.toLowerCase().startsWith('dr.') || firstName.toLowerCase().startsWith('doctor')) {
          fullName = `${firstName} ${lastName}`.trim();
        } else {
          fullName = `Dr. ${firstName} ${lastName}`.trim();
        }
        
        fullName = fullName
          .replace(/\bundefined\b/g, '')
          .replace(/\s+/g, ' ')
          .trim();
        
        return res.json({
          success: true,
          name: fullName,
          podId: podId
        });
      }
    }
    
    return res.json({
      success: false,
      name: `Podiatrist ${podId}`,
      podId: podId,
      error: 'Podiatrist not found'
    });
    
  } catch (error) {
    console.error('❌ Error fetching podiatrist name:', error);
    return res.status(500).json({
      success: false,
      name: `Podiatrist ${podId}`,
      error: error.message
    });
  }
});

/* ============================================================
   11) GET DASHBOARD METRICS
   ============================================================ */
router.post("/get-dashboard-metrics", async (req, res) => {
  const { podiatristId, podId } = req.body;
  const targetPodId = podId || podiatristId;
  
  console.log('📊 Fetching dashboard metrics for pod:', targetPodId);

  if (!targetPodId) {
    return res.status(400).json({
      success: false,
      error: "No podId provided"
    });
  }

  try {
    const snapshot = await db.collection("Appointments")
      .where("podId", "==", targetPodId)
      .get();

    const scheduled = snapshot.docs.filter(doc => doc.data().status === "scheduled");
    const urgent = scheduled.filter(doc => {
      const urgency = doc.data().urgencyLevel;
      return urgency === 1 || urgency === 2;
    });
    const completed = snapshot.docs.filter(doc => doc.data().status === "completed");

    res.json({
      success: true,
      metrics: {
        totalAppointments: scheduled.length,
        urgentCases: urgent.length,
        completedAppointments: completed.length
      }
    });

  } catch (err) {
    console.error("❌ Error fetching metrics:", err);
    res.status(500).json({ 
      success: false, 
      error: "Failed to fetch metrics" 
    });
  }
});

/* ============================================================
   12) GET NOTIFICATIONS
   ============================================================ */
router.post("/get-notifications", async (req, res) => {
  const { podId } = req.body;
  console.log("🔔 Fetching notifications for pod:", podId);

  try {
    const snapshot = await db.collection("Appointments")
      .where("podId", "==", podId)
      .where("status", "==", "scheduled")
      .orderBy("scheduledDate", "asc")
      .limit(5)
      .get();

    const notifications = snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        patientId: data.patientId,
        date: data.scheduledDate.toDate().toLocaleDateString('en-SG'),
        time: data.scheduledDate.toDate().toLocaleTimeString('en-SG', { hour: '2-digit', minute: '2-digit' }),
        urgency: data.urgencyLevel
      };
    });

    res.json({ success: true, notifications });

  } catch (error) {
    console.error("❌ Error fetching notifications:", error);
    res.status(500).json({ success: false, error: "Failed to fetch notifications" });
  }
});

/* ============================================================
   13) GET SCHEDULE (FULL)
   ============================================================ */
router.post("/get-schedule", async (req, res) => {
  const { podiatristId, podId } = req.body;
  const targetPodId = podId || podiatristId;

  console.log("📅 Fetching full schedule for pod:", targetPodId);

  if (!targetPodId) {
    return res.status(400).json({
      success: false,
      error: "No podId provided",
      appointments: [],
      totalCount: 0
    });
  }

  try {
    const snapshot = await db.collection("Appointments")
      .where("podId", "==", targetPodId)
      .where("status", "==", "scheduled")
      .orderBy("scheduledDate", "asc")
      .get();

    const appointments = [];
    const patientIds = new Set();

    snapshot.docs.forEach(doc => {
      const appointment = doc.data();
      patientIds.add(appointment.patientId);
    });

    let patientMap = {};
    if (patientIds.size > 0) {
      const patientIdsArray = Array.from(patientIds);
      const userSnapshots = await db.collection("Users")
        .where("userId", "in", patientIdsArray)
        .get();

      userSnapshots.docs.forEach(userDoc => {
        const userData = userDoc.data();
        patientMap[userData.userId] = {
          name: `${userData.firstName || ''} ${userData.lastName || ''}`.trim(),
          phone: userData.phone || "N/A",
          email: userData.email || "N/A"
        };
      });
    }

    for (const doc of snapshot.docs) {
      const appointment = doc.data();
      const appointmentDate = appointment.scheduledDate.toDate();

      const patientInfo = patientMap[appointment.patientId] || {
        name: appointment.patientId,
        phone: "N/A",
        email: "N/A"
      };

      appointments.push({
        id: doc.id,
        patientId: appointment.patientId,
        patientName: patientInfo.name,
        patientPhone: patientInfo.phone,
        patientEmail: patientInfo.email,
        scheduledDate: appointmentDate.toLocaleDateString("en-SG", {
          year: "numeric",
          month: "long",
          day: "numeric",
          timeZone: "Asia/Singapore"
        }),
        scheduledTime: appointmentDate.toLocaleTimeString("en-SG", {
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