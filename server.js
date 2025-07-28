require('dotenv').config();

const express = require("express");
const cors = require("cors");
const { OpenAI } = require("openai");
const path = require("path");
const app = express();
const { admin,db } = require("./firebase");

// IMPORTS FOR SMS
const SMSService = require('./smsService');
const { setupSMSRoutes, setupPatientSMSRoutes } = require('./smsRoutes');

app.use(cors());
app.use(express.json());
app.use(express.static("public"));

// Initialize SMS Service
const smsService = new SMSService(db, admin);

// Setup SMS routes
app.use('/sms', setupSMSRoutes(smsService));

// Load patient route
const patientRoutes = require("./patientRoutes");
app.use("/patient", patientRoutes);

// ADD SMS routes to patient routes
app.use("/patient", setupPatientSMSRoutes(smsService));


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

// ******************************** PODIATRIST LOGIC *****************************************

// // FIXED PODIATRIST CHAT ROUTE
// app.post("/podiatrist-chat", async (req, res) => {
//   const userMessage = req.body.message;
//   const podiatristId = req.body.podiatristId || "pod1";

//   try {
//     console.log('🤖 Podiatrist chat message:', userMessage);

//     // FIXED patient ID detection patterns
//     const patientIdPatterns = [
//       /\b(patient_\d+)\b/gi,                    // ONLY "patient_1", "patient_2", etc.
//       /\bpatient\s+(\d+)\b/gi,                  // ONLY "patient 1", "patient 2", etc.
//       /tell me about (patient_\d+)/gi,          // "tell me about patient_1"
//       /information.*?(patient_\d+)/gi,          // "give me information patient_1"
//       /name.*?(patient_\d+)/gi,                 // "name patient_1"
//       /(patient_\d+).*?(information|name|details)/gi, // "patient_1 information"
//       /\b(p\d+)\b/gi,                           // "p1", "p2", etc.
//       /\b(pt\d+)\b/gi                           // "pt1", "pt2", etc.
//     ];

//     let patientId = null;
//     let patientData = null;
//     let patientContext = "";

//     console.log(`🔍 Analyzing message for patient ID: "${userMessage}"`);

//     // Try each pattern to find patient ID
//     for (let i = 0; i < patientIdPatterns.length; i++) {
//       const pattern = patientIdPatterns[i];
//       const matches = [...userMessage.matchAll(pattern)];

//       if (matches.length > 0) {
//         const match = matches[0]; // Get first match
//         console.log(`🎯 Pattern ${i + 1} matched:`, match);

//         if (i === 0 || i === 2 || i === 3 || i === 4 || i === 5) {
//           // For "patient_1" or direct capture patterns
//           patientId = match[1];
//         } else if (i === 1) {
//           // For "patient 1" pattern - construct "patient_1"
//           patientId = `patient_${match[1]}`;
//         } else {
//           // For p1, pt1 patterns - use as is
//           patientId = match[1];
//         }

//         console.log(`✅ Extracted patient ID: "${patientId}" from pattern ${i + 1}`);

//         // VALIDATE that it's a real patient ID format
//         if (/^(patient_\d+|p\d+|pt\d+)$/i.test(patientId)) {
//           break;
//         } else {
//           console.log(`❌ Invalid patient ID format: "${patientId}", continuing search...`);
//           patientId = null;
//         }
//       }
//     }

//     // DEBUG LOGGING
//     if (patientId) {
//       console.log(`🔍 === PATIENT LOOKUP DEBUG ===`);
//       console.log(`🔍 Original message: "${userMessage}"`);
//       console.log(`🔍 Extracted patientId: "${patientId}"`);
//       console.log(`🔍 PatientId length: ${patientId.length}`);
//       console.log(`🔍 PatientId characters: ${JSON.stringify(patientId.split(''))}`);
//       console.log(`🔍 About to search database for: "${patientId}"`);

//       try {
//         // Find user by userId field
//         const userQuery = await db.collection("Users")
//           .where("userId", "==", patientId)
//           .limit(1)
//           .get();

//         console.log(`📊 Database query for "${patientId}" returned: ${userQuery.size} documents`);

//         if (!userQuery.empty) {
//           const userDoc = userQuery.docs[0];
//           const userData = userDoc.data();
//           const userDocId = userDoc.id; // e.g., "user_1"

//           console.log(`✅ Found user: ${userData.firstName} ${userData.lastName} (Doc ID: ${userDocId})`);

//           // Get patient profile using the document ID
//           const profileSnapshot = await db.collection("PatientProfiles").doc(userDocId).get();

//           let profile = {
//             riskLevel: "unknown",
//             assignedPodId: "",
//             medicalAlerts: [],
//             nricLast4: "",
//             preferredLang: "en"
//           };

//           if (profileSnapshot.exists) {
//             profile = profileSnapshot.data();
//             console.log(`✅ Found patient profile: Risk level ${profile.riskLevel}`);
//           } else {
//             console.log(`⚠️ No patient profile found for doc ID: ${userDocId}`);
//           }

//           patientData = {
//             name: `${userData.firstName || ''} ${userData.lastName || ''}`.trim(),
//             email: userData.email,
//             gender: userData.gender,
//             phone: userData.phone,
//             dob: userData.dob,
//             isActive: userData.isActive,
//             lastLoginAt: userData.lastLoginAt,
//             riskLevel: profile.riskLevel,
//             assignedPodId: profile.assignedPodId,
//             medicalAlerts: profile.medicalAlerts || [],
//             nricLast4: profile.nricLast4,
//             preferredLang: profile.preferredLang
//           };

//           // Create FILTERED context for AI (remove sensitive data)
//           patientContext = `
// PATIENT CLINICAL INFORMATION FOR ${patientId.toUpperCase()}:
// - Patient ID: ${patientId}
// - Name: ${patientData.name}
// - Gender: ${patientData.gender}
// - Risk Level: ${patientData.riskLevel}
// - Medical Alerts: ${patientData.medicalAlerts.join(', ') || 'None recorded'}

// USER QUERY: "${userMessage}"

// Based on this patient's clinical profile, please provide the requested information.
// `;

//           console.log(`✅ Generated context for patient: ${patientId}`);
//         } else {
//           console.log(`❌ Patient ${patientId} not found in Users collection`);
//           patientContext = `Patient ${patientId} not found in database. Please verify the patient ID.`;
//         }
//       } catch (error) {
//         console.error("❌ Error fetching patient data:", error);
//         patientContext = `Error retrieving patient ${patientId} data: ${error.message}`;
//       }
//     }

//     // Detect if this is an urgent cases summary request
//     const isUrgentCasesQuery = req.body.queryType && req.body.queryType.toLowerCase() === 'urgent cases';

//     let systemPrompt = '';
//     if (isUrgentCasesQuery) {
//       // Minimal system prompt for urgent cases summary
//       systemPrompt = 'You are an AI assistant. The user will provide a list of urgent cases. Do not add a workload overview, clinical recommendations, or workflow analysis. Simply summarize or echo the list as a clear, readable summary. Do not add extra sections.';
//     } else if (patientContext) {
//       // Patient-specific system prompt
//       systemPrompt = `You are an AI clinical assistant for podiatrists at Singapore General Hospital.

// CURRENT USER: Dr. ${req.body.podiatristName || 'Unknown'} (${req.body.podiatristId || 'unknown_id'})

// ${patientContext}

// INSTRUCTIONS:
// - Provide specific information about this patient based on the user's query
// - If asked for "information" generally, provide: Patient ID, Name, Gender, Risk Level, and Medical Alerts
// - If asked for specific details (name, gender, etc.), provide just that information clearly
// - If asked for "name", respond with: "Patient ${patientId}: [Full Name]"
// - Keep responses concise and clinical
// - Always mention the patient ID for clarity

// RESPONSE FORMATTING:
// - Use clear, professional medical language
// - Structure responses with bullet points for readability when appropriate
// - Bold important information using **text**
// - Always confirm which patient you're discussing
// - For single-word queries like "name", give a direct answer`;
//     } else {
//       // Default system prompt for general queries
//       systemPrompt = `You are an AI clinical assistant for podiatrists at Singapore General Hospital.

