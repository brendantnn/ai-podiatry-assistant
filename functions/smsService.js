// ========================================
// SMS SERVICE MODULE - smsService.js (Cloud Functions–safe)
// ========================================

const twilio = require("twilio");

class SMSService {
  constructor(db, admin) {
    this.db = db;
    this.admin = admin;

    // Twilio creds are read from environment.
    // In Firebase Functions v2, these should be set as "secrets"
    // and attached to the functions in index.js.
    this.accountSid = process.env.TWILIO_ACCOUNT_SID || "";
    this.authToken = process.env.TWILIO_AUTH_TOKEN || "";
    this.twilioFrom = process.env.TWILIO_PHONE_NUMBER || "";
    this.verifyServiceSid = process.env.TWILIO_VERIFY_SERVICE_SID || "";

    this.isInitialized = Boolean(this.accountSid && this.authToken);
    this.twilioClient = this.isInitialized
      ? twilio(this.accountSid, this.authToken)
      : null;

    if (this.isInitialized) {
      console.log("✅ SMS Service: Twilio client initialized");
    } else {
      console.warn(
        "⚠️ SMS Service: Twilio credentials not found - SMS functionality disabled"
      );
    }
  }

  // ========================================
  // CORE SMS FUNCTIONS
  // ========================================

  async sendSMS(phoneNumber, message) {
    if (!this.isInitialized) {
      console.error("❌ SMS Service: Twilio client not initialized");
      return { success: false, error: "SMS service not available" };
    }

    try {
      const formattedPhone = this.formatPhoneNumber(phoneNumber);
      const smsResult = await this.twilioClient.messages.create({
        body: message,
        from: this.twilioFrom,
        to: formattedPhone,
      });

      // Log to Firestore
      await this.logSMSToFirestore(
        phoneNumber,
        message,
        smsResult.sid,
        "sent"
      );

      return {
        success: true,
        messageId: smsResult.sid,
        status: smsResult.status,
      };
    } catch (error) {
      console.error("❌ SMS Service: SMS sending failed:", error);
      await this.logSMSToFirestore(
        phoneNumber,
        message,
        null,
        "failed",
        error.message
      );
      return { success: false, error: error.message };
    }
  }

  formatPhoneNumber(phoneNumber) {
    const phoneString = String(phoneNumber);
    const cleaned = phoneString.replace(/\D/g, "");
    if (cleaned.startsWith("65")) return `+${cleaned}`;
    if (cleaned.startsWith("8") || cleaned.startsWith("9"))
      return `+65${cleaned}`;
    return `+65${cleaned}`;
  }

  async logSMSToFirestore(
    phoneNumber,
    message,
    messageId,
    status,
    errorMessage = null
  ) {
    try {
      await this.db.collection("SMSNotifications").add({
        phoneNumber,
        message,
        messageId,
        status,
        errorMessage,
        createdAt: this.admin.firestore.Timestamp.now(),
      });
    } catch (error) {
      console.error(
        "❌ SMS Service: Failed to log SMS to Firestore:",
        error
      );
    }
  }

  // ========================================
  // SMS TEMPLATES
  // ========================================

  generateAppointmentUpdateSMS(
    patientName,
    oldDateTime,
    newDateTime,
    podiatristName
  ) {
    return `Your appt is updated to ${newDateTime}.`;
  }

  generateAppointmentReminderSMS(patientName, dateTime, podiatristName) {
    return `Reminder: Your appt is tomorrow at ${dateTime}.`;
  }

  generateAppointmentCancellationSMS(patientName, dateTime, podiatristName) {
    return `Your appt on ${dateTime} has been cancelled. Call 6321-4377 to reschedule.`;
  }

  // ========================================
  // APPOINTMENT NOTIFICATION LOGGING
  // ========================================

