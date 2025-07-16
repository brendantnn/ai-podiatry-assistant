// ========================================
// SMS SERVICE MODULE - smsService.js
// Separate module for SMS functionality
// ========================================

const twilio = require('twilio');
const cron = require('node-cron');

class SMSService {
  constructor(db, admin) {
    this.db = db;
    this.admin = admin;
    this.twilioClient = null;
    this.isInitialized = false;
    
    // Initialize Twilio
    this.initializeTwilio();
    
    // Setup cron jobs
    this.setupCronJobs();
  }

  initializeTwilio() {
    const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
    const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
    const TWILIO_PHONE_NUMBER = process.env.TWILIO_PHONE_NUMBER;

    if (TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN) {
      this.twilioClient = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
      this.twilioPhoneNumber = TWILIO_PHONE_NUMBER;
      this.isInitialized = true;
      console.log('✅ SMS Service: Twilio client initialized');
    } else {
      console.warn('⚠️ SMS Service: Twilio credentials not found - SMS functionality disabled');
    }
  }

  // ========================================
  // CORE SMS FUNCTIONS
  // ========================================

  async sendSMS(phoneNumber, message) {
    if (!this.isInitialized) {
      console.error('❌ SMS Service: Twilio client not initialized');
      return { success: false, error: 'SMS service not available' };
    }

    try {
      console.log('📱 SMS Service: Sending SMS to:', phoneNumber);
      
      const formattedPhone = this.formatPhoneNumber(phoneNumber);
      
      const smsResult = await this.twilioClient.messages.create({
        body: message,
        from: this.twilioPhoneNumber,
        to: formattedPhone
      });
      
      console.log('✅ SMS Service: SMS sent successfully:', smsResult.sid);
      
      // Log to Firestore
      await this.logSMSToFirestore(phoneNumber, message, smsResult.sid, 'sent');
      
      return {
        success: true,
        messageId: smsResult.sid,
        status: smsResult.status
      };
      
    } catch (error) {
      console.error('❌ SMS Service: SMS sending failed:', error);
      await this.logSMSToFirestore(phoneNumber, message, null, 'failed', error.message);
      
      return {
        success: false,
        error: error.message
      };
    }
  }

  formatPhoneNumber(phoneNumber) {
    const cleaned = phoneNumber.replace(/\D/g, '');
    
    if (cleaned.startsWith('65')) {
      return `+${cleaned}`;
    } else if (cleaned.startsWith('8') || cleaned.startsWith('9')) {
      return `+65${cleaned}`;
    } else {
      return `+65${cleaned}`;
    }
  }

  async logSMSToFirestore(phoneNumber, message, messageId, status, errorMessage = null) {
    try {
      await this.db.collection('SMSNotifications').add({
        phoneNumber,
        message,
        messageId,
        status,
        errorMessage,
        createdAt: this.admin.firestore.Timestamp.now()
      });
      console.log('✅ SMS Service: SMS logged to Firestore');
    } catch (error) {
      console.error('❌ SMS Service: Failed to log SMS to Firestore:', error);
    }
  }

  // ========================================
  // SMS TEMPLATES
  // ========================================

  generateAppointmentUpdateSMS(patientName, oldDateTime, newDateTime, podiatristName) {
    return `📅 SGH Podiatry - Appointment Update

Dear ${patientName},

Your appointment has been rescheduled:

📅 Previous: ${oldDateTime}
📅 New: ${newDateTime}

👨‍⚕️ Doctor: ${podiatristName}
🏥 Location: SGH Podiatry Clinic

Please arrive 15 minutes early. If you need to reschedule, call 6321-4377.

Singapore General Hospital`;
  }

  generateAppointmentReminderSMS(patientName, dateTime, podiatristName) {
    return `📅 SGH Podiatry - Appointment Reminder

Dear ${patientName},

This is a reminder of your appointment tomorrow:

📅 Date & Time: ${dateTime}
👨‍⚕️ Doctor: ${podiatristName}
🏥 Location: SGH Podiatry Clinic

Please arrive 15 minutes early. For changes, call 6321-4377.

Singapore General Hospital`;
  }

