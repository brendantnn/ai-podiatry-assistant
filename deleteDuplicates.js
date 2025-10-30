const admin = require("firebase-admin");
const serviceAccount = require("./config/serviceAccountKey.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});
const db = admin.firestore();

async function removeDuplicateAvailability() {
  const snapshot = await db.collection("Availability").get();
  const seen = new Map();
  const duplicates = [];

  snapshot.forEach(doc => {
    const data = doc.data();
    const key = `${data.podId}_${data.availableDate.toDate().toISOString()}`;

    if (seen.has(key)) {
      duplicates.push(doc.ref);
    } else {
      seen.set(key, doc.ref);
    }
  });

  console.log(`Found ${duplicates.length} duplicates.`);

  for (let i = 0; i < duplicates.length; i++) {
    await duplicates[i].delete();
    console.log(`Deleted ${i + 1}/${duplicates.length}`);
  }

  console.log("✅ Duplicate cleanup complete.");
}

removeDuplicateAvailability().catch(console.error);
