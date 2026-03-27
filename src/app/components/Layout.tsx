import { ReactNode } from 'react';
import { Link, useLocation } from 'react-router';
import { 
  LayoutDashboard, 
  Users, 
  User,
  FileText, 
  DollarSign, 
  BarChart3,
  History,
  LogOut,
  ShieldCheck
} from 'lucide-react';
import { cn } from './ui/utils';
import logoSynestia from '../assets/image.png';
import { useAuth } from '../context/AuthContext';

interface LayoutProps {
  children: ReactNode;
}

const menuItems = [
  { path: '/', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/suplidores', label: 'Suplidores', icon: Users },
  { path: '/cuentas-por-pagar', label: 'Cuentas por Pagar', icon: FileText },
  { path: '/pagos', label: 'Pagos / Egresos', icon: DollarSign },
  { path: '/reportes', label: 'Reportes', icon: BarChart3 },
  { path: '/historial', label: 'Historial', icon: History }
];

export function Layout({ children }: LayoutProps) {
  const location = useLocation();
  const { perfil, signOut } = useAuth();
  const menuFinal = perfil?.rol === 'super_admin'
    ? [...menuItems, { path: '/admin/usuarios', label: 'Panel Privado', icon: ShieldCheck }]
    : menuItems;

  const handleSignOut = async () => {
    await signOut();
  };

  const navItemClass = "flex items-center gap-3 px-4 py-2 rounded-lg mb-1 transition-colors";

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      {/* Sidebar */}
      <aside className="w-64 h-full shrink-0 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-4 border-b border-gray-200">
          <img
            src={logoSynestia}
            alt="SynestiaTech"
            className="w-full max-w-[150px] h-auto"
          />
          <h1 className="text-base font-bold text-gray-900 mt-2">Sistema C x P</h1>
          <p className="text-xs text-gray-500 mt-0.5">Gestion de Cuentas</p>
        </div>
        
        <nav className="p-4 flex flex-1 flex-col">
          <div>
            {menuFinal.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={cn(
                    navItemClass,
                    isActive 
                      ? "bg-blue-50 text-blue-700" 
                      : "text-gray-700 hover:bg-gray-50"
                  )}
                >
                  <Icon className="size-5" />
                  <span>{item.label}</span>
                </Link>
              );
            })}

            <button
              type="button"
              onClick={handleSignOut}
              className={cn(navItemClass, "w-full text-gray-700 hover:bg-gray-50")}
            >
              <LogOut className="size-5" />
              <span>Cerrar sesión</span>
            </button>
          </div>

          <div className="mt-2">
            <div className={cn(navItemClass, "text-gray-600")}>
              <User className="size-5" />
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-gray-800">{perfil?.username || 'Usuario'}</p>
                <p className="truncate text-xs text-gray-500">{perfil?.nombreEmpresa || 'Empresa sin asignar'}</p>
              </div>
            </div>
          </div>
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 h-full overflow-y-auto">
        <div className="p-8">
          {children}
        </div>
      </main>
    </div>
  );
}