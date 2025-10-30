const admin = require("firebase-admin");
const serviceAccount = require("./config/serviceAccountKey.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});
const db = admin.firestore();

const podId = "pod_1";
const startHour = 9;
const endHour = 17;
const slotIntervalMinutes = 30;

async function seedAvailabilityUntilEndOfAugust() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const endDate = new Date("2025-12-31T23:59:59");
  let currentDate = new Date(today);

  while (currentDate <= endDate) {
    for (let hour = startHour; hour < endHour; hour++) {
      for (let min = 0; min < 60; min += slotIntervalMinutes) {
        const slot = new Date(currentDate);
        slot.setHours(hour, min, 0, 0);

        const slotId = `${podId}_${slot.toISOString()}`; // Unique key
        await db.collection("Availability").doc(slotId).set({
          podId,
          availableDate: admin.firestore.Timestamp.fromDate(slot),
          status: "available"
        });

        console.log(`Seeded: ${slot}`);
      }
    }
    currentDate.setDate(currentDate.getDate() + 1);
  }
}

seedAvailabilityUntilEndOfAugust().then(() => {
  console.log("✅ Seeding complete.");
  process.exit(0);
});
