import { Navigate } from 'react-router';
import type { ReactNode } from 'react';
import { useAuth } from '../context/AuthContext';
import type { RolUsuario } from '../context/AuthContext';

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { session, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen grid place-items-center bg-gray-50">
        <div className="text-sm text-gray-500">Cargando sesión...</div>
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

export function PublicOnlyRoute({ children }: { children: ReactNode }) {
  const { session, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen grid place-items-center bg-gray-50">
        <div className="text-sm text-gray-500">Cargando sesión...</div>
      </div>
    );
  }

  if (session) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

export function RoleRoute({
  children,
  allowedRoles
}: {
  children: ReactNode;
  allowedRoles: RolUsuario[];
}) {
  const { session, perfil, loading, perfilLoading } = useAuth();

  if (loading || perfilLoading) {
    return (
      <div className="min-h-screen grid place-items-center bg-gray-50">
        <div className="text-sm text-gray-500">Validando permisos...</div>
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  if (!perfil) {
    return <Navigate to="/" replace />;
  }

  if (!allowedRoles.includes(perfil.rol)) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