  generateAppointmentCancellationSMS(patientName, dateTime, podiatristName) {
    return `📅 SGH Podiatry - Appointment Cancelled

Dear ${patientName},

Your appointment has been cancelled:

📅 Date & Time: ${dateTime}
👨‍⚕️ Doctor: ${podiatristName}

To reschedule, please call 6321-4377 or visit our patient portal.

Singapore General Hospital`;
  }

  // ========================================
  // APPOINTMENT NOTIFICATION LOGGING
  // ========================================

  async logAppointmentNotification(appointmentId, patientId, type, action, message, status) {
    try {
      await this.db.collection('AppointmentNotifications').add({
        appointmentId,
        patientId,
        notificationType: type,
        action,
        message,
        status,
        createdAt: this.admin.firestore.Timestamp.now()
      });
      console.log('✅ SMS Service: Appointment notification logged');
    } catch (error) {
      console.error('❌ SMS Service: Failed to log appointment notification:', error);
    }
  }

  // ========================================
  // APPOINTMENT UPDATE WITH SMS
  // ========================================

  async sendAppointmentUpdateSMS(appointmentId, patientId, oldDateTime, newDateTime, podiatristName) {
    try {
      // Get patient details
      const patientQuery = await this.db.collection("Users")
        .where("userId", "==", patientId)
        .limit(1)
        .get();

      if (patientQuery.empty) {
        return { success: false, error: 'Patient not found' };
      }

      const patientData = patientQuery.docs[0].data();
      const patientName = `${patientData.firstName || ''} ${patientData.lastName || ''}`.trim();
      const patientPhone = patientData.phone;
      const smsEnabled = patientData.smsEnabled !== false;

      if (!patientPhone) {
        return { success: false, error: 'no_phone', message: 'Patient has no phone number' };
      }

      if (!smsEnabled) {
        return { success: false, error: 'disabled', message: 'SMS notifications disabled for patient' };
      }

      const smsMessage = this.generateAppointmentUpdateSMS(
        patientName,
        oldDateTime,
        newDateTime,
        podiatristName
      );

      const smsResult = await this.sendSMS(patientPhone, smsMessage);

      if (smsResult.success) {
        await this.logAppointmentNotification(
          appointmentId,
          patientId,
          'sms',
          'appointment_updated',
          smsMessage,
          'sent'
        );
      } else {
        await this.logAppointmentNotification(
          appointmentId,
          patientId,
          'sms',
          'appointment_updated',
          smsMessage,
          'failed'
        );
      }

      return {
        success: smsResult.success,
        status: smsResult.success ? 'sent' : 'failed',
        error: smsResult.error,
        patientName,
        messageId: smsResult.messageId
      };

    } catch (error) {
      console.error('❌ SMS Service: Appointment update SMS failed:', error);
      return { success: false, error: error.message };
    }
  }

  // ========================================
  // BULK SMS REMINDERS
  // ========================================