  async logAppointmentNotification(
    appointmentId,
    patientId,
    type,
    action,
    message,
    status
  ) {
    try {
      await this.db.collection("AppointmentNotifications").add({
        appointmentId,
        patientId,
        notificationType: type,
        action,
        message,
        status,
        createdAt: this.admin.firestore.Timestamp.now(),
      });
    } catch (error) {
      console.error(
        "❌ SMS Service: Failed to log appointment notification:",
        error
      );
    }
  }

  // ========================================
  // APPOINTMENT UPDATE WITH SMS
  // ========================================

  async sendAppointmentUpdateSMS(
    appointmentId,
    patientId,
    oldDateTime,
    newDateTime,
    podiatristName
  ) {
    try {
      const patientQuery = await this.db
        .collection("Users")
        .where("userId", "==", patientId)
        .limit(1)
        .get();
      if (patientQuery.empty)
        return { success: false, error: "Patient not found" };

      const patientData = patientQuery.docs[0].data();
      const patientName = `${patientData.firstName || ""} ${
        patientData.lastName || ""
      }`.trim();
      const patientPhone = patientData.phone;
      const smsEnabled = patientData.smsEnabled !== false;

      if (!patientPhone)
        return {
          success: false,
          error: "no_phone",
          message: "Patient has no phone number",
        };
      if (!smsEnabled)
        return {
          success: false,
          error: "disabled",
          message: "SMS notifications disabled for patient",
        };

      const smsMessage = this.generateAppointmentUpdateSMS(
        patientName,
        oldDateTime,
        newDateTime,
        podiatristName
      );
      const smsResult = await this.sendSMS(patientPhone, smsMessage);

      await this.logAppointmentNotification(
        appointmentId,
        patientId,
        "sms",
        "appointment_updated",
        smsMessage,
        smsResult.success ? "sent" : "failed"
      );

      return {
        success: smsResult.success,
        status: smsResult.success ? "sent" : "failed",
        error: smsResult.error,
        patientName,
        messageId: smsResult.messageId,
      };
    } catch (error) {
      console.error(
        "❌ SMS Service: Appointment update SMS failed:",
        error
      );
      return { success: false, error: error.message };
    }
  }

  // ========================================
  // BULK SMS REMINDERS (called by scheduled function in index.js)
  // ========================================

