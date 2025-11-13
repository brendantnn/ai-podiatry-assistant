const { onRequest } = require("firebase-functions/v2/https");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { defineSecret } = require("firebase-functions/params");
const express = require("express");
const cors = require("cors");
const path = require("path");

// ========================================
// SECRETS
// ========================================
const TWILIO_ACCOUNT_SID = defineSecret("TWILIO_ACCOUNT_SID");
const TWILIO_AUTH_TOKEN = defineSecret("TWILIO_AUTH_TOKEN");
const TWILIO_PHONE_NUMBER = defineSecret("TWILIO_PHONE_NUMBER");
const TWILIO_VERIFY_SERVICE_SID = defineSecret("TWILIO_VERIFY_SERVICE_SID");
const OPENAI_API_KEY = defineSecret("OPENAI_API_KEY");

// ========================================
// EXPRESS SETUP
// ========================================
const app = express();

const corsOptions = {
  origin: true,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
};

app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files from public directory
app.use(express.static(path.join(__dirname, '../public')));

// ========================================
// IMPORT ROUTES
// ========================================
const { db, admin } = require("./firebase");
const patientRoutes = require("./patientRoutes");
const podiatristRoutes = require("./podiatristRoutes");
const { setupSMSRoutes, setupPatientSMSRoutes } = require("./smsRoutes");
const SMSService = require("./smsService");

const smsService = new SMSService(db, admin);

// ========================================
// MOUNT ROUTES
// ========================================
app.use("/patient", patientRoutes);
app.use("/api", podiatristRoutes); 
app.use("/sms", setupSMSRoutes(smsService));
app.use("/patient", setupPatientSMSRoutes(smsService));

// ========================================
// SERVE HTML FILES
// ========================================
app.get('/patient.html', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/patient.html'));
});

app.get('/podiatrist.html', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/podiatrist.html'));
});

app.get('/login.html', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/login.html'));
});

// ========================================
// MAIN CLOUD FUNCTION
// ========================================
exports.api = onRequest(
  {
    region: "asia-southeast1",
    cors: true,
    secrets: [
      TWILIO_ACCOUNT_SID,
      TWILIO_AUTH_TOKEN,
      TWILIO_PHONE_NUMBER,
      TWILIO_VERIFY_SERVICE_SID,
      OPENAI_API_KEY,
    ],
  },
  app
);

// ========================================
// SCHEDULED FUNCTIONS
// ========================================
exports.dailySmsReminders = onSchedule(
  {
    schedule: "0 9 * * *",
    timeZone: "Asia/Singapore",
    region: "asia-southeast1",
    secrets: [
      TWILIO_ACCOUNT_SID,
      TWILIO_AUTH_TOKEN,
      TWILIO_PHONE_NUMBER,
      TWILIO_VERIFY_SERVICE_SID,
    ],
  },
  async () => {
    if (typeof smsService.sendBulkSMSReminders === "function") {
      await smsService.sendBulkSMSReminders();
    }
  }
);