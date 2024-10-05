import { createBrowserRouter } from 'react-router-dom';
import BlankLayout from '../components/Layouts/BlankLayout';
import DefaultLayout from '../components/Layouts/DefaultLayout';
import { routes } from './routes';
import ProtectedRoute from '../components/ProtectedRoute';

const finalRoutes = routes.map((route) => {
    const Component = route.element;
    const Layout = route.layout === 'blank' ? BlankLayout : DefaultLayout;

    return {
        ...route,
        element:
            route.path === '/login' ? (
                <Layout>
                    <Component />
                </Layout>
            ) : (
                <ProtectedRoute
                    component={() => (
                        <Layout>
                            <Component />
                        </Layout>
                    )}
                />
            ),
    };
});

const router = createBrowserRouter(finalRoutes);

export default router;
