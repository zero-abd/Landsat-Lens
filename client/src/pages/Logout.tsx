import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../misc/auth-context';

const Logout: React.FC = () => {
    const navigate = useNavigate();
    const { signOut } = useAuth();

    useEffect(() => {
        const handleLogout = async () => {
            try {
                await signOut();
                navigate('/login');
            } catch (error) {
                console.error('Failed to sign out', error);
            }
        };

        handleLogout();
    }, [signOut, navigate]);

    return <></>;
};

export default Logout;
