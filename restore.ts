import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc } from 'firebase/firestore';
import fs from 'fs';
import firebaseConfig from './firebase-applet-config.json' with { type: "json" };

async function runRestore() {
  console.log("Starting restore into the new Firestore database...");
  try {
    const backupPath = './backup_data.json';
    if (!fs.existsSync(backupPath)) {
      throw new Error("Backup file 'backup_data.json' not found!");
    }

    const backup = JSON.parse(fs.readFileSync(backupPath, 'utf-8'));
    const app = initializeApp(firebaseConfig);
    const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

    const collections = ['app_users', 'units', 'expense_types', 'employees', 'reports'];

    for (const colName of collections) {
      const items = backup[colName];
      if (!items || !Array.isArray(items)) {
        console.log(`No data or invalid format for collection: ${colName}`);
        continue;
      }

      console.log(`Restoring ${items.length} documents into '${colName}'...`);
      for (const item of items) {
        const { id, ...data } = item;
        if (!id) {
          console.warn(`Skipping item in ${colName} because it has no id:`, item);
          continue;
        }

        try {
          await setDoc(doc(db, colName, id), data);
        } catch (err: any) {
          console.error(`Failed to restore doc ${id} in ${colName}:`, err.message || err);
        }
      }
      console.log(`Finished restoring collection: ${colName}`);
    }

    console.log("Restore complete!");
    process.exit(0);
  } catch (error: any) {
    console.error("Restore process error:", error.message || error);
    process.exit(1);
  }
}

runRestore();
