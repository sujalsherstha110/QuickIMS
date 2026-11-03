import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  getFirestore, 
  initializeFirestore, 
  persistentLocalCache, 
  persistentMultipleTabManager 
} from 'firebase/firestore';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import firebaseConfig from '../firebase-applet-config.json';

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

const firestoreSettings = {
  experimentalForceLongPolling: true,
  ignoreUndefinedProperties: true,
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager()
  })
};

// Use the database ID provisioned in firebase-applet-config.json if specified
export const db = firebaseConfig.firestoreDatabaseId && firebaseConfig.firestoreDatabaseId !== '(default)'
  ? initializeFirestore(app, firestoreSettings, firebaseConfig.firestoreDatabaseId)
  : initializeFirestore(app, firestoreSettings);

export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

// Secondary app instance specifically for dispatching & checking staff email verifications
// without changing the active manager/admin authentication session in the primary app.
export const getSecondaryStaffAuth = () => {
  const secondaryApp = getApps().find(a => a.name === 'QuickIMSStaffAuth') 
    || initializeApp(firebaseConfig, 'QuickIMSStaffAuth');
  return getAuth(secondaryApp);
};

export default app;

