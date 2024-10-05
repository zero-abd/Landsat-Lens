import React from 'react';
import { Navigate, RouteProps } from 'react-router-dom';
import { useAuth } from '../misc/auth-context';

// @ts-ignore
interface ProtectedRouteProps extends RouteProps {
    component: React.ComponentType<any>;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ component: Component, ...rest }) => {
    const { isAuthenticated } = useAuth();

    return isAuthenticated ? <Component {...rest} /> : <Navigate to="/login" />;
};

export default ProtectedRoute;
