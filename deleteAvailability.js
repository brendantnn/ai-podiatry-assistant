const admin = require("firebase-admin");
const serviceAccount = require("./config/serviceAccountKey.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});
const db = admin.firestore();

async function deleteAvailabilityForPod(podId = "pod_1") {
  const snapshot = await db.collection("Availability")
    .where("podId", "==", podId)
    .get();

  if (snapshot.empty) {
    console.log("❌ No records found to delete.");
    return;
  }

  const batch = db.batch();
  snapshot.docs.forEach(doc => {
    batch.delete(doc.ref);
  });

  await batch.commit();
  console.log(`🧹 Deleted ${snapshot.size} records for podId "${podId}"`);
}

deleteAvailabilityForPod().catch(console.error);
