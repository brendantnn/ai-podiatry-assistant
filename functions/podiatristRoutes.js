// ========================================
// COMPLETE PODIATRIST ROUTES - ALL ENDPOINTS FROM SERVER.JS
// ========================================
const express = require("express");
const router = express.Router();
const { db, admin } = require("./firebase");
const { OpenAI } = require("openai");

// ==============================
// SMS SERVICE IMPORT
// ==============================
const SMSService = require("./smsService");
const smsService = new SMSService(db, admin);


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

// OPTIMIZED CACHE FOR TODAY'S SCHEDULE
let scheduleCache2 = {
  data: null,
  timestamp: null,
  TTL: 30000 // 30 seconds cache
};

// Helper function for urgency text
function getUrgencyText(urgencyLevel) {
  switch (urgencyLevel) {
    case 1: return "🚨 Urgent - Wound Care";
    case 2: return "⚠️ High - Nail Surgery";
    case 3: return "📋 Medium - High Risk Footcare";
    case 4: return "📝 Low - MSK";
    default: return "📋 Standard";
  }
}

// Helper function to parse date/time
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

// Helper function to parse date for filtering
function parseDateForFiltering(dateString) {
  try {
    console.log('🗓️ Parsing date string:', dateString);

    // Handle "5th july 2025", "july 5th 2025" formats
    const monthNames = {
      'january': '01', 'february': '02', 'march': '03', 'april': '04',
      'may': '05', 'june': '06', 'july': '07', 'august': '08',
      'september': '09', 'october': '10', 'november': '11', 'december': '12'
    };

    // Pattern: "5th july 2025" (with ordinals)
    let match = dateString.match(/(\d{1,2})(st|nd|rd|th)?\s+(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{4})/i);
    if (match) {
      const day = match[1].padStart(2, '0');
      const month = monthNames[match[3].toLowerCase()];
      const year = match[4];
      console.log('✅ Matched pattern "5th july 2025":', { day, month, year });
      return `${year}-${month}-${day}`;
    }

    // Pattern: "july 5th 2025" (with ordinals)
    match = dateString.match(/(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{1,2})(st|nd|rd|th)?\s+(\d{4})/i);
    if (match) {
      const month = monthNames[match[1].toLowerCase()];
      const day = match[2].padStart(2, '0');
      const year = match[4];
      console.log('✅ Matched pattern "july 5th 2025":', { day, month, year });
      return `${year}-${month}-${day}`;
    }

    // Pattern: "5 july 2025" (without ordinals)
    match = dateString.match(/(\d{1,2})\s+(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{4})/i);
    if (match) {
      const day = match[1].padStart(2, '0');
      const month = monthNames[match[2].toLowerCase()];
      const year = match[3];
      console.log('✅ Matched pattern "5 july 2025":', { day, month, year });
      return `${year}-${month}-${day}`;
    }

    // Pattern: "july 5 2025" (without ordinals)
    match = dateString.match(/(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{1,2})\s+(\d{4})/i);
    if (match) {
      const month = monthNames[match[1].toLowerCase()];
      const day = match[2].padStart(2, '0');
      const year = match[3];
      console.log('✅ Matched pattern "july 5 2025":', { day, month, year });
      return `${year}-${month}-${day}`;
    }

    // Try direct date parsing as fallback
    const parsed = new Date(dateString);
    if (!isNaN(parsed.getTime())) {
      const result = parsed.toISOString().split('T')[0];
      console.log('✅ Fallback date parsing successful:', result);
      return result;
    }

    console.log('❌ No date pattern matched');
    return null;
  } catch (error) {
    console.error('❌ Error parsing date:', error);
    return null;
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
// router.post("/get-urgent-cases", async (req, res) => {
//   const { podiatristId, podId } = req.body;
//   const targetPodId = podId || podiatristId;
  
//   console.log('🚨 Fetching urgent cases for pod:', targetPodId);

//   if (!targetPodId) {
//     return res.status(400).json({
//       success: false,
//       error: "No podId provided",
//       urgentCases: [],
//       totalCount: 0
//     });
//   }

//   try {
//     const urgentCasesQuery = await db.collection("Appointments")
//       .where("podId", "==", targetPodId)
//       .where("status", "==", "scheduled")
//       .where("urgencyLevel", "in", [1, 2])
//       .orderBy("urgencyLevel", "asc")
//       .orderBy("scheduledDate", "asc")
//       .get();

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
    // Get current date at start of day (Singapore timezone)
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    const urgentCasesQuery = await db.collection("Appointments")
      .where("podId", "==", targetPodId)
      .where("status", "==", "scheduled")
      .where("urgencyLevel", "in", [1, 2])
      .where("scheduledDate", ">=", admin.firestore.Timestamp.fromDate(todayStart))
      .orderBy("scheduledDate", "asc")
      .orderBy("urgencyLevel", "asc")
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
        isEmpty: true
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

/* ============================================================
   5) GET SCHEDULE BY DATE
   ============================================================ */
router.post("/get-schedule-by-date", async (req, res) => {
  const { podiatristId, targetDate, cacheBuster } = req.body; 
  
  try {
    // NEW: Handle "all" dates request for availability filtering
    if (targetDate === "all") {
      console.log('📅 Fetching all scheduled appointments for availability filtering...');
      console.log('🔍 Filtering appointments for podiatrist:', podiatristId);
      
      const allAppointmentsQuery = await db.collection("Appointments")
        .where("status", "==", "scheduled")
        .where("podId", "==", podiatristId)
        .get();
      
      const allAppointments = [];
      
      for (const appointmentDoc of allAppointmentsQuery.docs) {
        const appointment = appointmentDoc.data();
        
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
        allAppointments.push({
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
          urgencyLevel: appointment.urgencyLevel || 4
        });
      }
      
      console.log(`📅 Loaded ${allAppointments.length} appointments for podiatrist ${podiatristId}`);
      
      return res.json({
        success: true,
        appointments: allAppointments,
        totalCount: allAppointments.length,
        message: `Filtered appointments for podiatrist ${podiatristId}`
      });
    }

    // CACHE CHECK FIRST - Skip cache if cacheBuster is present
    const cacheKey = getCacheKey(targetDate, podiatristId);
    const cachedResult = scheduleCache.get(cacheKey);

    if (isValidCache(cachedResult) && !cacheBuster) { 
      console.log('⚡ CACHE HIT: Returning cached schedule');
      return res.json(cachedResult.data);
    }

    console.log('📅 CACHE MISS: Fetching fresh schedule for date:', targetDate);
    if (cacheBuster) {
      console.log('🧹 CACHE BUSTER: Forced fresh data request');
    }

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
        isEmpty: true
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
            setTimeout(() => reject(new Error('timeout')), 1500)
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
          scheduledDate: appt.scheduledDate.toDate().toISOString(),
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
          podId: appt.podId
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
   7) GET PODIATRIST APPOINTMENTS - ALL
   ============================================================ */
// router.post('/podiatrist-get-appointments-all', async (req, res) => {
//   const { podId } = req.body;
//   console.log("🔍 Fetching queue info for:", podId);

//   // try {
//   //   const apptSnapshot = await db.collection("Appointments")
//   //     .where("podId", "==", podId)
//   //     .get();

//   try {
//     // Get current date at start of day (Singapore timezone)
//     const now = new Date();
//     const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
//     const apptSnapshot = await db.collection("Appointments")
//       .where("podId", "==", podId)
//       .where("scheduledDate", ">=", admin.firestore.Timestamp.fromDate(todayStart))
//       .get();

//     let appointments = [];
//     if (!apptSnapshot.empty) {
//       const patientIds = [];

//       apptSnapshot.docs.forEach(doc => {
//         const appt = doc.data();

//         if (appt.status !== "scheduled") return;
//         patientIds.push(appt.patientId);

//         const appointment = {
//           apptId: doc.id,
//           patientId: appt.patientId,
//           podId: appt.podId,
//           scheduledDate: appt.scheduledDate.toDate().toISOString(),
//           date: appt.scheduledDate.toDate().toLocaleDateString('en-SG', { year: 'numeric', month: 'long', day: 'numeric' ,   timeZone: 'Asia/Singapore'}),
//           time: appt.scheduledDate.toDate().toLocaleTimeString('en-SG', { hour: '2-digit', minute: '2-digit', hour12: true,   timeZone: 'Asia/Singapore'}),
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

//       const userSnapshots = await db.collection("Users")
//         .where("userId", "in", patientIds)
//         .get();

//       const userMap = {};
//       userSnapshots.docs.forEach(userDoc => {
//         const userData = userDoc.data();
//         userMap[userData.userId] = userData.firstName + " " + userData.lastName;
//       });

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

// ========================================
// CORRECTED: PODIATRIST-GET-APPOINTMENTS-ALL
// Replace the entire endpoint starting at line 1137
// ========================================

router.post('/podiatrist-get-appointments-all', async (req, res) => {
  const { podId } = req.body;
  console.log("🔍 Fetching queue info for:", podId);

  try {
    // Get current date at start of day (Singapore timezone)
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    const apptSnapshot = await db.collection("Appointments")
      .where("podId", "==", podId)
      .where("scheduledDate", ">=", admin.firestore.Timestamp.fromDate(todayStart))
      .get();

    let appointments = [];
    if (!apptSnapshot.empty) {
      const patientIds = [];

      apptSnapshot.docs.forEach(doc => {
        const appt = doc.data();

        // Only include scheduled appointments
        if (appt.status !== "scheduled") return;
        
        patientIds.push(appt.patientId);

        const appointment = {
          apptId: doc.id,
          patientId: appt.patientId,
          podId: appt.podId,
          scheduledDate: appt.scheduledDate.toDate().toISOString(),
          date: appt.scheduledDate.toDate().toLocaleDateString('en-SG', { year: 'numeric', month: 'long', day: 'numeric' ,   timeZone: 'Asia/Singapore'}),
          time: appt.scheduledDate.toDate().toLocaleTimeString('en-SG', { hour: '2-digit', minute: '2-digit', hour12: true,   timeZone: 'Asia/Singapore'}),
          status: appt.status,
          urgencyLevel: appt.urgencyLevel,
          category: appt.category,
          initialDiagnosis: appt.initialDiagnosis,
          summary: appt.summary,
          imageUrl: appt.imageUrl || null,
          imageCaption: null
        };
        appointments.push(appointment);
      });

      // ✅ FIX: Check if we have any patient IDs before querying Users
      if (patientIds.length === 0) {
        console.log("ℹ️ No scheduled appointments found for this podiatrist");
        return res.json({
          appointments: []
        });
      }

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

      return res.json({
        appointments
      });

    } else {
      console.log("❌ No Appointments found");
      return res.json({
        response: "No Appointments Found",
        appointments: []
      });
    }
  } catch (error) {
    console.error("❌ Error in /podiatrist-get-appointments-all:", error);
    res.status(500).json({ error: "Failed to fetch all appointments" });
  }
});

/* ============================================================
   8) GET PODIATRIST APPOINTMENTS - SCHEDULED ONLY
   ============================================================ */
router.post('/podiatrist-get-appointments-scheduled', async (req, res) => {
  const { podId } = req.body;
  console.log("🔍 Fetching calendar info for:", podId);

  // try {
  //   const apptSnapshot = await db.collection("Appointments")
  //     .where("podId", "==", podId)
  //     .where("status", "==", "scheduled")
  //     .get();

  try {
    // Get current date at start of day (Singapore timezone)
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    const apptSnapshot = await db.collection("Appointments")
      .where("podId", "==", podId)
      .where("status", "==", "scheduled")
      .where("scheduledDate", ">=", admin.firestore.Timestamp.fromDate(todayStart))
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
          podId: appt.podId,
          scheduledDate: appt.scheduledDate.toDate().toISOString(),
          date: appt.scheduledDate.toDate().toLocaleDateString('en-SG', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'Asia/Singapore' }),
          time: appt.scheduledDate.toDate().toLocaleTimeString('en-SG', { hour: '2-digit', minute: '2-digit', hour12: true , timeZone: 'Asia/Singapore'}),
          urgencyLevel: appt.urgencyLevel || 3,
          category: appt.category || 'General',
          initialDiagnosis: appt.initialDiagnosis || 'Assessment pending',
          summary: appt.summary || 'No case summary available',
          imageUrl: appt.imageUrl || null,
          imageCaption: null
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

      return res.json({
        appointments
      });

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
   9) UPDATE APPOINTMENT - FIXED
   ============================================================ */

router.post('/podiatrist-update-appointment', async (req, res) => {
  let { appointmentId, apptId, newDate, newTime, updateData, originalSlot } = req.body;
  
  const finalApptId = appointmentId || apptId;
  
  console.log("✏️ Updating appointment:", finalApptId);
  console.log("📦 Received parameters:", { appointmentId, apptId, newDate, newTime, updateData });

  // Handle different parameter formats
  if (updateData && typeof updateData === 'string') {
    // Format 1: "YYYY-MM-DDTHH:mm" (ISO format with T)
    if (updateData.includes('T')) {
      const [datePart, timePart] = updateData.split('T');
      newDate = datePart;
      newTime = timePart;
    }
    // Format 2: "YYYY-MM-DD HH:mm" (with space)
    else if (updateData.includes(' ')) {
      const [datePart, timePart] = updateData.split(' ');
      newDate = datePart;
      newTime = timePart;
    }
    // Format 3: Just a date string
    else {
      newDate = updateData;
    }
  }

  console.log("📅 Parsed date and time:", { newDate, newTime });

  if (!finalApptId) {
    return res.status(400).json({ 
      success: false, 
      error: "Missing appointment ID" 
    });
  }

  if (!newDate || !newTime) {
    return res.status(400).json({ 
      success: false, 
      error: "Missing date or time. Please provide both date and time.",
      received: { newDate, newTime, updateData }
    });
  }


  try {
    const appointmentRef = db.collection("Appointments").doc(finalApptId);
    const appointmentDoc = await appointmentRef.get();

    if (!appointmentDoc.exists) {
      return res.status(404).json({ success: false, error: "Appointment not found" });
    }

    // Parse date and time with Singapore timezone
    const [year, month, day] = newDate.split('-');
    const [hours, minutes] = newTime.split(':');
    
    // Create date in Singapore timezone (UTC+8)
    // Format: YYYY-MM-DDTHH:mm:ss+08:00
    const dateTimeString = `${year}-${month}-${day}T${hours}:${minutes}:00+08:00`;
    const newDateTime = new Date(dateTimeString);
    
    console.log("🕐 Parsed DateTime:", {
      input: { newDate, newTime },
      dateTimeString: dateTimeString,
      newDateTime: newDateTime.toISOString(),
      localString: newDateTime.toLocaleString('en-SG', { timeZone: 'Asia/Singapore' })
    });

    await appointmentRef.update({
      scheduledDate: admin.firestore.Timestamp.fromDate(newDateTime),
      updatedAt: admin.firestore.Timestamp.now()
    });

      // ========================================
  // SEND SMS: APPOINTMENT UPDATED
  // ========================================
  try {
      const apptData = appointmentDoc.data();

      // Old appointment date
      const oldDate = apptData.scheduledDate.toDate();
      const oldDateTimeString = oldDate.toLocaleString("en-SG", {
          year: "numeric",
          month: "long",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
          hour12: true,
          timeZone: "Asia/Singapore",
      });

      // New appointment date
      const newDateTimeString = newDateTime.toLocaleString("en-SG", {
          year: "numeric",
          month: "long",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
          hour12: true,
          timeZone: "Asia/Singapore",
      });

      // Fetch podiatrist name
      const podSnap = await db.collection("Users")
          .where("userId", "==", apptData.podId)
          .limit(1)
          .get();

      let podiatristName = "Podiatrist";
      if (!podSnap.empty) {
          const pod = podSnap.docs[0].data();
          podiatristName = `${pod.firstName || ""} ${pod.lastName || ""}`.trim();
      }

      // Send SMS
      console.log("📩 Sending SMS update...");
      const smsResult = await smsService.sendAppointmentUpdateSMS(
          finalApptId,               // correct ID
          apptData.patientId,        // correct patient id
          oldDateTimeString,
          newDateTimeString,
          podiatristName
      );

      console.log("📲 SMS update result:", smsResult);

  } catch (smsErr) {
      console.error("❌ Failed to send appointment-update SMS:", smsErr);
  }

    console.log("✅ Appointment updated successfully");
    res.json({ success: true, message: "Appointment updated successfully" });

  } catch (error) {
    console.error("❌ Error updating appointment:", error);
    res.status(500).json({ success: false, error: "Failed to update appointment" });
  }
});

/* ============================================================
   10) CANCEL APPOINTMENT
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

        // ========================================
    // SEND SMS: APPOINTMENT CANCELLED
    // ========================================
    try {
        // Format date/time for SMS
        const oldDateString = oldDate.toLocaleString("en-SG", {
            year: "numeric",
            month: "long",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
            hour12: true,
            timeZone: "Asia/Singapore",
        });

        // Fetch podiatrist name
        const podSnap = await db.collection("Users")
            .where("userId", "==", podId)
            .limit(1).get();
        let podiatristName = "Podiatrist";
        if (!podSnap.empty) {
            const pod = podSnap.docs[0].data();
            podiatristName = `${pod.firstName || ""} ${pod.lastName || ""}`.trim();
        }

        console.log("📩 Sending cancellation SMS...");
        const smsMessage = smsService.generateAppointmentCancellationSMS(
            patientName,
            oldDateString,
            podiatristName
        );

        const smsResult = await smsService.sendSMS(patientPhone, smsMessage);
        console.log("📲 SMS cancellation result:", smsResult);

        await smsService.logAppointmentNotification(
            apptId,
            patientId,
            "sms",
            "appointment_cancelled",
            smsMessage,
            smsResult.success ? "sent" : "failed"
        );

    } catch (smsErr) {
        console.error("❌ Failed to send appointment-cancellation SMS:", smsErr);
    }


    console.log("✅ Appointment cancelled successfully");
    res.json({ success: true, message: "Appointment cancelled successfully" });

  } catch (error) {
    console.error("❌ Error cancelling appointment:", error);
    res.status(500).json({ success: false, error: "Failed to cancel appointment" });
  }
});

/* ============================================================
   11) GET AVAILABILITY
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
   12) EDIT APPOINTMENT (WITH SMS)
   ============================================================ */
router.post("/edit-appointment", async (req, res) => {
  const { patientId, appointmentId, newDateTime, podiatristId } = req.body;

  try {
    console.log('📝 Editing appointment:', patientId, 'to:', newDateTime);

    // Find the appointment by ID if provided, otherwise by patientId
    let appointmentDoc;
    if (appointmentId) {
      appointmentDoc = await db.collection("Appointments").doc(appointmentId).get();
    } else {
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
      appointmentDoc = appointmentQuery.docs[0];
    }

    if (!appointmentDoc.exists) {
      return res.json({
        success: false,
        message: "Appointment not found"
      });
    }

    const currentAppointment = appointmentDoc.data();
    const oldDateTime = currentAppointment.scheduledDate.toDate();

    // Parse new date/time
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

    // Get podiatrist name
    let podiatristName = "Doctor";
    try {
      const podiatristQuery = await db.collection("Users")
        .where("userId", "==", currentAppointment.podId)
        .limit(1)
        .get();

      if (!podiatristQuery.empty) {
        const podiatristData = podiatristQuery.docs[0].data();
        podiatristName = `${podiatristData.firstName || ''} ${podiatristData.lastName || ''}`.trim();
      }
    } catch (podError) {
      console.warn('⚠️ Could not fetch podiatrist name:', podError);
    }

    // Format dates
    const oldDateFormatted = oldDateTime.toLocaleDateString("en-SG", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
      timeZone: "Asia/Singapore"
    });

    const newDateFormatted = newScheduledDate.toLocaleDateString("en-SG", {
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
      success: true,
      newDateTime: newDateFormatted,
      oldDateTime: oldDateFormatted,
      message: "Appointment updated successfully"
    });

  } catch (error) {
    console.error("❌ Error editing appointment:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while updating appointment"
    });
  }
});

/* ============================================================
   13) GET UPCOMING APPOINTMENTS
   ============================================================ */
router.post("/get-upcoming-appointments", async (req, res) => {
  const { podiatristId, podId, days = 7, limit = 10 } = req.body;
  
  const targetPodId = podId || podiatristId;

  try {
    console.log('📅 Fetching upcoming appointments for editing for pod:', targetPodId);

    // Get date range (today + next X days)
    const startDate = new Date();
    const endDate = new Date();
    endDate.setDate(startDate.getDate() + days);

    console.log('🔍 DEBUG: Date range and pod filter:', {
      start: startDate.toISOString(),
      end: endDate.toISOString(),
      podId: targetPodId
    });

    const appointmentsQuery = await db.collection("Appointments")
      .where("scheduledDate", ">=", admin.firestore.Timestamp.fromDate(startDate))
      .where("scheduledDate", "<=", admin.firestore.Timestamp.fromDate(endDate))
      .where("status", "==", "scheduled")
      .where("podId", "==", targetPodId)
      .orderBy("scheduledDate")
      .limit(limit)
      .get();

    const countQuery = await db.collection("Appointments")
      .where("scheduledDate", ">=", admin.firestore.Timestamp.fromDate(startDate))
      .where("scheduledDate", "<=", admin.firestore.Timestamp.fromDate(endDate))
      .where("status", "==", "scheduled")
      .where("podId", "==", targetPodId)
      .get();

    console.log(`📊 Found ${appointmentsQuery.size} appointments for editing for pod ${targetPodId}`);

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
      showing: appointments.length,
      podId: targetPodId,
      message: appointments.length > 0 ? 
        `Found ${appointments.length} appointments for editing for pod ${targetPodId}` : 
        `No appointments found for editing for pod ${targetPodId}`
    });

  } catch (error) {
    console.error("❌ Error fetching upcoming appointments:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to fetch appointments"
    });
  }
});

