import { getApp, getApps, initializeApp } from 'firebase/app';
import { getAnalytics, isSupported } from 'firebase/analytics';
import { getAuth } from 'firebase/auth';

// Firebase web configuration is public client configuration. Security is enforced
// by Firebase Authentication and backend-verified ID tokens, not by hiding this key.
const firebaseConfig = {
  apiKey: 'AIzaSyA3Hrh5M0eLHqIuwt7OGRhzPmQDLCntx-0',
  authDomain: 'mess-mate-418df.firebaseapp.com',
  projectId: 'mess-mate-418df',
  storageBucket: 'mess-mate-418df.firebasestorage.app',
  messagingSenderId: '277586371439',
  appId: '1:277586371439:web:f80278d23f4282a2b1be9a',
  measurementId: 'G-KTBF1Y1038',
};

export const firebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(firebaseApp);

// Analytics is optional and is only initialized in browsers where Firebase supports it.
export const analyticsReady = isSupported()
  .then(supported => (supported ? getAnalytics(firebaseApp) : null))
  .catch(() => null);
