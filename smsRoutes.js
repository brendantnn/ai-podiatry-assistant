// ========================================
// SMS ROUTES MODULE - smsRoutes.js
// All SMS-related routes and endpoints
// ========================================

const express = require('express');
const router = express.Router();

// SMS Routes setup function
function setupSMSRoutes(smsService) {
  
  // ========================================
  // BASIC SMS TESTING
  // ========================================

  router.post('/test-sms', async (req, res) => {
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
        message: result.success ? 'Test SMS sent successfully' : 'Failed to send test SMS',
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

  // ========================================
  // MANUAL SMS SENDING
  // ========================================

  router.post('/send-manual-sms', async (req, res) => {
    try {
      const { patientId, message, type = 'manual' } = req.body;
      
      if (!patientId || !message) {
        return res.json({
          success: false,
          message: 'Patient ID and message are required'
        });
      }
      
      const result = await smsService.sendManualSMS(patientId, message, type);
      
      res.json({
        success: result.success,
        message: result.success ? 
          `SMS sent successfully to ${result.patientName}` : 
          `Failed to send SMS: ${result.error}`,
        patientName: result.patientName,
        error: result.error,
        messageId: result.messageId
      });
      
    } catch (error) {
      console.error('❌ Manual SMS route error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to send SMS',
        error: error.message
      });
    }
  });

  // ========================================
  // SMS ANALYTICS
  // ========================================

  router.post('/get-sms-analytics', async (req, res) => {
    try {
      const { period = 'week' } = req.body;
      
      const analytics = await smsService.getAnalytics(period);
      
      res.json({
        success: true,
        analytics
      });
      
    } catch (error) {
      console.error('❌ SMS analytics route error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get SMS analytics',
        message: error.message
      });
    }
  });

  // ========================================
  // SMS HEALTH CHECK
  // ========================================

  router.get('/sms-health', async (req, res) => {
    try {
      const healthStatus = await smsService.getHealthStatus();
      
      if (healthStatus.status === 'healthy') {
        res.json({
          ...healthStatus,
          timestamp: new Date().toISOString()
        });
      } else {
        res.status(500).json({
          ...healthStatus,
          timestamp: new Date().toISOString()
        });
      }
      
    } catch (error) {
      res.status(500).json({
        status: 'unhealthy',
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  });

  // ========================================
  // TWILIO WEBHOOK HANDLER
  // ========================================

  router.post('/sms-status-webhook', async (req, res) => {
    try {
      const result = await smsService.handleStatusWebhook(req.body);
      
      if (result.success) {
        res.status(200).send('OK');
      } else {
        res.status(500).send('Error processing webhook');
      }
      
    } catch (error) {
      console.error('❌ SMS webhook route error:', error);
      res.status(500).send('Error');
    }
  });

  // ========================================
  // BULK SMS REMINDERS (MANUAL TRIGGER)
  // ========================================

  router.post('/send-bulk-reminders', async (req, res) => {
    try {
      console.log('📱 Manual bulk SMS reminder triggered');
      
      const result = await smsService.sendBulkSMSReminders();
      
      res.json({
        success: result.success,
        message: result.success ? 
          `Bulk SMS reminders completed - Sent: ${result.sentCount}, Failed: ${result.failedCount}` :
          `Bulk SMS reminders failed: ${result.error}`,
        details: result
      });
      
    } catch (error) {
      console.error('❌ Bulk SMS route error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to send bulk SMS reminders',
        error: error.message
      });
    }
  });

  return router;
}

// ========================================
// PATIENT SMS PREFERENCES ROUTES
// ========================================

function setupPatientSMSRoutes(smsService) {
  const patientRouter = express.Router();

  // Update SMS preferences
  patientRouter.post('/update-sms-preferences', async (req, res) => {
    try {
      const { patientId, smsEnabled, smsReminders, phoneNumber } = req.body;
      
      if (!patientId) {
        return res.json({
          success: false,
          message: 'Patient ID is required'
        });
      }
      
      const result = await smsService.updateSMSPreferences(patientId, {
        smsEnabled,
        smsReminders,
        phoneNumber
      });
      
      res.json(result);
      
    } catch (error) {
      console.error('❌ SMS preferences update route error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update SMS preferences',
        error: error.message
      });
    }
  });

  // Get SMS preferences
  patientRouter.post('/get-sms-preferences', async (req, res) => {
    try {
      const { patientId } = req.body;
      
      if (!patientId) {
        return res.json({
          success: false,
          message: 'Patient ID is required'
        });
      }
      
      const result = await smsService.getSMSPreferences(patientId);
      
      res.json(result);
      
    } catch (error) {
      console.error('❌ SMS preferences fetch route error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch SMS preferences',
        error: error.message
      });
    }
  });

  return patientRouter;
}

module.exports = {
  setupSMSRoutes,
  setupPatientSMSRoutes
};