/* ============================================================
   14) GET DASHBOARD METRICS
   ============================================================ */
// router.post("/get-dashboard-metrics", async (req, res) => {
//   const { podiatristId, podId } = req.body;
//   const targetPodId = podId || podiatristId;
  
//   console.log('📊 Fetching dashboard metrics for pod:', targetPodId);

//   if (!targetPodId) {
//     return res.status(400).json({
//       success: false,
//       error: "No podId provided"
//     });
//   }

//   try {
//     const snapshot = await db.collection("Appointments")
//       .where("podId", "==", targetPodId)
//       .get();

//     const scheduled = snapshot.docs.filter(doc => doc.data().status === "scheduled");

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
    // Get current date at start of day (Singapore timezone)
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    const snapshot = await db.collection("Appointments")
      .where("podId", "==", targetPodId)
      .get();

    // Filter for scheduled appointments on or after today
    const scheduled = snapshot.docs.filter(doc => {
      const data = doc.data();
      if (data.status !== "scheduled") return false;
      
      const aptDate = data.scheduledDate.toDate();
      return aptDate >= todayStart;
    });

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
   15) GET NOTIFICATIONS
   ============================================================ */

// router.post("/get-notifications", async (req, res) => {
//   const { podId } = req.body;
//   console.log("🔔 Fetching notifications for pod:", podId);

