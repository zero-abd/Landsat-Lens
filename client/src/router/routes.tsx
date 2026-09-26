import { lazy } from 'react';
const Index = lazy(() => import('../pages/Index'));
const SatelliteTracking = lazy(() => import('../pages/SatelliteTracking'));
const Map = lazy(() => import('../pages/Location'));
const GroundData = lazy(() => import('../pages/GroundData'));

const routes = [
    {
        path: '/',
        name: 'Home',
        icon: 'hugeicons:dashboard-square-01',
        element: Index,
        layout: 'default',
        description: '',
    },
    {
        path: '/satellite-tracking',
        name: 'Satellite Tracking',
        icon: 'material-symbols-light:satellite-alt',
        element: SatelliteTracking,
        layout: 'default',
        description: 'Live positions and ground tracks of Landsat 8 and 9, computed in your browser from Celestrak TLEs.',
    },
    {
        path: '/location',
        name: 'Scene Explorer',
        icon: 'mynaui:location',
        element: Map,
        layout: 'default',
        description: 'Click any point for the latest Landsat scene, its true-color preview, per-band surface reflectance and the next overpass dates.',
    },
    {
        path: '/ground-data',
        name: 'Ground Data',
        icon: 'iconoir:soil-alt',
        element: GroundData,
        layout: 'default',
        description: 'How to collect ground-based spectral measurements to compare with Landsat reflectance.',
    },
];

export { routes };
