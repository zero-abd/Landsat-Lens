import React, { useState, useContext, createContext, useEffect } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from './firebase-config';
import { useAuth } from './auth-context';

interface AppContextType {
    userData: any;
    setUserData: (userData: any) => void;
}

const AppContext = createContext<AppContextType | null>(null);

export const useApp = () => {
    const context = useContext(AppContext);
    if (!context) {
        throw new Error('useApp must be used within an AppProvider');
    }
    return context;
};

const AppProvider = ({ children }: { children: React.ReactNode }) => {
    const { currentUser } = useAuth();
    const [userData, setUserData] = useState({ type: '' });

    useEffect(() => {
        if (currentUser?.email) {
            const fetchUserData = async () => {
                try {
                    const docRef = doc(db, 'user-emails', currentUser?.email as string);
                    const docSnap = await getDoc(docRef);
                    if (docSnap.exists()) {
                        setUserData(docSnap.data() as any);
                    }
                } catch (error) {
                    console.error('Error fetching user data:', error);
                }
            };
            fetchUserData();
        }
    }, [currentUser]);

    return <AppContext.Provider value={{ userData, setUserData }}>{children}</AppContext.Provider>;
};

export { AppProvider };