//   try {
//     const snapshot = await db.collection("Appointments")
//       .where("podId", "==", podId)
//       .where("status", "==", "scheduled")
//       .orderBy("scheduledDate", "asc")
//       .limit(5)
//       .get();

router.post("/get-notifications", async (req, res) => {
  const { podId } = req.body;
  console.log("🔔 Fetching notifications for pod:", podId);

  try {
    // Get current date at start of day
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    const snapshot = await db.collection("Appointments")
      .where("podId", "==", podId)
      .where("status", "==", "scheduled")
      .where("scheduledDate", ">=", admin.firestore.Timestamp.fromDate(todayStart))
      .orderBy("scheduledDate", "asc")
      .limit(5)
      .get();

    // Get patient names for notifications
    const notifications = [];
    
    for (const doc of snapshot.docs) {
      const data = doc.data();
      const scheduledDate = data.scheduledDate.toDate();
      
      // Get patient name
      let patientName = data.patientId;
      try {
        const userQuery = await db.collection("Users")
          .where("userId", "==", data.patientId)
          .limit(1)
          .get();
        
        if (!userQuery.empty) {
          const userData = userQuery.docs[0].data();
          patientName = `${userData.firstName} ${userData.lastName}`.trim();
        }
      } catch (e) {
        console.log('Could not fetch patient name for notification');
      }
      
      // Determine notification type based on urgency and time
      const now = new Date();
      const timeDiff = scheduledDate - now;
      const hoursDiff = timeDiff / (1000 * 60 * 60);
      
      let type = 'reminder';
      if (data.urgencyLevel === 1 || data.urgencyLevel === 2) {
        type = 'urgent';
      } else if (hoursDiff < 24 && hoursDiff > 0) {
        type = 'upcoming';
      }
      
      // Format message
      const dateStr = scheduledDate.toLocaleDateString('en-SG', { 
        month: 'short', 
        day: 'numeric',
        timeZone: 'Asia/Singapore'
      });
      const timeStr = scheduledDate.toLocaleTimeString('en-SG', { 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: true,
        timeZone: 'Asia/Singapore'
      });
      
      const message = `${patientName} - ${dateStr} at ${timeStr}`;
      
      notifications.push({
        id: doc.id,
        appointmentId: doc.id,
        patientId: data.patientId,
        message: message,
        type: type,
        timestamp: scheduledDate.toISOString(),
        date: dateStr,
        time: timeStr,
        urgency: data.urgencyLevel
      });
    }

    res.json({ success: true, notifications });

  } catch (error) {
    console.error("❌ Error fetching notifications:", error);
    res.status(500).json({ success: false, error: "Failed to fetch notifications" });
  }
});

