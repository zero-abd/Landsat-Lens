import { lazy } from 'react';
const Index = lazy(() => import('../pages/Index'));
const Login = lazy(() => import('../pages/Login'));
const SatelliteTracking = lazy(() => import('../pages/SatelliteTracking'));
const Map = lazy(() => import('../pages/Location'));
const AcquisitionData = lazy(() => import('../pages/AcquisitionData'));
const GroundData = lazy(() => import('../pages/GroundData'));
const Logout = lazy(() => import('../pages/Logout'));

const routes = [
    {
        path: '/',
        name: 'Home',
        icon: 'hugeicons:dashboard-square-01',
        element: Index,
        layout: 'default',
    },
    {
        path: '/satellite-tracking',
        name: 'Satellite Tracking',
        icon: 'material-symbols-light:satellite-alt',
        element: SatelliteTracking,
        layout: 'default',
    },
    {
        path: '/location',
        name: 'Select Location',
        icon: 'mynaui:location',
        element: Map,
        layout: 'default',
    },
    {
        path: '/acquisition-data',
        name: 'Acquisition Data',
        icon: 'fluent:data-usage-24-regular',
        element: AcquisitionData,
        layout: 'default',
    },
    {
        path: '/ground-data',
        name: 'Ground data',
        icon: 'iconoir:soil-alt',
        element: GroundData,
        layout: 'default',
    },
    {
        path: '/login',
        name: 'Login',
        icon: 'mdi:login',
        element: Login,
        layout: 'blank',
    },
    {
        path: '/logout',
        name: 'Sign Out',
        icon: 'mdi:logout',
        element: Logout,
        layout: 'blank',
    },
];

export { routes };