// CURRENT USER: Dr. ${req.body.podiatristName || 'Unknown'} (${req.body.podiatristId || 'unknown_id'})

// You help with:
// 1. **Patient-Specific Queries** - Detailed case analysis based on patient history
// 2. **Clinical Decision Support** - Evidence-based treatment recommendations
// 3. **Medical Knowledge** - Information about podiatry conditions and protocols  
// 4. **Case Management** - Guidance on patient prioritization and workflow
// 5. **Treatment Protocols** - Step-by-step treatment approaches
// 6. **Drug Information** - Interactions, dosages, and contraindications

// RESPONSE FORMATTING RULES:
// - Address the podiatrist by name when appropriate (Dr. ${req.body.podiatristName?.split(' ')[0] || 'Doctor'})
// - Use clear, professional medical language
// - Structure responses with headers and bullet points for readability
// - Bold important medical terms and conditions
// - Use minimal emojis - only for essential medical categories (🩹 wound care, 💊 medications, ⚠️ warnings)
// - Keep responses concise but comprehensive
// - Always provide evidence-based recommendations

// Always remind that final clinical decisions should be based on physical examination and patient-specific factors.`;
//     }

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
//       patientData: patientData // Include patient data in response for frontend use
//     });

//   } catch (err) {
//     console.error("❌ Podiatrist chat error:", err);
//     return res.status(500).json({ reply: "Something went wrong with the clinical assistant." });
//   }
// });

