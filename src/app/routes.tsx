import { createBrowserRouter, Outlet } from 'react-router';
import { Layout } from './components/Layout';
import { Dashboard } from './pages/Dashboard';
import { Suplidores } from './pages/Suplidores';
import { CuentasPorPagar } from './pages/CuentasPorPagar';
import { Pagos } from './pages/Pagos';
import { Reportes } from './pages/Reportes';
import { Historial } from './pages/Historial';
import { Login } from './pages/Login';
import { ProtectedRoute, PublicOnlyRoute, RoleRoute } from './components/RouteGuards';
import { DataProvider } from './context/DataContext';
import { AdminUsuarios } from './pages/AdminUsuarios';

function ProtectedShell() {
  return (
    <ProtectedRoute>
      <DataProvider>
        <Layout>
          <Outlet />
        </Layout>
      </DataProvider>
    </ProtectedRoute>
  );
}

export const router = createBrowserRouter([
  {
    path: '/login',
    element: (
      <PublicOnlyRoute>
        <Login />
      </PublicOnlyRoute>
    )
  },
  {
    path: '/',
    element: <ProtectedShell />,
    children: [
      {
        index: true,
        element: <Dashboard />
      },
      {
        path: 'suplidores',
        element: <Suplidores />
      },
      {
        path: 'cuentas-por-pagar',
        element: <CuentasPorPagar />
      },
      {
        path: 'pagos',
        element: <Pagos />
      },
      {
        path: 'reportes',
        element: <Reportes />
      },
      {
        path: 'historial',
        element: <Historial />
      },
      {
        path: 'admin/usuarios',
        element: (
          <RoleRoute allowedRoles={['super_admin']}>
            <AdminUsuarios />
          </RoleRoute>
        )
      }
    ]
  }
]);
