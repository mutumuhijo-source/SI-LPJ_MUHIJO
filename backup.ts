import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import fs from 'fs';
import firebaseConfig from './firebase-applet-config.json' with { type: "json" };

async function runBackup() {
  console.log("Starting backup from old Firestore...");
  try {
    const app = initializeApp(firebaseConfig);
    const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

    const collections = ['app_users', 'units', 'expense_types', 'employees', 'reports'];
    const backup: Record<string, any[]> = {};

    for (const colName of collections) {
      console.log(`Fetching collection: ${colName}...`);
      try {
        const snap = await getDocs(collection(db, colName));
        backup[colName] = snap.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        console.log(`Successfully fetched ${backup[colName].length} documents from ${colName}`);
      } catch (err: any) {
        console.error(`Failed to fetch ${colName}:`, err.message || err);
        backup[colName] = [];
      }
    }

    fs.writeFileSync('./backup_data.json', JSON.stringify(backup, null, 2), 'utf-8');
    console.log("Backup complete! Saved to ./backup_data.json");
  } catch (error: any) {
    console.error("Backup process error:", error.message || error);
  }
}

runBackup();