app.post("/podiatrist-chat", async (req, res) => {
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

    // FALLBACK FOR OTHER QUERIES (existing logic)
    const patientIdPatterns = [
      /\b(patient_\d+)\b/gi,
      /\bpatient\s+(\d+)\b/gi
    ];

    let patientId = null;
    
    for (let i = 0; i < patientIdPatterns.length; i++) {
      const pattern = patientIdPatterns[i];
      const matches = [...userMessage.matchAll(pattern)];

      if (matches.length > 0) {
        const match = matches[0];
        if (i === 0) {
          patientId = match[1];
        } else if (i === 1) {
          patientId = `patient_${match[1]}`;
        }
        
        if (/^patient_\d+$/i.test(patientId)) {
          break;
        } else {
          patientId = null;
        }
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

// ========================================
// NEW DATABASE ROUTES FOR AI CHAT
// ========================================

// // GET URGENT CASES - FIXED DATE FILTERING WITH ENHANCED RESPONSE
// app.post("/get-urgent-cases", async (req, res) => {
//   const { podiatristId } = req.body;

//   try {
//     console.log('🚨 Fetching urgent cases...');
//     console.log('🔍 DEBUG: Current time:', new Date().toLocaleString("en-SG", { timeZone: "Asia/Singapore" }));

//     // FIXED: Use a much wider date range to catch all appointments
//     const startDate = new Date('2025-01-01T00:00:00Z'); // Start of 2025
//     const endDate = new Date('2025-12-31T23:59:59Z');   // End of 2025

//     console.log('🔍 DEBUG: Date range:', {
//       start: startDate.toISOString(),
//       end: endDate.toISOString()
//     });

//     // Query for ALL scheduled appointments in 2025
//     const urgentQuery = await db.collection("Appointments")
//       .where("scheduledDate", ">=", admin.firestore.Timestamp.fromDate(startDate))
//       .where("scheduledDate", "<=", admin.firestore.Timestamp.fromDate(endDate))
//       .where("status", "==", "scheduled")
//       .get();

//     console.log('📊 Total appointments found in date range:', urgentQuery.size);

//     // Log each appointment for debugging
//     urgentQuery.docs.forEach((doc, index) => {
//       const apt = doc.data();
//       console.log(`📋 Appointment ${index + 1}:`, {
//         id: doc.id,
//         patientId: apt.patientId,
//         urgencyLevel: apt.urgencyLevel,
//         scheduledDate: apt.scheduledDate.toDate().toISOString(),
//         status: apt.status
//       });
//     });

//     // Filter for urgent cases (level 1 and 2) and collect results
//     const urgentAppointments = [];

//     for (const appointmentDoc of urgentQuery.docs) {
//       const appointment = appointmentDoc.data();

//       console.log(`🔍 Checking appointment: PatientID=${appointment.patientId}, UrgencyLevel=${appointment.urgencyLevel}, Category=${appointment.category}`);

//       // CRITICAL: Only include urgency level 1 AND 2 as urgent cases
//       if (appointment.urgencyLevel <= 2) {
//         console.log(`✅ URGENT CASE FOUND: ${appointment.patientId} - Level ${appointment.urgencyLevel}`);

//         // Get patient details
//         let patientInfo = {
//           name: appointment.patientId
//         };

//         try {
//           const patientQuery = await db.collection("Users")
//             .where("userId", "==", appointment.patientId)
//             .limit(1)
//             .get();

//           if (!patientQuery.empty) {
//             const patientData = patientQuery.docs[0].data();
//             patientInfo = {
//               name: `${patientData.firstName || ''} ${patientData.lastName || ''}`.trim()
//             };
//             console.log(`✅ Found patient details: ${patientInfo.name}`);
//           } else {
//             console.log(`⚠️ No patient details found for: ${appointment.patientId}`);
//           }
//         } catch (patientError) {
//           console.log('⚠️ Patient lookup failed:', patientError.message);
//         }

//         const scheduledDate = appointment.scheduledDate.toDate();
//         const urgentCase = {
//           appointmentId: appointmentDoc.id,
//           patientId: appointment.patientId,
//           patientName: patientInfo.name,
//           scheduledTime: scheduledDate.toLocaleTimeString("en-SG", {
//             hour: "2-digit",
//             minute: "2-digit",
//             hour12: true,
//             timeZone: "Asia/Singapore"
//           }),
//           scheduledDate: scheduledDate.toLocaleDateString("en-SG", {
//             weekday: "long",
//             year: "numeric",
//             month: "long",
//             day: "numeric",
//             timeZone: "Asia/Singapore"
//           }),
//           category: appointment.category || "General",
//           urgencyLevel: appointment.urgencyLevel,
//           urgencyText: getUrgencyText(appointment.urgencyLevel),
//           initialDiagnosis: appointment.initialDiagnosis || "Assessment pending",
//           summary: appointment.summary || "No additional notes",
//           status: appointment.status
//         };

//         urgentAppointments.push(urgentCase);
//         console.log(`✅ Added urgent case: ${patientInfo.name} - ${urgentCase.urgencyText}`);
//       } else {
//         console.log(`⏭️ Non-urgent case skipped: ${appointment.patientId} - Level ${appointment.urgencyLevel}`);
//       }
//     }

//     // Sort by urgency level (most urgent first)
//     urgentAppointments.sort((a, b) => a.urgencyLevel - b.urgencyLevel);

//     console.log(`🚨 FINAL RESULT: Returning ${urgentAppointments.length} urgent cases out of ${urgentQuery.size} total appointments`);
    
//     if (urgentAppointments.length > 0) {
//       console.log('📋 Urgent cases details:');
//       urgentAppointments.forEach((case_, index) => {
//         console.log(`  ${index + 1}. ${case_.patientName} - ${case_.urgencyText} - ${case_.scheduledTime}`);
//       });
//     } else {
//       console.log('📋 No urgent cases found - all appointments are medium to low priority');
//     }

//     return res.json({
//       success: true,
//       urgentCases: urgentAppointments,
//       totalCount: urgentAppointments.length,
//       totalAppointmentsUpcoming: urgentQuery.size,
//       hasUrgentCases: urgentAppointments.length > 0,
//       message: urgentAppointments.length > 0 ? 
//         `Found ${urgentAppointments.length} urgent cases` : 
//         'No urgent cases found - all appointments are medium to low priority',
//       date: new Date().toLocaleDateString("en-SG", {
//         weekday: "long",
//         year: "numeric",
//         month: "long",
//         day: "numeric",
//         timeZone: "Asia/Singapore"
//       }),
//       debugInfo: {
//         dateRange: {
//           start: startDate.toISOString(),
//           end: endDate.toISOString()
//         },
//         urgentCasesFound: urgentAppointments.length,
//         totalAppointmentsUpcoming: urgentQuery.size
//       }
//     });

//   } catch (error) {
//     console.error("❌ Error fetching urgent cases:", error);
//     return res.status(500).json({
//       success: false,
//       error: "Failed to fetch urgent cases",
//       message: error.message,
//       urgentCases: [],
//       totalCount: 0,
//       hasUrgentCases: false
//     });
//   }
// });

app.post("/get-urgent-cases", async (req, res) => {
  const { podiatristId, podId } = req.body;
  
  // Use podId if provided, fallback to podiatristId for backward compatibility
  const targetPodId = podId || podiatristId;
  
  console.log('🚨 Fetching urgent cases for pod:', targetPodId);

  try {
    console.log('🔍 DEBUG: Current time:', new Date().toLocaleString("en-SG", { timeZone: "Asia/Singapore" }));

    // Use a wide date range to catch all appointments
    const startDate = new Date('2025-01-01T00:00:00Z');
    const endDate = new Date('2025-12-31T23:59:59Z');

    console.log('🔍 DEBUG: Date range:', {
      start: startDate.toISOString(),
      end: endDate.toISOString(),
      podId: targetPodId
    });

    // 🔧 CRITICAL FIX: Filter by both date range AND podId
    const urgentQuery = await db.collection("Appointments")
      .where("scheduledDate", ">=", admin.firestore.Timestamp.fromDate(startDate))
      .where("scheduledDate", "<=", admin.firestore.Timestamp.fromDate(endDate))
      .where("status", "==", "scheduled")
      .where("podId", "==", targetPodId) // 🔧 ADDED: Filter by pod
      .get();

    console.log(`📊 Found ${urgentQuery.size} total appointments for pod ${targetPodId}`);

    // Filter for urgent cases (level 1 and 2) and collect results
    const urgentAppointments = [];

    for (const appointmentDoc of urgentQuery.docs) {
      const appointment = appointmentDoc.data();

      console.log(`🔍 Checking appointment: PatientID=${appointment.patientId}, UrgencyLevel=${appointment.urgencyLevel}, Pod=${appointment.podId}`);

      // Only include urgent cases (level 1 or 2)
      if (appointment.urgencyLevel === 1 || appointment.urgencyLevel === 2) {
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
          console.log(`⚠️ Patient lookup failed for ${appointment.patientId}:`, patientError.message);
        }

        // Format the appointment data
        const urgentCase = {
          id: appointmentDoc.id,
          patientId: appointment.patientId,
          patientName: patientInfo.name,
          patientPhone: patientInfo.phone,
          patientEmail: patientInfo.email,
          scheduledDate: appointment.scheduledDate.toDate().toLocaleDateString('en-SG', { 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
          }),
          scheduledTime: appointment.scheduledDate.toDate().toLocaleTimeString('en-SG', { 
            hour: '2-digit', 
            minute: '2-digit', 
            hour12: true 
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
        console.log(`✅ Added urgent case: ${patientInfo.name} - ${urgentCase.urgencyText} - ${urgentCase.scheduledTime}`);
      }
    }

    console.log(`🚨 Found ${urgentAppointments.length} urgent cases for pod ${targetPodId}`);

    if (urgentAppointments.length > 0) {
      urgentAppointments.forEach((case_, index) => {
        console.log(`${index + 1}. ${case_.patientName} - ${case_.urgencyText} - ${case_.scheduledTime}`);
      });
    } else {
      console.log(`📋 No urgent cases found for pod ${targetPodId} - all appointments are medium to low priority`);
    }

    return res.json({
      success: true,
      urgentCases: urgentAppointments,
      totalCount: urgentAppointments.length,
      totalAppointmentsUpcoming: urgentQuery.size,
      hasUrgentCases: urgentAppointments.length > 0,
      podId: targetPodId, // 🔧 ADDED: Return which pod the data is for
      message: urgentAppointments.length > 0 ? 
        `Found ${urgentAppointments.length} urgent cases for pod ${targetPodId}` : 
        `No urgent cases found for pod ${targetPodId} - all appointments are medium to low priority`,
      date: new Date().toLocaleDateString("en-SG", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
        timeZone: "Asia/Singapore"
      }),
      debugInfo: {
        dateRange: {
          start: startDate.toISOString(),
          end: endDate.toISOString()
        },
        urgentCasesFound: urgentAppointments.length,
        totalAppointmentsUpcoming: urgentQuery.size,
        podId: targetPodId
      }
    });

  } catch (error) {
    console.error("❌ Error fetching urgent cases:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to fetch urgent cases",
      message: error.message,
      urgentCases: [],
      totalCount: 0,
      hasUrgentCases: false
    });
  }
});


// // GET UPCOMING CASE SUMMARIES - Within next 7 days
// app.post("/get-upcoming-case-summaries", async (req, res) => {
//   const { podiatristId } = req.body;

//   try {
//     console.log('📝 Fetching upcoming case summaries...');
    
//     // Get date range for next 7 days
//     const today = new Date();
//     today.setHours(0, 0, 0, 0);
    
//     const oneWeekFromNow = new Date(today);
//     oneWeekFromNow.setDate(today.getDate() + 7);
//     oneWeekFromNow.setHours(23, 59, 59, 999);

//     console.log('📅 Date range:', {
//       start: today.toISOString(),
//       end: oneWeekFromNow.toISOString()
//     });

//     // Query for upcoming appointments in the next week
//     const upcomingQuery = await db.collection("Appointments")
//       .where("scheduledDate", ">=", admin.firestore.Timestamp.fromDate(today))
//       .where("scheduledDate", "<=", admin.firestore.Timestamp.fromDate(oneWeekFromNow))
//       .where("status", "==", "scheduled")
//       .get();

//     console.log('📊 Found upcoming appointments:', upcomingQuery.size);

//     if (upcomingQuery.empty) {
//       return res.json({
//         success: true,
//         caseSummaries: [],
//         totalCount: 0,
//         message: "No upcoming appointments found for the next 7 days"
//       });
//     }

//     const caseSummaries = [];

//     // Process each appointment
//     for (const appointmentDoc of upcomingQuery.docs) {
//       const appointment = appointmentDoc.data();

//       // Get patient details
//       let patientInfo = {
//         name: appointment.patientId,
//         phone: "N/A",
//         email: "N/A"
//       };

//       try {
//         const patientQuery = await db.collection("Users")
//           .where("userId", "==", appointment.patientId)
//           .limit(1)
//           .get();

//         if (!patientQuery.empty) {
//           const patientData = patientQuery.docs[0].data();
//           patientInfo = {
//             name: `${patientData.firstName || ''} ${patientData.lastName || ''}`.trim(),
//             phone: patientData.phone || "N/A",
//             email: patientData.email || "N/A"
//           };
//         }
//       } catch (patientError) {
//         console.log('⚠️ Patient lookup failed for', appointment.patientId);
//       }

//       const scheduledDate = appointment.scheduledDate.toDate();
      
//       // Calculate days until appointment
//       const daysUntil = Math.ceil((scheduledDate - today) / (1000 * 60 * 60 * 24));
      
//       const caseSummary = {
//         appointmentId: appointmentDoc.id,
//         patientId: appointment.patientId,
//         patientName: patientInfo.name,
//         patientPhone: patientInfo.phone,
//         patientEmail: patientInfo.email,
//         scheduledDateTime: scheduledDate.toLocaleDateString("en-SG", {
//           weekday: "long",
//           year: "numeric",
//           month: "long",
//           day: "numeric",
//           hour: "2-digit",
//           minute: "2-digit",
//           hour12: true,
//           timeZone: "Asia/Singapore"
//         }),
//         scheduledTime: scheduledDate.toLocaleTimeString("en-SG", {
//           hour: "2-digit",
//           minute: "2-digit",
//           hour12: true,
//           timeZone: "Asia/Singapore"
//         }),
//         scheduledDate: scheduledDate.toLocaleDateString("en-SG", {
//           weekday: "long",
//           month: "long",
//           day: "numeric",
//           timeZone: "Asia/Singapore"
//         }),
//         daysUntil: daysUntil,
//         category: appointment.category || "General",
//         urgencyLevel: appointment.urgencyLevel || 4,
//         urgencyText: getUrgencyText(appointment.urgencyLevel),
//         initialDiagnosis: appointment.initialDiagnosis || "Assessment pending",
//         summary: appointment.summary || "No case summary available",
//         status: appointment.status,
//         triageDate: appointment.triageDateTime ? 
//           appointment.triageDateTime.toDate().toLocaleDateString("en-SG", {
//             month: "short",
//             day: "numeric",
//             hour: "2-digit",
//             minute: "2-digit",
//             hour12: true,
//             timeZone: "Asia/Singapore"
//           }) : 'N/A'
//       };

//       caseSummaries.push(caseSummary);
//     }

//     // Sort by scheduled date (earliest first)
//     caseSummaries.sort((a, b) => {
//       return new Date(a.scheduledDateTime) - new Date(b.scheduledDateTime);
//     });

//     console.log('✅ Processed', caseSummaries.length, 'case summaries');

//     return res.json({
//       success: true,
//       caseSummaries: caseSummaries,
//       totalCount: caseSummaries.length,
//       dateRange: {
//         start: today.toLocaleDateString("en-SG"),
//         end: oneWeekFromNow.toLocaleDateString("en-SG")
//       }
//     });

//   } catch (error) {
//     console.error("❌ Error fetching upcoming case summaries:", error);
//     return res.status(500).json({
//       success: false,
//       error: "Failed to fetch case summaries",
//       message: error.message,
//       caseSummaries: [],
//       totalCount: 0
//     });
//   }
// });

app.post("/get-upcoming-case-summaries", async (req, res) => {
  const { podiatristId, podId } = req.body;
  
  // Use podId if provided, fallback to podiatristId for backward compatibility
  const targetPodId = podId || podiatristId;
  
  console.log('📝 Fetching upcoming case summaries for pod:', targetPodId);

  try {
    // Get date range for next 7 days
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const oneWeekFromNow = new Date(today);
    oneWeekFromNow.setDate(today.getDate() + 7);
    oneWeekFromNow.setHours(23, 59, 59, 999);

    console.log('📅 Date range for pod', targetPodId, ':', {
      start: today.toISOString(),
      end: oneWeekFromNow.toISOString()
    });

    // 🔧 CRITICAL FIX: Filter by both date range AND podId
    const caseSummariesQuery = await db.collection("Appointments")
      .where("scheduledDate", ">=", admin.firestore.Timestamp.fromDate(today))
      .where("scheduledDate", "<=", admin.firestore.Timestamp.fromDate(oneWeekFromNow))
      .where("status", "==", "scheduled")
      .where("podId", "==", targetPodId) // 🔧 ADDED: Filter by pod
      .orderBy("scheduledDate", "asc")
      .get();

    console.log(`📊 Found ${caseSummariesQuery.size} appointments in next 7 days for pod ${targetPodId}`);

    if (caseSummariesQuery.empty) {
      return res.json({
        success: true,
        caseSummaries: [],
        totalCount: 0,
        podId: targetPodId,
        message: `No appointments scheduled for pod ${targetPodId} in the next 7 days`,
        dateRange: {
          start: today.toLocaleDateString("en-SG", { 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
          }),
          end: oneWeekFromNow.toLocaleDateString("en-SG", { 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
          })
        }
      });
    }

    // Process each appointment
    const caseSummaries = [];

    for (const appointmentDoc of caseSummariesQuery.docs) {
      const appointment = appointmentDoc.data();
      const appointmentDate = appointment.scheduledDate.toDate();

      // Calculate days until appointment
      const timeDiff = appointmentDate - today;
      const daysUntil = Math.ceil(timeDiff / (1000 * 60 * 60 * 24));

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
        console.log(`⚠️ Patient lookup failed for ${appointment.patientId}:`, patientError.message);
      }

      // Get urgency text
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
          day: 'numeric' 
        }),
        scheduledTime: appointmentDate.toLocaleTimeString('en-SG', { 
          hour: '2-digit', 
          minute: '2-digit', 
          hour12: true 
        }),
        daysUntil: daysUntil,
        urgencyLevel: appointment.urgencyLevel || 3,
        urgencyText: getUrgencyText(appointment.urgencyLevel || 3),
        category: appointment.category || 'General',
        initialDiagnosis: appointment.initialDiagnosis || 'Assessment pending',
        summary: appointment.summary || 'No case summary available',
        status: appointment.status,
        triageDate: appointment.triageDateTime ? 
          appointment.triageDateTime.toDate().toLocaleDateString('en-SG') : 'N/A',
        podId: appointment.podId
      };

      caseSummaries.push(caseSummary);
    }

    console.log(`📝 Processed ${caseSummaries.length} case summaries for pod ${targetPodId}`);

    return res.json({
      success: true,
      caseSummaries: caseSummaries,
      totalCount: caseSummaries.length,
      podId: targetPodId, // 🔧 ADDED: Return which pod the data is for
      message: `Found ${caseSummaries.length} upcoming appointments for pod ${targetPodId}`,
      dateRange: {
        start: today.toLocaleDateString("en-SG", { 
          year: 'numeric', 
          month: 'long', 
          day: 'numeric' 
        }),
        end: oneWeekFromNow.toLocaleDateString("en-SG", { 
          year: 'numeric', 
          month: 'long', 
          day: 'numeric' 
        })
      }
    });

  } catch (error) {
    console.error("❌ Error fetching case summaries:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to fetch case summaries",
      message: error.message,
      caseSummaries: [],
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

// app.post("/get-schedule-by-date", async (req, res) => {
//   const { podiatristId, targetDate, cacheBuster } = req.body; // Add cacheBuster parameter
  
//   try {
//     // CACHE CHECK FIRST - Skip cache if cacheBuster is present
//     const cacheKey = getCacheKey(targetDate, podiatristId);
//     const cachedResult = scheduleCache.get(cacheKey);

//     if (isValidCache(cachedResult) && !cacheBuster) { // Skip cache if cacheBuster exists
//       console.log('⚡ CACHE HIT: Returning cached schedule');
//       return res.json(cachedResult.data);
//     }

//     console.log('📅 CACHE MISS: Fetching fresh schedule for date:', targetDate);
//     if (cacheBuster) {
//       console.log('🧹 CACHE BUSTER: Forced fresh data request');
//     }

//     // OPTIMIZATION 1: Create date range more efficiently
//     let scheduleDate;
//     if (targetDate && targetDate !== 'today') {
//       if (typeof targetDate === 'string' && targetDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
//         scheduleDate = new Date(targetDate + 'T12:00:00+08:00');
//       } else {
//         scheduleDate = new Date(targetDate);
//       }

//       if (isNaN(scheduleDate.getTime())) {
//         return res.status(400).json({
//           success: false,
//           error: "Invalid date format"
//         });
//       }
//     } else {
//       scheduleDate = new Date();
//     }

//     const dateStr = scheduleDate.toISOString().split('T')[0];
//     const startOfDay = new Date(dateStr + 'T00:00:00+08:00');
//     const endOfDay = new Date(dateStr + 'T23:59:59.999+08:00');

//     console.log('🚀 FAST: Querying Firebase...');
//     console.log('🔍 FAST Date string:', dateStr);
//     console.log('🔍 FAST Start of day (Singapore):', startOfDay.toISOString());
//     console.log('🔍 FAST End of day (Singapore):', endOfDay.toISOString());

//     // OPTIMIZATION 2: Single optimized query
//     const appointmentsQuery = await db.collection("Appointments")
//       .where("scheduledDate", ">=", admin.firestore.Timestamp.fromDate(startOfDay))
//       .where("scheduledDate", "<=", admin.firestore.Timestamp.fromDate(endOfDay))
//       .where("status", "==", "scheduled")
//       .get();

//     console.log('⚡ FAST: Found', appointmentsQuery.size, 'appointments');

//     if (appointmentsQuery.empty) {
//       const emptyResult = {
//         success: true,
//         appointments: [],
//         totalCount: 0,
//         message: `No appointments scheduled for ${scheduleDate.toLocaleDateString("en-SG")}`,
//         date: scheduleDate.toLocaleDateString("en-SG", {
//           weekday: "long",
//           year: "numeric",
//           month: "long",
//           day: "numeric",
//           timeZone: "Asia/Singapore"
//         }),
//         isEmpty: true  // ADD EMPTY FLAG FOR DIRECT HANDLING
//       };

//       // CACHE EMPTY RESULT TOO
//       scheduleCache.set(cacheKey, {
//         data: emptyResult,
//         timestamp: Date.now()
//       });

//       return res.json(emptyResult);
//     }

//     // OPTIMIZATION 3: Batch patient lookups with timeout and parallel processing
//     console.log('🔄 FAST: Processing appointments in parallel...');

//     // Get all unique patient IDs first
//     const patientIds = [...new Set(appointmentsQuery.docs.map(doc => doc.data().patientId))];
//     console.log('👥 FAST: Looking up', patientIds.length, 'unique patients');

//     // OPTIMIZATION 4: Batch patient lookup
//     const patientLookupPromises = patientIds.map(async (patientId) => {
//       try {
//         const patientQuery = await Promise.race([
//           db.collection("Users")
//             .where("userId", "==", patientId)
//             .limit(1)
//             .get(),
//           new Promise((_, reject) =>
//             setTimeout(() => reject(new Error('timeout')), 1500) // Reduced timeout
//           )
//         ]);

//         if (!patientQuery.empty) {
//           const patientData = patientQuery.docs[0].data();
//           return {
//             patientId,
//             name: `${patientData.firstName || ''} ${patientData.lastName || ''}`.trim(),
//             phone: patientData.phone || "N/A",
//             email: patientData.email || "N/A"
//           };
//         }
//       } catch (error) {
//         console.log(`⚠️ FAST: Patient lookup failed for ${patientId}:`, error.message);
//       }

//       // Fallback
//       return {
//         patientId,
//         name: patientId,
//         phone: "N/A",
//         email: "N/A"
//       };
//     });

//     // Wait for all patient lookups
//     const patientDataMap = {};
//     const patientResults = await Promise.all(patientLookupPromises);
//     patientResults.forEach(result => {
//       patientDataMap[result.patientId] = result;
//     });

//     console.log('✅ FAST: Patient data retrieved, building response...');

//     // OPTIMIZATION 5: Fast appointment processing
//     const dayAppointments = appointmentsQuery.docs.map(appointmentDoc => {
//       const appointment = appointmentDoc.data();
//       const patientInfo = patientDataMap[appointment.patientId] || {
//         name: appointment.patientId,
//         phone: "N/A",
//         email: "N/A"
//       };

//       const scheduledDate = appointment.scheduledDate.toDate();
//       return {
//         appointmentId: appointmentDoc.id,
//         patientId: appointment.patientId,
//         patientName: patientInfo.name,
//         patientPhone: patientInfo.phone,
//         patientEmail: patientInfo.email,
//         scheduledTime: scheduledDate.toLocaleTimeString("en-SG", {
//           hour: "2-digit",
//           minute: "2-digit",
//           hour12: true,
//           timeZone: "Asia/Singapore"
//         }),
//         scheduledDate: scheduledDate.toLocaleDateString("en-SG", {
//           weekday: "long",
//           year: "numeric",
//           month: "long",
//           day: "numeric",
//           timeZone: "Asia/Singapore"
//         }),
//         category: appointment.category || "General",
//         urgencyLevel: appointment.urgencyLevel || 4,
//         urgencyText: getUrgencyText(appointment.urgencyLevel),
//         initialDiagnosis: appointment.initialDiagnosis || "Assessment pending",
//         summary: appointment.summary || "No additional notes",
//         status: appointment.status
//       };
//     });

//     // OPTIMIZATION 6: Fast JavaScript sorting
//     dayAppointments.sort((a, b) => {
//       if (a.urgencyLevel !== b.urgencyLevel) {
//         return a.urgencyLevel - b.urgencyLevel;
//       }
//       return new Date(`1970-01-01 ${a.scheduledTime}`) - new Date(`1970-01-01 ${b.scheduledTime}`);
//     });

//     console.log('🚀 FAST: Sending response with', dayAppointments.length, 'appointments');

//     const result = {
//       success: true,
//       appointments: dayAppointments,
//       totalCount: dayAppointments.length,
//       date: scheduleDate.toLocaleDateString("en-SG", {
//         weekday: "long",
//         year: "numeric",
//         month: "long",
//         day: "numeric",
//         timeZone: "Asia/Singapore"
//       })
//     };

//     // CACHE THE RESULT FOR FASTER SUBSEQUENT REQUESTS
//     scheduleCache.set(cacheKey, {
//       data: result,
//       timestamp: Date.now()
//     });

//     console.log('💾 CACHED: Schedule cached for future requests');

//     return res.json(result);

//   } catch (error) {
//     console.error("❌ FAST: Error fetching schedule:", error);
//     return res.status(500).json({
//       success: false,
//       error: "Failed to fetch schedule",
//       message: error.message
//     });
//   }
// });

// Fetch list of podiatrists appointments for queue
app.post("/get-schedule-by-date", async (req, res) => {
  const { podiatristId, targetDate, cacheBuster } = req.body; 
  
  try {
    // NEW: Handle "all" dates request for availability filtering
    if (targetDate === "all") {
      console.log('📅 Fetching all scheduled appointments for availability filtering...');
      
      const allAppointmentsQuery = await db.collection("Appointments")
        .where("status", "==", "scheduled")
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
      
      return res.json({
        success: true,
        appointments: allAppointments,
        totalCount: allAppointments.length,
        message: "All scheduled appointments for filtering"
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

app.post('/podiatrist-get-appointments-all', async (req, res) => {
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

      apptSnapshot.docs.forEach(doc => { //Loop and get data from each entry retreived
        const appt = doc.data();
        patientIds.push(appt.patientId);

        //Add data to data object
        const appointment = {
          apptId: doc.id,
          patientId: appt.patientId,
          date: appt.scheduledDate.toDate().toLocaleDateString('en-SG', { year: 'numeric', month: 'long', day: 'numeric' }),
          time: appt.scheduledDate.toDate().toLocaleTimeString('en-SG', { hour: '2-digit', minute: '2-digit', hour12: true }),
          status: appt.status,
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

// Fetch appointments for calendar
app.post('/podiatrist-get-appointments-scheduled', async (req, res) => {
  const { podId } = req.body;
  console.log("🔍 Fetching calendar info for:", podId);

  try {
    // Get appointment
    const apptSnapshot = await db.collection("Appointments") //Get appointments for this pod
      .where("podId", "==", podId)
      .where("status", "==", "scheduled")
      .get();

    let appointments = [];// Make data list
    if (!apptSnapshot.empty) {
      const patientIds = [];

      apptSnapshot.docs.forEach(doc => { //Loop and get data from each entry retrieved
        const appt = doc.data();
        patientIds.push(appt.patientId);

        //Add data to data object - NOW WITH CASE SUMMARY
        const appointment = {
          apptId: doc.id, // ID of document for this appointment (for updating)
          patientId: appt.patientId,
          date: appt.scheduledDate.toDate().toLocaleDateString('en-SG', { year: 'numeric', month: 'long', day: 'numeric' }), // Convert Firestore timestamp to JavaScript Date
          time: appt.scheduledDate.toDate().toLocaleTimeString('en-SG', { hour: '2-digit', minute: '2-digit', hour12: true }), // Convert Firestore timestamp to JavaScript Date
          urgencyLevel: appt.urgencyLevel || 3,
          category: appt.category || 'General',
          initialDiagnosis: appt.initialDiagnosis || 'Assessment pending',
          summary: appt.summary || 'No case summary available'
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
        patient: userMap[appt.patientId] || "Unknown"
      }));

      //Return result in json
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

//Update appointment details + update affected availabilities + SMS notification
app.post('/podiatrist-update-appointment', async (req, res) => {
  const { apptId, updateData, originalSlot } = req.body;
  console.log("🔍 Updating appointment with SMS notification:", apptId);

  try {
    // Get current appointment with patient details
    const appointmentDoc = await db.collection("Appointments").doc(apptId).get();
    
    if (!appointmentDoc.exists) {
      return res.json({
        success: false,
        message: "Appointment not found"
      });
    }

    const currentAppointment = appointmentDoc.data();
    const oldDateTime = currentAppointment.scheduledDate.toDate();
    const patientId = currentAppointment.patientId;

    // Update the appointment in Firebase
    const updates = {
      scheduledDate: admin.firestore.Timestamp.fromDate(new Date(updateData)),
      status: 'scheduled',
      lastModified: admin.firestore.Timestamp.now()
    };

    await db.collection("Appointments").doc(apptId).update(updates);

    // Handle availability updates (your existing logic)
    if (originalSlot) {
      try {
        const oldSlotQuery = await db.collection("Availability")
          .where("availableDate", "==", admin.firestore.Timestamp.fromDate(new Date(originalSlot)))
          .get();

        if (!oldSlotQuery.empty) {
          await oldSlotQuery.docs[0].ref.update({ status: "available" });
        }

        const newSlotQuery = await db.collection("Availability")
          .where("availableDate", "==", admin.firestore.Timestamp.fromDate(new Date(updateData)))
          .get();

        if (!newSlotQuery.empty) {
          await newSlotQuery.docs[0].ref.update({ status: "unavailable" });
        }
      } catch (availabilityError) {
        console.error('⚠️ Availability update failed:', availabilityError);
      }
    }

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

    // Format dates for SMS
    const oldDateFormatted = oldDateTime.toLocaleString("en-SG", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
      timeZone: "Asia/Singapore"
    });
    
    const newDateFormatted = new Date(updateData).toLocaleString("en-SG", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
      timeZone: "Asia/Singapore"
    });

    // Send SMS notification using SMS service
    const smsResult = await smsService.sendAppointmentUpdateSMS(
      apptId,
      patientId,
      oldDateFormatted,
      newDateFormatted,
      podiatristName
    );

    let smsStatus = 'no_phone';
    if (smsResult.success) {
      smsStatus = 'sent';
    } else if (smsResult.error === 'no_phone') {
      smsStatus = 'no_phone';
    } else if (smsResult.error === 'disabled') {
      smsStatus = 'disabled';
    } else {
      smsStatus = 'failed';
    }

    // Return enhanced response
    return res.json({
      success: true,
      message: "Appointment updated successfully",
      appointmentId: apptId,
      oldDateTime: oldDateFormatted,
      newDateTime: newDateFormatted,
      patientName: smsResult.patientName || 'Unknown',
      smsStatus: smsStatus,
      clearCache: true,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error("❌ Appointment update error:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to update appointment.",
      message: error.message
    });
  }
});

app.post('/podiatrist-cancel-appointment', async (req, res) => {
  const { apptId, originalSlot } = req.body;
  console.log("🔍 Canceling appointment with SMS notification:", apptId);

  try {
    // Get current appointment with patient details
    const appointmentDoc = await db.collection("Appointments").doc(apptId).get();
    
    if (!appointmentDoc.exists) {
      return res.json({
        success: false,
        message: "Appointment not found"
      });
    }

    const currentAppointment = appointmentDoc.data();
    const oldDateTime = currentAppointment.scheduledDate.toDate();
    const patientId = currentAppointment.patientId;

    // Update the appointment in Firebase
    const updates = {
      status: 'cancelled',
      lastModified: admin.firestore.Timestamp.now()
    };

    await db.collection("Appointments").doc(apptId).update(updates);

    // Handle availability updates (your existing logic)
    if (originalSlot) {
      try {
        const oldSlotQuery = await db.collection("Availability")
          .where("availableDate", "==", admin.firestore.Timestamp.fromDate(new Date(originalSlot)))
          .get();

        if (!oldSlotQuery.empty) {
          await oldSlotQuery.docs[0].ref.update({ status: "available" });
        }
      } catch (availabilityError) {
        console.error('⚠️ Availability update failed:', availabilityError);
      }
    }

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

    // Format dates for SMS
    // const oldDateFormatted = oldDateTime.toLocaleString("en-SG", {
    //   weekday: "long",
    //   year: "numeric",
    //   month: "long",
    //   day: "numeric",
    //   hour: "2-digit",
    //   minute: "2-digit",
    //   hour12: true,
    //   timeZone: "Asia/Singapore"
    // });

    // // Send SMS notification using SMS service
    // const smsResult = await smsService.sendAppointmentUpdateSMS(
    //   apptId,
    //   patientId,
    //   oldDateFormatted,
    //   podiatristName
    // );

    // let smsStatus = 'no_phone';
    // if (smsResult.success) {
    //   smsStatus = 'sent';
    // } else if (smsResult.error === 'no_phone') {
    //   smsStatus = 'no_phone';
    // } else if (smsResult.error === 'disabled') {
    //   smsStatus = 'disabled';
    // } else {
    //   smsStatus = 'failed';
    // }

    // Return enhanced response
    return res.json({
      success: true,
      message: "Appointment cancelled successfully",
      appointmentId: apptId,
      oldDateTime: oldDateFormatted,
      // patientName: smsResult.patientName || 'Unknown',
      // smsStatus: smsStatus,
      clearCache: true,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error("❌ Appointment cancel error:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to cancel appointment.",
      message: error.message
    });
  }
});

// Get appointments of ALL patients
app.post('/get-all-appointments', async (req, res) => {
  console.log("🔍 Fetching all appointments");
  try {
    // Get appointment
    const apptSnapshot = await db.collection("Appointments")//Get all appointments
      .get();

    let appointments = [];// Make data list
    if (!apptSnapshot.empty) {
      const patientIds = [];

      apptSnapshot.docs.forEach(doc => { //Loop and get data from each entry retreived
        const appt = doc.data();
        patientIds.push(appt.patientId);

        //Add data to data object
        const appointment = {
          apptId: doc.id,
          patientId: appt.patientId,
          date: appt.scheduledDate.toDate().toLocaleDateString('en-SG', { year: 'numeric', month: 'long', day: 'numeric' }),
          time: appt.scheduledDate.toDate().toLocaleTimeString('en-SG', { hour: '2-digit', minute: '2-digit', hour12: true }),
          status: appt.status,
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

    } else {
      console.log("❌ No Appointments found");
      return res.json({
        response: "No Appointments Found",
        appointments: null
      });
    }
  } catch (error) {
    console.error("❌ Error in /get-all-appointments:", error);
    res.status(500).json({ error: "Failed to fetch queue" });
  }
});

//Get availability for podiatrist
app.post('/podiatrist-get-availability', async (req, res) => {
  const { podId } = req.body;
  console.log("🔍 Fetching availabilities info for:", podId);

  try {
    // Get availabilities
    const availSnapshot = await db.collection("Availability")//Get availabilities for this pod
      .where("podId", "==", podId)
      .where("status", "==", "available")
      .orderBy("availableDate")
      .get();

    let availabilities = [];// Make data list
    if (!availSnapshot.empty) {
      availSnapshot.docs.forEach(doc => { //Loop and get data from each entry retreived
        const avail = doc.data();

        availabilities.push(avail.availableDate.toDate()); //Put data object into availabilities list
      });

      //Return result in json
      return res.json({
        availabilities
      });

    } else {
      console.log("❌ No available slots found");
      return res.json({
        response: "No Available Slots Found",
        availabilities: null
      });
    }
  } catch (error) {
    console.error("❌ Error in /podiatrist-get-availability:", error);
    res.status(500).json({ error: "Failed to fetch availability" });
  }
});

//Get full patient list with appointments
// Get all patients from users collection (where role = patient)
// loop through patient list and query appointmetn collection for relevant appointments (patient_Id = id and status = not over)
// put appointments in a nexted list, if no appointments are found, remove patient from list




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

// EDIT APPOINTMENT ROUTE + SMS NOTIFICATION
app.post("/edit-appointment", async (req, res) => {
  const { patientId, appointmentId, newDateTime, podiatristId } = req.body;

  try {
    console.log('📝 Editing appointment with SMS notification:', patientId, 'to:', newDateTime);

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

    // Send SMS notification
    const smsResult = await smsService.sendAppointmentUpdateSMS(
      appointmentDoc.id,
      patientId,
      oldDateFormatted,
      newDateFormatted,
      podiatristName
    );

    return res.json({
      success: true,
      patientName: smsResult.patientName || 'Unknown',
      newDateTime: newDateFormatted,
      oldDateTime: oldDateFormatted,
      smsStatus: smsResult.success ? 'sent' : 'failed',
      smsError: smsResult.error
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

// GET TODAY'S DASHBOARD METRICS
app.post("/get-dashboard-metrics", async (req, res) => {
  const { podiatristId } = req.body;

  try {
    console.log('📊 Fetching dashboard metrics...');

    // Get today's date range
    const today = new Date();
    const startOfDay = new Date(today);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(today);
    endOfDay.setHours(23, 59, 59, 999);

    // Get yesterday's date for completed appointments
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);

    console.log('🔍 Date ranges:');
    console.log('  Today:', startOfDay, 'to', endOfDay);
    console.log('  Before today (completed):', yesterday);

    // 1. GET TODAY'S APPOINTMENTS (Total Appointments)
    const todayAppointmentsQuery = await db.collection("Appointments")
      .where("scheduledDate", ">=", admin.firestore.Timestamp.fromDate(startOfDay))
      .where("scheduledDate", "<=", admin.firestore.Timestamp.fromDate(endOfDay))
      .where("status", "==", "scheduled")
      .get();

    const totalAppointments = todayAppointmentsQuery.size;
    console.log('📅 Total appointments today:', totalAppointments);

    // 2. GET URGENT CASES (Urgency level 1 and 2)
    let urgentCount = 0;
    todayAppointmentsQuery.docs.forEach(doc => {
      const appointment = doc.data();
      if (appointment.urgencyLevel <= 2) {
        urgentCount++;
      }
    });
    console.log('🚨 Urgent cases today:', urgentCount);

    // 3. GET COMPLETED APPOINTMENTS (Past appointments)
    const completedAppointmentsQuery = await db.collection("Appointments")
      .where("scheduledDate", "<", admin.firestore.Timestamp.fromDate(startOfDay))
      .where("status", "==", "scheduled")
      .get();

    const completedAppointments = completedAppointmentsQuery.size;
    console.log('✅ Completed appointments (past dates):', completedAppointments);

    // 4. CALCULATE ADDITIONAL METRICS
    let highRiskCount = 0;
    let mskCount = 0;

    todayAppointmentsQuery.docs.forEach(doc => {
      const appointment = doc.data();
      if (appointment.urgencyLevel === 3) highRiskCount++;
      if (appointment.urgencyLevel === 4) mskCount++;
    });

    const result = {
      success: true,
      metrics: {
        totalAppointments,
        urgentCases: urgentCount,
        completedAppointments,
        highRiskCases: highRiskCount,
        mskCases: mskCount
      },
      date: today.toLocaleDateString("en-SG", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
        timeZone: "Asia/Singapore"
      }),
      lastUpdated: new Date().toISOString()
    };

    console.log('📊 Dashboard metrics calculated:', result.metrics);
    return res.json(result);

  } catch (error) {
    console.error("❌ Error fetching dashboard metrics:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to fetch dashboard metrics",
      message: error.message
    });
  }
});

// // OPTIMIZED GET REAL-TIME NOTIFICATIONS - MUCH FASTER
// app.post("/get-notifications", async (req, res) => {
//   const { podiatristId } = req.body;

//   try {
//     console.log('🔔 FAST: Fetching notifications...');

//     const notifications = [];
//     const now = new Date();

//     // Get today's date range  
//     const startOfDay = new Date(now);
//     startOfDay.setHours(0, 0, 0, 0);

//     // CHANGED: Extend end date to include next 2 days
//     const endOfDay = new Date(now);
//     endOfDay.setDate(endOfDay.getDate() + 2); // Add 2 days
//     endOfDay.setHours(23, 59, 59, 999);

//     // SINGLE OPTIMIZED QUERY for today's appointments
//     const todayAppointmentsQuery = await db.collection("Appointments")
//       .where("scheduledDate", ">=", admin.firestore.Timestamp.fromDate(startOfDay))
//       .where("scheduledDate", "<=", admin.firestore.Timestamp.fromDate(endOfDay))
//       .where("status", "==", "scheduled")
//       .get();

//     console.log('⚡ FAST: Found', todayAppointmentsQuery.size, 'appointments');

//     // OPTIMIZATION 2: Process all appointments in single loop
//     const next2Hours = new Date(now.getTime() + (2 * 60 * 60 * 1000));
//     const next30Min = new Date(now.getTime() + (30 * 60 * 1000));

//     // OPTIMIZATION 3: Batch patient lookups
//     const patientIds = new Set();
//     const appointmentData = [];

//     todayAppointmentsQuery.docs.forEach(doc => {
//       const appointment = doc.data();
//       const scheduledTime = appointment.scheduledDate.toDate();

//       patientIds.add(appointment.patientId);
//       appointmentData.push({
//         id: doc.id,
//         ...appointment,
//         scheduledTime
//       });
//     });

//     // OPTIMIZATION 4: Single batch patient lookup instead of individual queries
//     const patientMap = {};
//     if (patientIds.size > 0) {
//       const patientQuery = await db.collection("Users")
//         .where("userId", "in", Array.from(patientIds))
//         .get();

//       patientQuery.docs.forEach(doc => {
//         const data = doc.data();
//         patientMap[data.userId] = `${data.firstName} ${data.lastName}`.trim();
//       });
//     }

//     // OPTIMIZATION 5: Process notifications in single loop
//     appointmentData.forEach(appointment => {
//       const patientName = patientMap[appointment.patientId] || appointment.patientId;
//       const daysUntil = Math.round((appointment.scheduledTime - now) / (1000 * 60 * 60 * 24));

//       // Get formatted appointment time
//       const appointmentTime = appointment.scheduledTime.toLocaleTimeString("en-SG", {
//         hour: "2-digit",
//         minute: "2-digit",
//         hour12: true,
//         timeZone: "Asia/Singapore"
//       });

//       // Urgent appointments (next 2 hours, urgency 1-2)
//       if (appointment.scheduledTime <= next2Hours && appointment.urgencyLevel <= 2) {
//         notifications.push({
//           id: `urgent_${appointment.id}`,
//           type: "urgent",
//           title: "Urgent Appointment",
//           message: `${patientName} - ${appointment.category} today at ${appointmentTime}`,
//           timestamp: now.toISOString(),
//           priority: 1,
//           appointmentId: appointment.id,
//           patientId: appointment.patientId
//         });
//       }
//       // Upcoming appointments (next 30 minutes, urgency 3-4)
//       else if (appointment.scheduledTime <= next30Min && appointment.urgencyLevel > 2) {
//         notifications.push({
//           id: `upcoming_${appointment.id}`,
//           type: "upcoming",
//           title: "Upcoming Appointment",
//           message: `${patientName} - ${appointment.category} today at ${appointmentTime}`,
//           timestamp: now.toISOString(),
//           priority: 2,
//           appointmentId: appointment.id,
//           patientId: appointment.patientId
//         });
//       }
//       // NEW: Tomorrow's appointments (urgent cases only)
//       else if (daysUntil === 1 && appointment.urgencyLevel <= 2) {
//         notifications.push({
//           id: `tomorrow_urgent_${appointment.id}`,
//           type: "urgent",
//           title: "Urgent Appointment Tomorrow",
//           message: `${patientName} - ${appointment.category} tomorrow at ${appointmentTime}`,
//           timestamp: now.toISOString(),
//           priority: 3,
//           appointmentId: appointment.id,
//           patientId: appointment.patientId
//         });
//       }
//       // NEW: Day after tomorrow's appointments (urgent cases only)
//       else if (daysUntil === 2 && appointment.urgencyLevel <= 2) {
//         notifications.push({
//           id: `day_after_urgent_${appointment.id}`,
//           type: "reminder",
//           title: "Urgent Appointment in 2 Days",
//           message: `${patientName} - ${appointment.category} in 2 days at ${appointmentTime}`,
//           timestamp: now.toISOString(),
//           priority: 4,
//           appointmentId: appointment.id,
//           patientId: appointment.patientId
//         });
//       }
//       // NEW: Tomorrow's regular appointments (urgency 3-4)
//       else if (daysUntil === 1 && appointment.urgencyLevel > 2) {
//         notifications.push({
//           id: `tomorrow_regular_${appointment.id}`,
//           type: "reminder",
//           title: "Appointment Tomorrow",
//           message: `${patientName} - ${appointment.category} tomorrow at ${appointmentTime}`,
//           timestamp: now.toISOString(),
//           priority: 5,
//           appointmentId: appointment.id,
//           patientId: appointment.patientId
//         });
//       }
//     });


//     // OPTIMIZATION 6: Fast JavaScript sorting
//     notifications.sort((a, b) => a.priority - b.priority);
//     const limitedNotifications = notifications.slice(0, 5);

//     console.log('⚡ FAST: Generated', limitedNotifications.length, 'notifications');

//     return res.json({
//       success: true,
//       notifications: limitedNotifications,
//       totalCount: notifications.length,
//       lastUpdated: now.toISOString()
//     });

//   } catch (error) {
//     console.error("❌ Error fetching notifications:", error);
//     return res.status(500).json({
//       success: false,
//       error: "Failed to fetch notifications",
//       message: error.message
//     });
//   }
// });

// REPLACE your /get-notifications endpoint in server.js with this FIXED version

app.post("/get-notifications", async (req, res) => {
  const { podiatristId, podId } = req.body; // 🔧 FIXED: Accept both parameters
  
  // Use podId if provided, fallback to podiatristId for backward compatibility
  const targetPodId = podId || podiatristId;
  
  console.log('🔔 FAST: Fetching notifications for pod:', targetPodId);

  try {
    const notifications = [];
    const now = new Date();

    // Get today's date range  
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);

    // CHANGED: Extend end date to include next 2 days
    const endOfDay = new Date(now);
    endOfDay.setDate(endOfDay.getDate() + 2); // Add 2 days
    endOfDay.setHours(23, 59, 59, 999);

    // 🔧 CRITICAL FIX: Filter appointments by podId
    const todayAppointmentsQuery = await db.collection("Appointments")
      .where("scheduledDate", ">=", admin.firestore.Timestamp.fromDate(startOfDay))
      .where("scheduledDate", "<=", admin.firestore.Timestamp.fromDate(endOfDay))
      .where("status", "==", "scheduled")
      .where("podId", "==", targetPodId) // 🔧 ADDED: Filter by pod
      .get();

    console.log(`⚡ FAST: Found ${todayAppointmentsQuery.size} appointments for pod ${targetPodId}`);

    // Get patient names in batch
    const patientIds = [];
    const appointmentMap = new Map();

    todayAppointmentsQuery.docs.forEach(doc => {
      const appointment = doc.data();
      patientIds.push(appointment.patientId);
      appointmentMap.set(appointment.patientId, {
        id: doc.id,
        ...appointment,
        scheduledDateTime: appointment.scheduledDate.toDate()
      });
    });

    let patientNames = {};
    if (patientIds.length > 0) {
      // Get patient names in batch (max 10 per query due to Firestore 'in' limit)
      const batches = [];
      for (let i = 0; i < patientIds.length; i += 10) {
        batches.push(patientIds.slice(i, i + 10));
      }

      for (const batch of batches) {
        const userQuery = await db.collection("Users")
          .where("userId", "in", batch)
          .get();

        userQuery.docs.forEach(userDoc => {
          const userData = userDoc.data();
          patientNames[userData.userId] = `${userData.firstName || ''} ${userData.lastName || ''}`.trim();
        });
      }
    }

    // Generate notifications for each appointment
    appointmentMap.forEach((appointment, patientId) => {
      const patientName = patientNames[patientId] || "Unknown Patient";
      const appointmentDateTime = appointment.scheduledDateTime;
      const appointmentTime = appointmentDateTime.toLocaleTimeString("en-SG", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
        timeZone: "Asia/Singapore"
      });

      // Calculate time until appointment
      const timeDiff = appointmentDateTime - now;
      const hoursUntil = Math.floor(timeDiff / (1000 * 60 * 60));
      const minutesUntil = Math.floor((timeDiff % (1000 * 60 * 60)) / (1000 * 60));

      // TODAY'S URGENT CASES (Level 1 & 2)
      if (appointment.urgencyLevel <= 2 && hoursUntil >= 0 && hoursUntil <= 24) {
        notifications.push({
          id: `urgent_${appointment.id}`,
          type: "urgent",
          title: "🚨 Urgent Case Today",
          message: `${patientName} - ${appointment.category} at ${appointmentTime}`,
          timestamp: now.toISOString(),
          priority: appointment.urgencyLevel,
          appointmentId: appointment.id,
          patientId: patientId
        });
      }

      // UPCOMING APPOINTMENTS (Next 2-4 hours)
      if (hoursUntil >= 2 && hoursUntil <= 4) {
        notifications.push({
          id: `upcoming_${appointment.id}`,
          type: "reminder",
          title: "⏰ Appointment Soon",
          message: `${patientName} - ${appointment.category} in ${hoursUntil}h ${minutesUntil}m`,
          timestamp: now.toISOString(),
          priority: 3,
          appointmentId: appointment.id,
          patientId: patientId
        });
      }

      // TOMORROW'S REGULAR APPOINTMENTS (Level 3+)
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(0, 0, 0, 0);
      const dayAfterTomorrow = new Date(tomorrow);
      dayAfterTomorrow.setHours(23, 59, 59, 999);

      if (appointmentDateTime >= tomorrow && appointmentDateTime <= dayAfterTomorrow && appointment.urgencyLevel > 2) {
        notifications.push({
          id: `tomorrow_regular_${appointment.id}`,
          type: "reminder",
          title: "Appointment Tomorrow",
          message: `${patientName} - ${appointment.category} tomorrow at ${appointmentTime}`,
          timestamp: now.toISOString(),
          priority: 5,
          appointmentId: appointment.id,
          patientId: patientId
        });
      }
    });

    // OPTIMIZATION: Fast JavaScript sorting
    notifications.sort((a, b) => a.priority - b.priority);
    const limitedNotifications = notifications.slice(0, 5);

    console.log(`⚡ FAST: Generated ${limitedNotifications.length} notifications for pod ${targetPodId}`);

    return res.json({
      success: true,
      notifications: limitedNotifications,
      totalCount: notifications.length,
      lastUpdated: now.toISOString(),
      podId: targetPodId // 🔧 ADDED: Return which pod the notifications are for
    });

  } catch (error) {
    console.error("❌ Error fetching notifications:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to fetch notifications",
      message: error.message
    });
  }
});

// GET SPECIFIC PATIENT APPOINTMENTS FOR EDITING
app.post("/get-patient-appointments", async (req, res) => {
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
        .get(); // Get all users and filter in JavaScript

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

    // Pattern: "5th july" (assume current year, with ordinals)
    match = dateString.match(/(\d{1,2})(st|nd|rd|th)?\s+(january|february|march|april|may|june|july|august|september|october|november|december)/i);
    if (match) {
      const day = match[1].padStart(2, '0');
      const month = monthNames[match[3].toLowerCase()];
      const year = new Date().getFullYear();
      console.log('✅ Matched pattern "5th july" (current year):', { day, month, year });
      return `${year}-${month}-${day}`;
    }

    // Pattern: "july 5th" (assume current year, with ordinals)
    match = dateString.match(/(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{1,2})(st|nd|rd|th)?/i);
    if (match) {
      const month = monthNames[match[1].toLowerCase()];
      const day = match[2].padStart(2, '0');
      const year = new Date().getFullYear();
      console.log('✅ Matched pattern "july 5th" (current year):', { day, month, year });
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

// Test SMS system from podiatrist dashboard
app.post('/test-sms-system', async (req, res) => {
  try {
    const { phoneNumber, message } = req.body;
    
    if (!phoneNumber || !message) {
      return res.json({
        success: false,
        message: 'Phone number and message are required'
      });
    }
    
    const result = await smsService.sendSMS(phoneNumber, message);
    
    res.json({
      success: result.success,
      message: result.success ? 'Test SMS sent successfully!' : `Test SMS failed: ${result.error}`,
      details: result
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'SMS test failed',
      error: error.message
    });
  }
});

// Set default path to login.html
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "login.html"));
});

// Start server
const PORT = 3000;
app.listen(PORT, () => {
  console.log(`✅ Server running at http://localhost:${PORT}`);
  console.log(`📱 SMS Service initialized: ${smsService.isInitialized ? 'ENABLED' : 'DISABLED'}`);
});