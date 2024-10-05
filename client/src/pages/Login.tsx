import { Link, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { useEffect } from 'react';
import { IRootState } from '../store';
import { setPageTitle } from '../store/themeConfigSlice';
import { Icon } from '@iconify/react';
import { useAuth } from '../misc/auth-context';

const Login = () => {
    const dispatch = useDispatch();
    const themeConfig = useSelector((state: IRootState) => state.themeConfig);

    useEffect(() => {
        dispatch(setPageTitle('Sign in'));
    }, [dispatch]);

    const navigate = useNavigate();
    const { isAuthenticated, signInWithGoogle } = useAuth();

    if (isAuthenticated) {
        navigate('/');
    }

    const handleLogin = async () => {
        try {
            await signInWithGoogle();
            navigate('/');
        } catch (error) {
            console.error('Failed to sign in with Google', error);
        }
    };

    return (
        <div
            style={{
                backgroundImage: `linear-gradient(${themeConfig.isDarkMode ? 'rgba(237,231,246, 0.1)' : 'rgba(0,0,0, 0.1)'} 1px, transparent 1px), linear-gradient(to right, ${
                    themeConfig.isDarkMode ? 'rgba(237,231,246, 0.1)' : 'rgba(0,0,0, 0.1)'
                } 1px, transparent 1px)`,
                backgroundPosition: 'center center',
                backgroundSize: '70px 70px',
            }}
        >
            <div className="relative flex min-h-screen items-center justify-center">
                <div className="relative w-full max-w-[500px] rounded-3xl px-10 py-7 bg-black">
                    <div className="text-center mb-8 mt-2">
                        <h1 className="text-3xl font-bold text-[#EDE7F6]">Sign in</h1>
                    </div>
                    <div className="mb-5 flex items-center justify-center">
                        <button onClick={handleLogin} className="flex w-full items-center justify-center rounded-xl bg-primary p-4 text-white hover:bg-primary/80 text-lg font-semibold">
                            <Icon icon="logos:google-icon" className="mr-3 w-6 h-6 bg-white rounded-full p-1" />
                            Continue with Google
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Login;
