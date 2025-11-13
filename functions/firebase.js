const admin = require("firebase-admin");

if (!admin.apps.length) {
  admin.initializeApp(); // Firebase provides credentials automatically in Cloud Functions
}

const db = admin.firestore();
const auth = admin.auth();

module.exports = { admin, db, auth };
