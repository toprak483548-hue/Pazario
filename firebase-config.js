// Firebase Console > Project settings > Your apps > Firebase SDK snippet > Config
// These web config values are public identifiers. Never put a service-account key here.
export const firebaseConfig = {
  apiKey: 'PASTE_API_KEY_HERE',
  authDomain: 'YOUR_PROJECT_ID.firebaseapp.com',
  projectId: 'YOUR_PROJECT_ID',
  appId: 'PASTE_APP_ID_HERE'
};

// After your first registration, copy your Firebase Authentication UID here.
// ALSO add the same UID to the isAdmin() list in firestore.rules. Rules are the security boundary.
export const ADMIN_UIDS = [
  // 'PASTE_YOUR_ADMIN_UID_HERE'
];

export const isFirebaseConfigured = () => Boolean(
  firebaseConfig.apiKey &&
  firebaseConfig.apiKey !== 'PASTE_API_KEY_HERE' &&
  firebaseConfig.projectId &&
  firebaseConfig.projectId !== 'YOUR_PROJECT_ID' &&
  firebaseConfig.appId &&
  firebaseConfig.appId !== 'PASTE_APP_ID_HERE'
);
