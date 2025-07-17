// RUN THIS FILE TO CLEAN UP WRONGLY BOOKED AVAILABILITY SLOTS WITH NO CORRESPONDING APPOINTMENTS

const admin = require("firebase-admin");

// Path to your Firebase service account key JSON
const serviceAccount = require("./config/serviceAccountKey.json");

// Initialize Firebase Admin
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function cleanupAvailabilitySlots() {
  const availabilitySnap = await db.collection("Availability").get();
  let updatedCount = 0;
  let skippedCount = 0;

  for (const doc of availabilitySnap.docs) {
    const availData = doc.data();
    const availableDate = availData.availableDate;
    const currentStatus = availData.status;

    if (!availableDate) continue;

    const appointmentSnap = await db.collection("Appointments")
      .where("scheduledDate", "==", availableDate)
      .where("status", "==", "scheduled")
      .limit(1)
      .get();

    if (appointmentSnap.empty) {
      if (currentStatus !== "available") {
        console.log(`🔁 Updating slot '${doc.id}' to 'available'`);
        await doc.ref.update({ status: "available" });
        updatedCount++;
      }
    } else {
      skippedCount++;
    }
  }

  console.log(`✅ Cleanup complete.`);
  console.log(`🟢 ${updatedCount} slot(s) updated to 'available'.`);
  console.log(`⏩ ${skippedCount} slot(s) left unchanged (still booked).`);
}

cleanupAvailabilitySlots().catch(err => {
  console.error("❌ Error during cleanup:", err);
});