  async sendBulkSMSReminders() {
    try {
      console.log('📱 SMS Service: Starting bulk SMS reminder process...');
      
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      
      const startOfTomorrow = new Date(tomorrow);
      startOfTomorrow.setHours(0, 0, 0, 0);
      
      const endOfTomorrow = new Date(tomorrow);
      endOfTomorrow.setHours(23, 59, 59, 999);
      
      const appointmentsQuery = await this.db.collection("Appointments")
        .where("scheduledDate", ">=", this.admin.firestore.Timestamp.fromDate(startOfTomorrow))
        .where("scheduledDate", "<=", this.admin.firestore.Timestamp.fromDate(endOfTomorrow))
        .where("status", "==", "scheduled")
        .get();
      
      console.log(`📱 SMS Service: Found ${appointmentsQuery.size} appointments for tomorrow`);
      
      let sentCount = 0;
      let failedCount = 0;

      for (const appointmentDoc of appointmentsQuery.docs) {
        const appointment = appointmentDoc.data();
        
        // Get patient details
        const patientQuery = await this.db.collection("Users")
          .where("userId", "==", appointment.patientId)
          .limit(1)
          .get();
        
        if (patientQuery.empty) {
          console.log(`⚠️ SMS Service: Patient ${appointment.patientId} not found`);
          continue;
        }
        
        const patientData = patientQuery.docs[0].data();
        const patientName = `${patientData.firstName || ''} ${patientData.lastName || ''}`.trim();
        
        // Skip if no phone or SMS disabled
        if (!patientData.phone || patientData.smsEnabled === false) {
          console.log(`⚠️ SMS Service: Skipping ${patientName} - no phone or SMS disabled`);
          continue;
        }
        
        // Get podiatrist details
        const podiatristQuery = await this.db.collection("Users")
          .where("userId", "==", appointment.podId)
          .limit(1)
          .get();
        
        let podiatristName = "Doctor";
        if (!podiatristQuery.empty) {
          const podiatristData = podiatristQuery.docs[0].data();
          podiatristName = `${podiatristData.firstName || ''} ${podiatristData.lastName || ''}`.trim();
        }
        
        const appointmentTime = appointment.scheduledDate.toDate().toLocaleString("en-SG", {
          weekday: "long",
          year: "numeric",
          month: "long",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
          hour12: true,
          timeZone: "Asia/Singapore"
        });
        
        const reminderMessage = this.generateAppointmentReminderSMS(
          patientName,
          appointmentTime,
          podiatristName
        );
        
        const smsResult = await this.sendSMS(patientData.phone, reminderMessage);
        
        if (smsResult.success) {
          sentCount++;
          await this.logAppointmentNotification(
            appointmentDoc.id,
            appointment.patientId,
            'sms',
            'appointment_reminder',
            reminderMessage,
            'sent'
          );
        } else {
          failedCount++;
        }
        
        // Add delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
      console.log(`✅ SMS Service: Bulk SMS reminder completed - Sent: ${sentCount}, Failed: ${failedCount}`);
      
      return {
        success: true,
        totalAppointments: appointmentsQuery.size,
        sentCount,
        failedCount
      };
      
    } catch (error) {
      console.error('❌ SMS Service: Bulk SMS reminder failed:', error);
      return { success: false, error: error.message };
    }
  }

  // ========================================
  // MANUAL SMS SENDING
  // ========================================

  async sendManualSMS(patientId, message, type = 'manual') {
    try {
      const patientQuery = await this.db.collection("Users")
        .where("userId", "==", patientId)
        .limit(1)
        .get();
      
      if (patientQuery.empty) {
        return { success: false, error: 'Patient not found' };
      }
      
      const patientData = patientQuery.docs[0].data();
      const patientName = `${patientData.firstName || ''} ${patientData.lastName || ''}`.trim();
      
      if (!patientData.phone) {
        return { success: false, error: 'Patient has no phone number' };
      }
      
      if (patientData.smsEnabled === false) {
        return { success: false, error: 'Patient has disabled SMS notifications' };
      }
      
      const smsResult = await this.sendSMS(patientData.phone, message);
      
      if (smsResult.success) {
        await this.logAppointmentNotification(
          null,
          patientId,
          'sms',
          type,
          message,
          'sent'
        );
      }
      
      return {
        success: smsResult.success,
        patientName,
        error: smsResult.error,
        messageId: smsResult.messageId
      };
      
    } catch (error) {
      console.error('❌ SMS Service: Manual SMS sending error:', error);
      return { success: false, error: error.message };
    }
  }

  // ========================================
  // SMS ANALYTICS
  // ========================================

  async getAnalytics(period = 'week') {
    try {
      const now = new Date();
      const startDate = new Date(now);
      
      switch (period) {
        case 'week':
          startDate.setDate(now.getDate() - 7);
          break;
        case 'month':
          startDate.setMonth(now.getMonth() - 1);
          break;
        case 'day':
          startDate.setDate(now.getDate() - 1);
          break;
      }
      
      const smsQuery = await this.db.collection("SMSNotifications")
        .where("createdAt", ">=", this.admin.firestore.Timestamp.fromDate(startDate))
        .get();
      
      let totalSent = 0;
      let delivered = 0;
      let failed = 0;
      
      smsQuery.docs.forEach(doc => {
        const sms = doc.data();
        totalSent++;
        
        if (sms.status === 'sent' || sms.status === 'delivered') {
          delivered++;
        } else if (sms.status === 'failed') {
          failed++;
        }
      });
      
      const deliveryRate = totalSent > 0 ? Math.round((delivered / totalSent) * 100) : 0;
      
      return {
        totalSent,
        delivered,
        failed,
        deliveryRate,
        period
      };
      
    } catch (error) {
      console.error('❌ SMS Service: Analytics error:', error);
      throw error;
    }
  }

  // ========================================
  // SMS PREFERENCES
  // ========================================

  async updateSMSPreferences(patientId, preferences) {
    try {
      const { smsEnabled, smsReminders, phoneNumber } = preferences;
      
      const userQuery = await this.db.collection("Users")
        .where("userId", "==", patientId)
        .limit(1)
        .get();
      
      if (userQuery.empty) {
        return { success: false, error: 'Patient not found' };
      }
      
      const updateData = {
        smsEnabled,
        smsReminders,
        phone: phoneNumber,
        updatedAt: this.admin.firestore.Timestamp.now()
      };
      
      await userQuery.docs[0].ref.update(updateData);
      
      return { success: true, message: 'SMS preferences updated successfully' };
      
    } catch (error) {
      console.error('❌ SMS Service: Preferences update error:', error);
      return { success: false, error: error.message };
    }
  }

  async getSMSPreferences(patientId) {
    try {
      const userQuery = await this.db.collection("Users")
        .where("userId", "==", patientId)
        .limit(1)
        .get();
      
      if (userQuery.empty) {
        return { success: false, error: 'Patient not found' };
      }
      
      const userData = userQuery.docs[0].data();
      
      return {
        success: true,
        smsEnabled: userData.smsEnabled !== false,
        smsReminders: userData.smsReminders !== false,
        phoneNumber: userData.phone || ''
      };
      
    } catch (error) {
      console.error('❌ SMS Service: Preferences fetch error:', error);
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
          const accountInfo = await this.twilioClient.api.accounts(process.env.TWILIO_ACCOUNT_SID).fetch();
          twilioStatus = {
            connected: true,
            accountSid: accountInfo.sid,
            phoneNumber: this.twilioPhoneNumber
          };
        } catch (twilioError) {
          twilioStatus = {
            connected: false,
            error: twilioError.message
          };
        }
      }
      
      // Check recent SMS success rate
      const oneHourAgo = new Date();
      oneHourAgo.setHours(oneHourAgo.getHours() - 1);
      
      const recentSMSQuery = await this.db.collection("SMSNotifications")
        .where("createdAt", ">=", this.admin.firestore.Timestamp.fromDate(oneHourAgo))
        .get();
      
      let total = 0;
      let sent = 0;
      
      recentSMSQuery.docs.forEach(doc => {
        const sms = doc.data();
        total++;
        if (sms.status === 'sent') sent++;
      });
      
      const successRate = total > 0 ? (sent / total * 100).toFixed(1) : 100;
      
      return {
        status: 'healthy',
        twilio: twilioStatus,
        smsStats: {
          lastHour: { total, sent },
          successRate: `${successRate}%`
        },
        isInitialized: this.isInitialized
      };
      
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message,
        isInitialized: this.isInitialized
      };
    }
  }

  // ========================================
  // WEBHOOK HANDLER
  // ========================================

  async handleStatusWebhook(webhookData) {
    try {
      const { MessageSid, MessageStatus, ErrorCode, ErrorMessage } = webhookData;
      
      console.log('📱 SMS Service: Status Update:', {
        MessageSid,
        MessageStatus,
        ErrorCode,
        ErrorMessage
      });
      
      // Update SMS status in Firestore
      const smsQuery = await this.db.collection("SMSNotifications")
        .where("messageId", "==", MessageSid)
        .limit(1)
        .get();
      
      if (!smsQuery.empty) {
        await smsQuery.docs[0].ref.update({
          status: MessageStatus,
          errorMessage: ErrorMessage || null,
          updatedAt: this.admin.firestore.Timestamp.now()
        });
      }
      
      return { success: true };
      
    } catch (error) {
      console.error('❌ SMS Service: Webhook error:', error);
      return { success: false, error: error.message };
    }
  }

  // ========================================
  // CRON JOB SETUP
  // ========================================

  setupCronJobs() {
    // Schedule SMS reminders to run daily at 6 PM Singapore time
    cron.schedule('0 18 * * *', async () => {
      console.log('🕰️ SMS Service: Running scheduled SMS reminders...');
      await this.sendBulkSMSReminders();
    }, {
      timezone: "Asia/Singapore"
    });

    console.log('✅ SMS Service: Cron jobs scheduled');
  }
}

module.exports = SMSService;