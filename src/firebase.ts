import { initializeApp, FirebaseApp } from 'firebase/app';
import { getFirestore, doc, getDocFromServer, Firestore } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

let app: FirebaseApp | undefined;
let db: Firestore;

try {
  app = initializeApp(firebaseConfig);
  db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
} catch (e) {
  console.error("Firebase init error:", e);
  // Optional: fallback to dummy db so UI can still render offline state or crash gracefully
}

export { app, db };

// Connection test as required by integration instructions
async function testConnection() {
  if (!db) return;
  try {
    await getDocFromServer(doc(db, 'units', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error("Please check your Firebase configuration.");
    }
  }
}
testConnection().catch(console.error);
