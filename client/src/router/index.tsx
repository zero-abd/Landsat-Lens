import { createBrowserRouter, Navigate } from 'react-router-dom';
import BlankLayout from '../components/Layouts/BlankLayout';
import DefaultLayout from '../components/Layouts/DefaultLayout';
import { routes } from './routes';

const finalRoutes = [
    ...routes.map((route) => {
        const Component = route.element;
        const Layout = route.layout === 'blank' ? BlankLayout : DefaultLayout;
        return {
            path: route.path,
            element: (
                <Layout>
                    <Component />
                </Layout>
            ),
        };
    }),
    // Old links from the hackathon build.
    { path: '/login', element: <Navigate to="/" replace /> },
    { path: '*', element: <Navigate to="/" replace /> },
];

const router = createBrowserRouter(finalRoutes);

export default router;
