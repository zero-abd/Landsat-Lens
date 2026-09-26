import React, { Suspense } from 'react';
import ReactDOM from 'react-dom/client';
import 'react-perfect-scrollbar/dist/css/styles.css';
import './tailwind.css';
import './custom.css';
import { RouterProvider } from 'react-router-dom';
import router from './router/index';
import { Provider } from 'react-redux';
import store from './store/index';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
    <React.StrictMode>
        <Provider store={store}>
            <Suspense>
                <RouterProvider router={router} />
            </Suspense>
        </Provider>
    </React.StrictMode>
);