  async sendBulkSMSReminders() {
    try {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);

      const startOfTomorrow = new Date(tomorrow);
      startOfTomorrow.setHours(0, 0, 0, 0);
      const endOfTomorrow = new Date(tomorrow);
      endOfTomorrow.setHours(23, 59, 59, 999);

      const appointmentsQuery = await this.db
        .collection("Appointments")
        .where(
          "scheduledDate",
          ">=",
          this.admin.firestore.Timestamp.fromDate(startOfTomorrow)
        )
        .where(
          "scheduledDate",
          "<=",
          this.admin.firestore.Timestamp.fromDate(endOfTomorrow)
        )
        .where("status", "==", "scheduled")
        .get();

      let sentCount = 0;
      let failedCount = 0;

      for (const doc of appointmentsQuery.docs) {
        const appointment = doc.data();

        // get patient
        const patientQuery = await this.db
          .collection("Users")
          .where("userId", "==", appointment.patientId)
          .limit(1)
          .get();
        if (patientQuery.empty) continue;

        const patient = patientQuery.docs[0].data();
        const patientName = `${patient.firstName || ""} ${
          patient.lastName || ""
        }`.trim();

        if (!patient.phone || patient.smsEnabled === false) continue;

        // get podiatrist
        let podiatristName = "Doctor";
        const podQ = await this.db
          .collection("Users")
          .where("userId", "==", appointment.podId)
          .limit(1)
          .get();
        if (!podQ.empty) {
          const pod = podQ.docs[0].data();
          podiatristName = `${pod.firstName || ""} ${
            pod.lastName || ""
          }`.trim();
        }

        const appointmentTime = appointment.scheduledDate
          .toDate()
          .toLocaleString("en-SG", {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
            hour12: true,
            timeZone: "Asia/Singapore",
          });

        const msg = this.generateAppointmentReminderSMS(
          patientName,
          appointmentTime,
          podiatristName
        );
        const result = await this.sendSMS(patient.phone, msg);

        if (result.success) {
          sentCount++;
          await this.logAppointmentNotification(
            doc.id,
            appointment.patientId,
            "sms",
            "appointment_reminder",
            msg,
            "sent"
          );
        } else {
          failedCount++;
        }

        await new Promise((r) => setTimeout(r, 1000)); // simple rate-limit
      }

      return {
        success: true,
        totalAppointments: appointmentsQuery.size,
        sentCount,
        failedCount,
      };
    } catch (error) {
      console.error("❌ SMS Service: Bulk SMS reminder failed:", error);
      return { success: false, error: error.message };
    }
  }

  // ========================================
  // MANUAL SMS
  // ========================================

  async sendManualSMS(patientId, message, type = "manual") {
    try {
      const patientQuery = await this.db
        .collection("Users")
        .where("userId", "==", patientId)
        .limit(1)
        .get();
      if (patientQuery.empty)
        return { success: false, error: "Patient not found" };

      const patient = patientQuery.docs[0].data();
      const patientName = `${patient.firstName || ""} ${
        patient.lastName || ""
      }`.trim();

      if (!patient.phone)
        return { success: false, error: "Patient has no phone number" };
      if (patient.smsEnabled === false)
        return {
          success: false,
          error: "Patient has disabled SMS notifications",
        };

      const result = await this.sendSMS(patient.phone, message);
      if (result.success) {
        await this.logAppointmentNotification(
          null,
          patientId,
          "sms",
          type,
          message,
          "sent"
        );
      }
      return {
        success: result.success,
        patientName,
        error: result.error,
        messageId: result.messageId,
      };
    } catch (error) {
      console.error("❌ SMS Service: Manual SMS sending error:", error);
      return { success: false, error: error.message };
    }
  }

  // ========================================
  // ANALYTICS
  // ========================================

  async getAnalytics(period = "week") {
    try {
      const now = new Date();
      const startDate = new Date(now);
      if (period === "week") startDate.setDate(now.getDate() - 7);
      else if (period === "month") startDate.setMonth(now.getMonth() - 1);
      else if (period === "day") startDate.setDate(now.getDate() - 1);

      const smsQuery = await this.db
        .collection("SMSNotifications")
        .where(
          "createdAt",
          ">=",
          this.admin.firestore.Timestamp.fromDate(startDate)
        )
        .get();

      let totalSent = 0,
        delivered = 0,
        failed = 0;
      smsQuery.docs.forEach((doc) => {
        const sms = doc.data();
        totalSent++;
        if (sms.status === "sent" || sms.status === "delivered") delivered++;
        else if (sms.status === "failed") failed++;
      });

      const deliveryRate =
        totalSent > 0 ? Math.round((delivered / totalSent) * 100) : 0;
      return { totalSent, delivered, failed, deliveryRate, period };
    } catch (error) {
      console.error("❌ SMS Service: Analytics error:", error);
      throw error;
    }
  }

  // ========================================
  // PREFERENCES
  // ========================================

  async updateSMSPreferences(patientId, preferences) {
    try {
      const { smsEnabled, smsReminders, phoneNumber } = preferences;
      const userQuery = await this.db
        .collection("Users")
        .where("userId", "==", patientId)
        .limit(1)
        .get();
      if (userQuery.empty)
        return { success: false, error: "Patient not found" };

      await userQuery.docs[0].ref.update({
        smsEnabled,
        smsReminders,
        phone: phoneNumber,
        updatedAt: this.admin.firestore.Timestamp.now(),
      });

      return { success: true, message: "SMS preferences updated successfully" };
    } catch (error) {
      console.error(
        "❌ SMS Service: Preferences update error:",
        error
      );
      return { success: false, error: error.message };
    }
  }

  async getSMSPreferences(patientId) {
    try {
      const userQuery = await this.db
        .collection("Users")
        .where("userId", "==", patientId)
        .limit(1)
        .get();
      if (userQuery.empty)
        return { success: false, error: "Patient not found" };

      const user = userQuery.docs[0].data();
      return {
        success: true,
        smsEnabled: user.smsEnabled !== false,
        smsReminders: user.smsReminders !== false,
        phoneNumber: user.phone || "",
      };
    } catch (error) {
      console.error(
        "❌ SMS Service: Preferences fetch error:",
        error
      );
      return { success: false, error: error.message };
    }
  }

  // ========================================
  // HEALTH CHECK
  // ========================================

  async getHealthStatus() {
    try {
      let twilioStatus = { connected: false };

      if (this.twilioClient) {
        try {
          const accountInfo = await this.twilioClient.api
            .accounts(this.accountSid)
            .fetch();
          twilioStatus = {
            connected: true,
            accountSid: accountInfo.sid,
            phoneNumber: this.twilioFrom,
          };
        } catch (twilioError) {
          twilioStatus = {
            connected: false,
            error: twilioError.message,
          };
        }
      }

      // recent SMS success
      const oneHourAgo = new Date();
      oneHourAgo.setHours(oneHourAgo.getHours() - 1);

      const recentSMSQuery = await this.db
        .collection("SMSNotifications")
        .where(
          "createdAt",
          ">=",
          this.admin.firestore.Timestamp.fromDate(oneHourAgo)
        )
        .get();

      let total = 0,
        sent = 0;
      recentSMSQuery.docs.forEach((doc) => {
        const sms = doc.data();
        total++;
        if (sms.status === "sent") sent++;
      });

      const successRate =
        total > 0 ? ((sent / total) * 100).toFixed(1) : 100;

      return {
        status: "healthy",
        twilio: twilioStatus,
        smsStats: { lastHour: { total, sent }, successRate: `${successRate}%` },
        isInitialized: this.isInitialized,
      };
    } catch (error) {
      return {
        status: "unhealthy",
        error: error.message,
        isInitialized: this.isInitialized,
      };
    }
  }

  // ========================================
  // TWILIO VERIFY
  // ========================================

  async sendVerificationCode(phoneNumber) {
    try {
      if (!this.isInitialized || !this.verifyServiceSid) {
        return { success: false, error: "Verify service not configured" };
      }

      const verification = await this.twilioClient.verify.v2
        .services(this.verifyServiceSid)
        .verifications.create({ to: phoneNumber, channel: "sms" });

      return {
        success: true,
        message: "Verification code sent",
        verificationSID: verification.sid,
      };
    } catch (error) {
      console.error("❌ Send verification code error:", error);
      return { success: false, error: error.message };
    }
  }

  async checkVerificationStatus(phoneNumber, code) {
    try {
      if (!this.isInitialized || !this.verifyServiceSid) {
        return { success: false, error: "Verify service not configured" };
      }

      const verificationCheck = await this.twilioClient.verify.v2
        .services(this.verifyServiceSid)
        .verificationChecks.create({ to: phoneNumber, code });

      return {
        success: verificationCheck.status === "approved",
        status: verificationCheck.status,
      };
    } catch (error) {
      console.error(
        "❌ SMS Service: Verification status error:",
        error
      );
      return { success: false, error: error.message };
    }
  }
}

module.exports = SMSService;

// --- Optional CLI utility to create a Verify Service SID ---
// Run: node functions/smsService.js (with env set locally) to create a Verify Service and print its SID
if (require.main === module) {
  (async () => {
    try {
      if (
        !process.env.TWILIO_ACCOUNT_SID ||
        !process.env.TWILIO_AUTH_TOKEN
      ) {
        throw new Error(
          "Set TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN in environment first."
        );
      }
      const client = twilio(
        process.env.TWILIO_ACCOUNT_SID,
        process.env.TWILIO_AUTH_TOKEN
      );
      const service = await client.verify.v2.services.create({
        friendlyName: "My Verify Service",
      });
      console.log("Your new Verify Service SID:", service.sid);
    } catch (err) {
      console.error("Error creating Verify Service:", err.message);
    }
  })();
}
