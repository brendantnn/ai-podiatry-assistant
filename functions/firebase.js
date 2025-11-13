// const admin = require("firebase-admin");

// if (!admin.apps.length) {
//   admin.initializeApp(); // Firebase provides credentials automatically in Cloud Functions
// }

// const db = admin.firestore();
// const auth = admin.auth();

// module.exports = { admin, db, auth };

const admin = require("firebase-admin");
//const serviceAccount = require("./config/serviceAccountKey.json");

if (!admin.apps.length) {
  admin.initializeApp({
    storageBucket: "itp-grp21.firebasestorage.app"  // ← USE THIS
  });
}

const db = admin.firestore();

const bucket = admin.storage().bucket();  // ← ADD THIS LINE
module.exports = { admin, db, bucket };   // ← ADD bucket here
