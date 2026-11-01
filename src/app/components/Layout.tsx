import { ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import {
  LayoutDashboard,
  Users,
  FileText,
  DollarSign,
  BarChart3,
  History,
  LogOut,
  ShieldCheck,
  Search,
  PanelLeftClose,
  PanelLeftOpen,
  Languages,
  ChevronRight,
  type LucideIcon
} from 'lucide-react';
import { cn } from './ui/utils';
import logoSynestia from '../assets/image.png';
import { useAuth } from '../context/AuthContext';
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip';
import { useIdioma } from '../i18n/LanguageContext';
import { ZH } from '../i18n/zh';

interface LayoutProps {
  children: ReactNode;
}

interface MenuItem {
  path: string;
  label: string;
  icon: LucideIcon;
}

interface MenuGroup {
  title: string;
  items: MenuItem[];
  superAdminOnly?: boolean;
}

const menuGroups: MenuGroup[] = [
  {
    title: 'General',
    items: [{ path: '/', label: 'Dashboard', icon: LayoutDashboard }]
  },
  {
    title: 'Operaciones',
    items: [
      { path: '/suplidores', label: 'Suplidores', icon: Users },
      { path: '/cuentas-por-pagar', label: 'Cuentas por Pagar', icon: FileText },
      { path: '/pagos', label: 'Pagos / Egresos', icon: DollarSign }
    ]
  },
  {
    title: 'Análisis',
    items: [
      { path: '/reportes', label: 'Reportes', icon: BarChart3 },
      { path: '/historial', label: 'Historial', icon: History }
    ]
  },
  {
    title: 'Administración',
    superAdminOnly: true,
    items: [{ path: '/admin/usuarios', label: 'Panel Privado', icon: ShieldCheck }]
  }
];

const COLLAPSED_KEY = 'sidebar-collapsed';
const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);

const normalize = (text: string) =>
  text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

function getInitials(name?: string) {
  if (!name) return 'U';
  const parts = name.trim().split(/[\s._-]+/).filter(Boolean);
  const initials = parts.length > 1 ? parts[0][0] + parts[1][0] : parts[0].slice(0, 2);
  return initials.toUpperCase();
}

/** Muestra un tooltip a la derecha solo cuando el menú está colapsado. */
function SideTip({ show, label, children }: { show: boolean; label: string; children: ReactNode }) {
  if (!show) return <>{children}</>;
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side="right" sideOffset={10}>
        {label}
      </TooltipContent>
    </Tooltip>
  );
}

