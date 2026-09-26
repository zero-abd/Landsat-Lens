import { NavLink } from 'react-router-dom';
import { Icon } from '@iconify/react';
import { routes } from '../router/routes';

const Index = () => {
    return (
        <div className="container mx-auto p-6 max-w-4xl">
            <div className="text-center">
                <h1 className="text-4xl font-bold mb-3">Landsat Lens</h1>
                <p className="text-lg text-gray-600 dark:text-gray-400">
                    Track NASA/USGS Landsat 8 and 9 in real time, see when they next pass over a place, and read real Landsat surface reflectance for any spot on Earth.
                </p>
            </div>

            <div className="mt-10 grid grid-cols-1 md:grid-cols-3 gap-6">
                {routes
                    .filter((r) => r.path !== '/')
                    .map((item) => (
                        <NavLink
                            to={item.path}
                            key={item.path}
                            className="group block px-5 py-6 rounded-2xl bg-white-light/40 dark:bg-dark/40 hover:bg-primary/10 dark:hover:bg-primary/10 transition-shadow duration-300 ease-in-out"
                        >
                            <div className="flex items-center mb-2">
                                <Icon icon={item.icon} className="text-3xl mr-3 text-primary" />
                                <span className="text-lg font-medium text-black dark:text-[#798293] dark:group-hover:text-blue-400 transition-colors duration-200">{item.name}</span>
                            </div>
                            <p className="text-sm text-gray-600 dark:text-gray-400">{item.description}</p>
                        </NavLink>
                    ))}
            </div>

            <p className="mt-10 text-center text-xs text-gray-500">
                Built by Team Paragon for the NASA Space Apps Challenge 2024. Orbital elements from{' '}
                <a className="underline" href="https://celestrak.org" target="_blank" rel="noreferrer">
                    Celestrak
                </a>
                ; imagery and reflectance from USGS Landsat Collection 2 Level-2 via the{' '}
                <a className="underline" href="https://planetarycomputer.microsoft.com/dataset/landsat-c2-l2" target="_blank" rel="noreferrer">
                    Microsoft Planetary Computer
                </a>
                . Source on{' '}
                <a className="underline" href="https://github.com/zero-abd/Landsat-Lens" target="_blank" rel="noreferrer">
                    GitHub
                </a>
                .
            </p>
        </div>
    );
};

export default Index;
