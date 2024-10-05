import { useAuth } from '../misc/auth-context';
import { NavLink } from 'react-router-dom';
import { Icon } from '@iconify/react';
import { routes } from '../router/routes';

const Index = () => {
    const { currentUser } = useAuth();
    const toIgnore = ['/login', '/logout', '/'];

    return (
        <div className="container mx-auto p-6">
            <div className="text-center">
                <h1 className="text-4xl font-bold mb-4">Welcome, {currentUser?.displayName?.split(' ')[0]}!</h1>
                <p className="text-lg text-gray-600">Check Out The Features</p>
            </div>

            <div className="mt-10 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 gap-8">
                {routes.map(
                    (item) =>
                        !toIgnore.includes(item.path) && (
                            <NavLink
                                to={item.path}
                                key={item.path}
                                className="group block px-5 py-8  rounded-2xl bg-white-light/40 dark:bg-dark/40 hover:bg-primary/10 dark:hover:bg-primary/10 transition-shadow duration-300 ease-in-out"
                            >
                                <div className="flex items-center">
                                    <Icon icon={item.icon} className="text-3xl mr-4 text-primary" />
                                    <span className="text-lg font-medium text-black dark:text-[#798293] dark:group-hover:text-blue-400 transition-colors duration-200">{item.name}</span>
                                </div>
                            </NavLink>
                        )
                )}
            </div>
        </div>
    );
};

export default Index;
