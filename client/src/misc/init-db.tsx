import { doc, getDoc, setDoc } from 'firebase/firestore';

import { db } from './firebase-config';

async function initializeDB(email: string) {
    const docRef = doc(db, 'user-emails', email);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
        const initData = {
            type: 'Free',
            phone: '',
            class: '',
        };
        await setDoc(docRef, initData);
        return initData;
    }
    return docSnap.data();
}

export { initializeDB };