/* ============================================================
   16) GET PATIENT APPOINTMENTS
   ============================================================ */
router.post("/get-patient-appointments", async (req, res) => {
  const { patientId, suggestedDateTime, podiatristId } = req.body;

  try {
    console.log('🔍 Searching for appointments:', { patientId, suggestedDateTime });

    // Step 1: First try to find by patientId directly
    let appointmentsQuery = await db.collection("Appointments")
      .where("patientId", "==", patientId)
      .where("status", "==", "scheduled")
      .get();

    console.log('📊 Direct patientId search results:', appointmentsQuery.size);

    // Step 2: If no results and patientId looks like a name, search by name
    if (appointmentsQuery.empty && !patientId.startsWith('patient_')) {
      console.log('🔍 No direct match, searching by patient name...');

      // Search for users with matching names
      const userQuery = await db.collection("Users")
        .get();

      let matchingUserId = null;
      const searchName = patientId.toLowerCase();

      userQuery.docs.forEach(userDoc => {
        const userData = userDoc.data();
        const fullName = `${userData.firstName || ''} ${userData.lastName || ''}`.toLowerCase().trim();

        if (fullName.includes(searchName) || searchName.includes(fullName)) {
          matchingUserId = userData.userId;
          console.log('✅ Found matching user:', fullName, '→', matchingUserId);
        }
      });

      // Search appointments with the found userId
      if (matchingUserId) {
        appointmentsQuery = await db.collection("Appointments")
          .where("patientId", "==", matchingUserId)
          .where("status", "==", "scheduled")
          .get();

        console.log('📊 Name-based search results:', appointmentsQuery.size);
      }
    }

    if (appointmentsQuery.empty) {
      return res.json({
        success: false,
        message: `No appointments found for ${patientId}`,
        appointments: []
      });
    }

    // Step 3: Process appointments and filter by date if provided
    const appointments = [];

    for (const appointmentDoc of appointmentsQuery.docs) {
      const appointment = appointmentDoc.data();

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
      const appointmentData = {
        appointmentId: appointmentDoc.id,
        patientId: appointment.patientId,
        patientName: patientInfo.name,
        patientPhone: patientInfo.phone,
        patientEmail: patientInfo.email,
        scheduledDateTime: scheduledDate.toLocaleDateString("en-SG", {
          weekday: "long",
          year: "numeric",
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
        summary: appointment.summary || "No additional notes"
      };

      // Step 4: Filter by suggested date if provided
      let includeAppointment = true;

      if (suggestedDateTime) {
        const targetDate = parseDateForFiltering(suggestedDateTime);
        const appointmentDateStr = scheduledDate.toISOString().split('T')[0];

        console.log('📅 Date filtering:', {
          suggested: suggestedDateTime,
          parsed: targetDate,
          appointment: appointmentDateStr,
          match: targetDate === appointmentDateStr
        });

        includeAppointment = (targetDate === appointmentDateStr);
      }

      if (includeAppointment) {
        appointments.push(appointmentData);
      }
    }

    // Sort by date (earliest first)
    appointments.sort((a, b) => new Date(a.scheduledDateTime) - new Date(b.scheduledDateTime));

    console.log('✅ Returning', appointments.length, 'filtered appointments');

    return res.json({
      success: true,
      appointments,
      totalCount: appointments.length,
      message: appointments.length > 0 ?
        `Found ${appointments.length} appointment(s) for ${patientId}` :
        `No appointments found for ${patientId}${suggestedDateTime ? ' on ' + suggestedDateTime : ''}`
    });

  } catch (error) {
    console.error("❌ Error fetching patient appointments:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to fetch appointments",
      message: error.message,
      appointments: []
    });
  }
});

/* ============================================================
   17) GET PODIATRIST NAME
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
   18) GET SCHEDULE (FULL)
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