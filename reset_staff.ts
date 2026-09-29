import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, deleteDoc, doc } from 'firebase/firestore';
import firebaseConfig from './firebase-applet-config.json' with { type: 'json' };

const app = initializeApp(firebaseConfig);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

async function cleanStaff() {
  console.log('Fetching staff collections...');
  const collections = ['staff_members', 'staff_verifications', 'staff_audit_logs'];

  for (const col of collections) {
    const snap = await getDocs(collection(db, col)).catch(err => {
      console.error(`Error reading ${col}:`, err);
      return null;
    });

    if (snap && !snap.empty) {
      console.log(`Found ${snap.docs.length} docs in ${col}, deleting...`);
      for (const d of snap.docs) {
        await deleteDoc(d.ref);
        console.log(`Deleted ${col}/${d.id}`);
      }
    } else {
      console.log(`No documents found in ${col}.`);
    }
  }

  console.log('Staff Firestore data reset complete!');
}

cleanStaff().catch(console.error);
