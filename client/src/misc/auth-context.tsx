import React, { useMemo, useState, useEffect, useContext, useCallback, createContext, ReactNode } from 'react';
import { signInWithPopup, onAuthStateChanged, User } from 'firebase/auth';
import { initializeDB } from './init-db';
import { auth, provider, db } from './firebase-config';

interface AuthContextType {
    currentUser: User | null;
    isAuthenticated: boolean;
    signInWithGoogle: () => Promise<User | undefined>;
    signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function useAuth() {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}

interface AuthProviderProps {
    children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            setCurrentUser(user);
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    const signInWithGoogle = useCallback(async () => {
        const result = await signInWithPopup(auth, provider);
        if (result.user) {
            await initializeDB(result?.user?.email?.toString() as string);
            setCurrentUser(result.user);
            return result.user;
        }
    }, []);

    const signOut = useCallback(async () => {
        await auth.signOut();
        setCurrentUser(null);
    }, []);

    const value = useMemo(
        () => ({
            currentUser,
            isAuthenticated: !!currentUser,
            signInWithGoogle,
            signOut,
        }),
        [currentUser, signInWithGoogle, signOut]
    );

    return <AuthContext.Provider value={value}>{!loading && children}</AuthContext.Provider>;
}

export default AuthProvider;