export function Layout({ children }: LayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { perfil, signOut } = useAuth();

  const [collapsed, setCollapsed] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem(COLLAPSED_KEY);
      if (saved !== null) return saved === '1';
    } catch {
      /* sin almacenamiento */
    }
    return typeof window !== 'undefined' && window.innerWidth < 768;
  });
  const [query, setQuery] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      localStorage.setItem(COLLAPSED_KEY, collapsed ? '1' : '0');
    } catch {
      /* sin almacenamiento */
    }
  }, [collapsed]);

  const focusSearch = () => {
    setCollapsed(false);
    requestAnimationFrame(() => searchRef.current?.focus());
  };

  // Atajo Ctrl+K / ⌘K para buscar en el menú
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        focusSearch();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const visibleGroups = useMemo(() => {
    const q = normalize(query.trim());
    return menuGroups
      .filter((g) => !g.superAdminOnly || perfil?.rol === 'super_admin')
      .map((g) => ({
        ...g,
        items: q ? g.items.filter((i) => normalize(i.label).includes(q) || (ZH[i.label] ?? '').includes(query.trim())) : g.items
      }))
      .filter((g) => g.items.length > 0);
  }, [query, perfil?.rol]);

  const { idioma, alternarIdioma } = useIdioma();

  // Sección y página actual para la barra superior
  const actual = menuGroups
    .flatMap((g) => g.items.map((i) => ({ grupo: g.title, item: i })))
    .find(({ item }) => (item.path === '/' ? location.pathname === '/' : location.pathname.startsWith(item.path)));

  const isActive = (path: string) =>
    path === '/' ? location.pathname === '/' : location.pathname.startsWith(path);

  const handleSearchKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      const first = visibleGroups[0]?.items[0];
      if (first) {
        navigate(first.path);
        setQuery('');
        searchRef.current?.blur();
      }
    } else if (e.key === 'Escape') {
      setQuery('');
      searchRef.current?.blur();
    }
  };

  const userName = perfil?.username || 'Usuario';

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      <aside className={cn('sidebar-pro', collapsed && 'sidebar-pro--collapsed')}>
        {/* Marca */}
        <div className="sidebar-pro__brand">
          <img src={logoSynestia} alt="SynestiaTech" className="sidebar-pro__logo" />
          <div className="sidebar-pro__brand-text">
            <p className="sidebar-pro__title">Sistema C x P</p>
            <p className="sidebar-pro__subtitle">Gestión de Cuentas</p>
          </div>
          <SideTip show={collapsed} label="Expandir menú">
            <button
              type="button"
              className="sidebar-pro__icon-btn"
              onClick={() => setCollapsed((c) => !c)}
              aria-label={collapsed ? 'Expandir menú' : 'Colapsar menú'}
            >
              {collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
            </button>
          </SideTip>
        </div>

        {/* Búsqueda */}
        <div className="sidebar-pro__search-wrap">
          {collapsed ? (
            <SideTip show label={`Buscar (${isMac ? '⌘' : 'Ctrl'}+K)`}>
              <button type="button" className="sidebar-pro__search" onClick={focusSearch} aria-label="Buscar">
                <Search size={16} />
              </button>
            </SideTip>
          ) : (
            <label className="sidebar-pro__search">
              <Search size={16} />
              <input
                ref={searchRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleSearchKey}
                placeholder="Buscar…"
                aria-label="Buscar en el menú"
              />
              {!query && <kbd className="sidebar-pro__kbd">{isMac ? '⌘K' : 'Ctrl+K'}</kbd>}
            </label>
          )}
        </div>

        {/* Navegación */}
        <nav className="sidebar-pro__nav">
          {visibleGroups.length === 0 && (
            <p className="sidebar-pro__empty">Sin resultados para “{query}”</p>
          )}
          {visibleGroups.map((group) => (
            <div key={group.title} className="sidebar-pro__group">
              <p className="sidebar-pro__group-label">{group.title}</p>
              {group.items.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.path);
                return (
                  <SideTip key={item.path} show={collapsed} label={item.label}>
                    <Link
                      to={item.path}
                      onClick={() => setQuery('')}
                      aria-current={active ? 'page' : undefined}
                      className={cn('sidebar-pro__item', active && 'sidebar-pro__item--active')}
                    >
                      <Icon />
                      <span className="sidebar-pro__label">{item.label}</span>
                    </Link>
                  </SideTip>
                );
              })}
            </div>
          ))}
        </nav>

        {/* Usuario */}
        <div className="sidebar-pro__user">
          <SideTip show={collapsed} label={userName}>
            <div className="sidebar-pro__avatar">{getInitials(perfil?.username)}</div>
          </SideTip>
          <div className="sidebar-pro__user-info">
            <p className="sidebar-pro__user-name">{userName}</p>
            <p className="sidebar-pro__user-meta">
              <i className="sidebar-pro__dot" />
              <span>{perfil?.nombreEmpresa || 'Empresa sin asignar'}</span>
            </p>
          </div>
          <SideTip show={collapsed} label="Cerrar sesión">
            <button
              type="button"
              className="sidebar-pro__icon-btn sidebar-pro__icon-btn--danger"
              onClick={() => signOut()}
              aria-label="Cerrar sesión"
              title={collapsed ? undefined : 'Cerrar sesión'}
            >
              <LogOut size={17} />
            </button>
          </SideTip>
        </div>
      </aside>

      {/* Contenido principal */}
      <main className="flex-1 h-full overflow-y-auto">
        {/* Barra superior */}
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-4 border-b border-gray-200 bg-white/85 px-8 backdrop-blur print:hidden">
          <nav className="flex min-w-0 items-center gap-1.5 text-sm" aria-label="Ruta">
            <span className="text-gray-500">{actual?.grupo ?? 'General'}</span>
            <ChevronRight className="size-4 shrink-0 text-gray-300" />
            <span className="truncate font-semibold text-gray-900">{actual?.item.label ?? 'Dashboard'}</span>
          </nav>

          <button
            type="button"
            onClick={alternarIdioma}
            title={idioma === 'zh' ? 'Cambiar a español' : '切换到中文'}
            className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-sm font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-50"
            translate="no"
          >
            <Languages className="size-4 text-gray-500" />
            <span className="flex overflow-hidden rounded-md bg-gray-100 p-0.5 text-xs">
              <span className={cn('rounded px-2 py-0.5 transition-colors', idioma === 'es' ? 'bg-gray-900 text-white' : 'text-gray-500')}>ES</span>
              <span className={cn('rounded px-2 py-0.5 transition-colors', idioma === 'zh' ? 'bg-gray-900 text-white' : 'text-gray-500')}>中文</span>
            </span>
          </button>
        </header>

        <div className="p-8">{children}</div>
      </main>
    </div>
  );
}
