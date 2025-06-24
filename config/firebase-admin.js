// This file initializes Firebase Admin SDK for server-side operations
const admin = require('firebase-admin');
require('dotenv').config();

//generate from Firebase Console
const serviceAccount = require('./serviceAccountKey.json'); 

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();
const auth = admin.auth();

module.exports = { admin, db, auth };