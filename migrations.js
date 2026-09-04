// ===== ONE-TIME FIRESTORE MIGRATIONS =====
// These migrations are idempotent and are marked complete in settings/migrations.
// Existing records are updated once; new records receive the fields during normal creation.

async function runOneTimeDatabaseMigrations() {
    if (!window.fbMethods || !window.db) {
        setTimeout(runOneTimeDatabaseMigrations, 500);
        return;
    }

    const { collection, doc, getDoc, getDocs, setDoc, updateDoc } = window.fbMethods;
    const migrationRef = doc(window.db, "settings", "migrations");

    try {
        const migrationSnap = await getDoc(migrationRef);
        const completed = migrationSnap.exists() ? migrationSnap.data() : {};

        if (!completed.deviceWeightV1) {
            const deviceSnap = await getDocs(collection(window.db, "devices"));
            for (const deviceDoc of deviceSnap.docs) {
                const device = deviceDoc.data();
                if (device.weight === undefined || device.weight === null) {
                    await updateDoc(doc(window.db, "devices", deviceDoc.id), {
                        weight: DEFAULT_DEVICE_WEIGHT
                    });
                }
            }
            await setDoc(migrationRef, { deviceWeightV1: true }, { merge: true });
            console.log("✅ One-time migration complete: device weight added to old devices.");
        }

        if (!completed.propertyTaxPercentageV1) {
            const propertySnap = await getDocs(collection(window.db, "properties"));
            for (const propertyDoc of propertySnap.docs) {
                const property = propertyDoc.data();
                if (property.taxPercentage === undefined || property.taxPercentage === null) {
                    await updateDoc(doc(window.db, "properties", propertyDoc.id), {
                        taxPercentage: DEFAULT_PROPERTY_TAX_PERCENTAGE
                    });
                }
            }
            await setDoc(migrationRef, { propertyTaxPercentageV1: true }, { merge: true });
            console.log("✅ One-time migration complete: property tax percentage added to old properties.");
        }
    } catch (error) {
        // Do not write a completion marker if any migration fails, so it can safely retry next load.
        console.error("One-time database migration failed:", error);
    }
}

runOneTimeDatabaseMigrations();
