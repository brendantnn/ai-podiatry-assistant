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

async function seedAvailabilityUntilEndOfJuly() {
  const today = new Date();
  today.setHours(0, 0, 0, 0); // Start from today

  const endDate = new Date("2025-07-31T23:59:59");

  let currentDate = new Date(today);

  while (currentDate <= endDate) {
    const day = currentDate.getDay();
    if (day !== 0 && day !== 6) {
      for (let hour = startHour; hour < endHour; hour++) {
        for (let min = 0; min < 60; min += slotIntervalMinutes) {
          const slot = new Date(currentDate);
          slot.setHours(hour, min, 0, 0);

          await db.collection("Availability").add({
            podId,
            availableDate: admin.firestore.Timestamp.fromDate(slot),
            status: "available"
          });

          con
