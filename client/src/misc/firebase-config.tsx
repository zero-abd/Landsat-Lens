import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getDatabase } from 'firebase/database';

interface FirebaseConfig {
    apiKey: string;
    authDomain: string;
    projectId: string;
    storageBucket: string;
    messagingSenderId: string;
    appId: string;
}

const firebaseConfig: FirebaseConfig = {
    apiKey: '***REMOVED***',
    authDomain: 'nsac-2024.firebaseapp.com',
    projectId: 'nsac-2024',
    storageBucket: 'nsac-2024.appspot.com',
    messagingSenderId: '690334802116',
    appId: '1:690334802116:web:a7cc160f36610e72c9a991',
};

const app = initializeApp(firebaseConfig);

const auth = getAuth(app);
const db = getFirestore(app);
const realTimeDb = getDatabase(app);
const provider = new GoogleAuthProvider();
const storage = getStorage(app);

export { db, app, auth, provider, storage, realTimeDb };
