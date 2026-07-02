import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, addDoc } from 'firebase/firestore';
import firebaseConfig from './firebase-applet-config.json' with { type: "json" };

async function test() {
  const app = initializeApp(firebaseConfig);
  const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
  try {
    console.log("Testing write to units...");
    const ref = await addDoc(collection(db, 'units'), { name: "Test Unit" });
    console.log("Write succeeded! ID:", ref.id);
  } catch (err: any) {
    console.error("Write failed:", err.message || err);
  }

  try {
    console.log("Testing read from units...");
    const snap = await getDocs(collection(db, 'units'));
    console.log("Read succeeded! Count:", snap.size);
  } catch (err: any) {
    console.error("Read failed:", err.message || err);
  }
}

test();
