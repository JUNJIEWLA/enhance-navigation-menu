import { useEffect, useMemo, useState } from 'react';
import { Factura, Suplidor, useData } from '../context/DataContext';
import { Card, CardContent } from '../components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '../components/ui/alert';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '../components/ui/sheet';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '../components/ui/dropdown-menu';
import { PagoDialog } from '../components/PagoDialog';
import { cn } from '../components/ui/utils';
import { useAuth } from '../context/AuthContext';
import {
  Plus, Search, MoreVertical, Edit, Trash2, Phone, Mail, MapPin, FileText, ChevronRight,
  LayoutGrid, List, ArrowUpDown, ArrowUp, ArrowDown, Users, Wallet, AlertTriangle, CheckCircle2,
  CreditCard, Receipt, X, CalendarClock
} from 'lucide-react';

// ─── Utilidades ───────────────────────────────────────────────────────────────

type OrdenSuplidores = 'nombre-asc' | 'nombre-desc' | 'deuda-desc' | 'deuda-asc' | 'facturas-desc' | 'codigo-asc';
type FiltroSuplidores = 'todos' | 'deuda' | 'aldia';
type FiltroFacturas = 'pendientes' | 'pagadas' | 'anuladas' | 'todas';
type OrdenFacturas = 'vencimiento' | 'recientes' | 'balance' | 'numero';

const ORDEN_LABELS: Record<OrdenSuplidores, string> = {
  'nombre-asc': 'Nombre (A → Z)',
  'nombre-desc': 'Nombre (Z → A)',
  'deuda-desc': 'Mayor balance pendiente',
  'deuda-asc': 'Menor balance pendiente',
  'facturas-desc': 'Más facturas',
  'codigo-asc': 'Código'
};

const PREFS_KEY = 'suplidores-prefs';

const AVATAR_COLORS = [
  'from-sky-500 to-blue-600',
  'from-rose-500 to-pink-600',
  'from-amber-400 to-orange-500',
  'from-emerald-500 to-teal-600',
  'from-violet-500 to-purple-600',
  'from-cyan-500 to-sky-600'
];

const colorDe = (texto: string) => {
  let hash = 0;
  for (let i = 0; i < texto.length; i++) hash = (hash * 31 + texto.charCodeAt(i)) | 0;
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
};

const iniciales = (nombre: string) => {
  const partes = nombre.trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return '?';
  return (partes.length > 1 ? partes[0][0] + partes[1][0] : partes[0].slice(0, 2)).toUpperCase();
};

const normalizar = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('es-DO', { style: 'currency', currency: 'DOP' }).format(value);

const formatDate = (value: Date | string) =>
  new Date(value).toLocaleDateString('es-DO', { day: '2-digit', month: 'short', year: 'numeric' });

const hoy = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};

const estaAbierta = (f: Factura) => f.estado === 'Pendiente' || f.estado === 'Parcial';
const estaVencida = (f: Factura) => estaAbierta(f) && new Date(f.fechaVencimiento) < hoy();
const diasEntre = (a: Date, b: Date) => Math.round((a.getTime() - b.getTime()) / 86_400_000);

const ESTADO_STYLES: Record<Factura['estado'], string> = {
  Pendiente: 'bg-red-50 text-red-700 border-red-200',
  Parcial: 'bg-amber-50 text-amber-700 border-amber-200',
  Pagado: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  Anulada: 'bg-gray-100 text-gray-500 border-gray-200'
};

interface Stats {
  total: number;
  abiertas: number;
  vencidas: number;
  deuda: number;
  facturado: number;
}

function Avatar({ nombre, size = 'md' }: { nombre: string; size?: 'md' | 'lg' }) {
  return (
    <div
      className={cn(
        'flex shrink-0 items-center justify-center rounded-xl bg-gradient-to-br font-semibold text-white shadow-sm',
        colorDe(nombre),
        size === 'lg' ? 'size-14 text-lg' : 'size-11 text-sm'
      )}
    >
      {iniciales(nombre)}
    </div>
  );
}

function Kpi({ icon: Icon, label, value, tone }: { icon: typeof Users; label: string; value: string | number; tone: string }) {
  return (
    <Card className="gap-0 py-0">
      <CardContent className="flex items-center gap-4 p-5">
        <div className={cn('flex size-11 items-center justify-center rounded-xl', tone)}>
          <Icon className="size-5" />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-medium text-gray-500">{label}</p>
          <p className="truncate text-xl font-semibold text-gray-900">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function Segmented<T extends string>({ value, onChange, options }: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string; count?: number }[];
}) {
  return (
    <div className="inline-flex rounded-lg bg-gray-100 p-1">
      {options.map(o => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={cn(
            'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-all',
            value === o.value ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-800'
          )}
        >
          {o.label}
          {o.count !== undefined && (
            <span className={cn('rounded-full px-1.5 text-xs', value === o.value ? 'bg-gray-900 text-white' : 'bg-gray-200 text-gray-600')}>
              {o.count}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

// ─── Página ───────────────────────────────────────────────────────────────────

export function Suplidores() {
  const { suplidores, facturas, pagos, agregarSuplidor, editarSuplidor, eliminarSuplidor, contarFacturasDeSuplidor } = useData();
  const { perfil } = useAuth();

  // Preferencias de vista (se recuerdan en el navegador)
  const prefsIniciales = (() => {
    try {
      return JSON.parse(localStorage.getItem(PREFS_KEY) || '{}') as { orden?: OrdenSuplidores; vista?: 'grid' | 'lista' };
    } catch {
      return {};
    }
  })();

  const [busqueda, setBusqueda] = useState('');
  const [filtro, setFiltro] = useState<FiltroSuplidores>('todos');
  const [orden, setOrden] = useState<OrdenSuplidores>(prefsIniciales.orden ?? 'nombre-asc');
  const [vista, setVista] = useState<'grid' | 'lista'>(prefsIniciales.vista ?? 'grid');

  useEffect(() => {
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify({ orden, vista }));
    } catch {
      /* sin almacenamiento */
    }
  }, [orden, vista]);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogEliminarOpen, setDialogEliminarOpen] = useState(false);
  const [menuAccionesAbierto, setMenuAccionesAbierto] = useState<string | null>(null);
  const [editando, setEditando] = useState(false);
  const [validandoEliminacion, setValidandoEliminacion] = useState(false);
  const [facturasAsociadas, setFacturasAsociadas] = useState(0);
  const [suplidorAEliminar, setSuplidorAEliminar] = useState<Suplidor | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [errorNombre, setErrorNombre] = useState('');
  const [errorOperacion, setErrorOperacion] = useState('');
  const [suplidorActual, setSuplidorActual] = useState({
    id: '',
    codigo: '',
    nombre: '',
    ruc: '',
    telefono: '',
    email: '',
    direccion: ''
  });

  // Panel de facturas + pago
  const [suplidorPanelId, setSuplidorPanelId] = useState<string | null>(null);
  const [tabPanel, setTabPanel] = useState<'facturas' | 'pagos'>('facturas');
  const [filtroFacturas, setFiltroFacturas] = useState<FiltroFacturas>('pendientes');
  const [ordenFacturas, setOrdenFacturas] = useState<OrdenFacturas>('vencimiento');
  const [busquedaFactura, setBusquedaFactura] = useState('');
  const [facturaAPagar, setFacturaAPagar] = useState<string | null>(null);

  // ── Estadísticas por suplidor ─────────────────────────────────────────────
  const statsPorSuplidor = useMemo(() => {
    const map = new Map<string, Stats>();
    for (const f of facturas) {
      const s = map.get(f.suplidorId) ?? { total: 0, abiertas: 0, vencidas: 0, deuda: 0, facturado: 0 };
      s.total++;
      if (f.estado !== 'Anulada') s.facturado += f.montoTotal;
      if (estaAbierta(f)) {
        s.abiertas++;
        s.deuda += f.balancePendiente;
      }
      if (estaVencida(f)) s.vencidas++;
      map.set(f.suplidorId, s);
    }
    return map;
  }, [facturas]);

  const statsDe = (id: string): Stats =>
    statsPorSuplidor.get(id) ?? { total: 0, abiertas: 0, vencidas: 0, deuda: 0, facturado: 0 };

  const resumen = useMemo(() => {
    let conDeuda = 0, deudaTotal = 0, vencidas = 0;
    for (const s of suplidores) {
      const st = statsDe(s.id);
      if (st.deuda > 0) conDeuda++;
      deudaTotal += st.deuda;
      vencidas += st.vencidas;
    }
    return { conDeuda, deudaTotal, vencidas };
  }, [suplidores, statsPorSuplidor]);

  // ── Filtro + orden ────────────────────────────────────────────────────────
  const suplidoresVisibles = useMemo(() => {
    const q = normalizar(busqueda.trim());
    const lista = suplidores.filter(s => {
      const st = statsDe(s.id);
      if (filtro === 'deuda' && st.deuda <= 0) return false;
      if (filtro === 'aldia' && st.deuda > 0) return false;
      if (!q) return true;
      return [s.nombre, s.ruc, s.email, s.codigo, s.telefono].some(v => normalizar(v || '').includes(q));
    });

    const porNombre = (a: Suplidor, b: Suplidor) => a.nombre.localeCompare(b.nombre, 'es', { sensitivity: 'base' });
    return lista.sort((a, b) => {
      const sa = statsDe(a.id), sb = statsDe(b.id);
      switch (orden) {
        case 'nombre-desc': return -porNombre(a, b);
        case 'deuda-desc': return sb.deuda - sa.deuda || porNombre(a, b);
        case 'deuda-asc': return sa.deuda - sb.deuda || porNombre(a, b);
        case 'facturas-desc': return sb.total - sa.total || porNombre(a, b);
        case 'codigo-asc': return (a.codigo || '').localeCompare(b.codigo || '', 'es', { numeric: true });
        default: return porNombre(a, b);
      }
    });
  }, [suplidores, busqueda, filtro, orden, statsPorSuplidor]);

  const toggleOrdenColumna = (col: 'nombre' | 'deuda' | 'facturas') => {
    if (col === 'nombre') setOrden(orden === 'nombre-asc' ? 'nombre-desc' : 'nombre-asc');
    if (col === 'deuda') setOrden(orden === 'deuda-desc' ? 'deuda-asc' : 'deuda-desc');
    if (col === 'facturas') setOrden('facturas-desc');
  };

  const iconoOrden = (col: 'nombre' | 'deuda' | 'facturas') => {
    const activo =
      (col === 'nombre' && orden.startsWith('nombre')) ||
      (col === 'deuda' && orden.startsWith('deuda')) ||
      (col === 'facturas' && orden === 'facturas-desc');
    if (!activo) return <ArrowUpDown className="size-3.5 opacity-40" />;
    return orden.endsWith('asc') ? <ArrowUp className="size-3.5" /> : <ArrowDown className="size-3.5" />;
  };

  // ── Código SUP-XXX secuencial ─────────────────────────────────────────────
  const generarCodigo = (): string => {
    const numerosExistentes = suplidores.map(s => {
      const match = (s.codigo || '').match(/^SUP-(?:[A-Z0-9]+-)?(\d+)$/);
      return match ? parseInt(match[1], 10) : 0;
    });
    const siguiente = numerosExistentes.length > 0 ? Math.max(...numerosExistentes) + 1 : 1;
    const empresaPrefix = perfil?.empresaId
      ? perfil.empresaId.replace(/-/g, '').slice(0, 8).toUpperCase()
      : 'GLOBAL';
    return `SUP-${empresaPrefix}-${String(siguiente).padStart(3, '0')}`;
  };

  const cerrarMenuAcciones = () => setMenuAccionesAbierto(null);

  const ejecutarDespuesDeCerrarMenu = (accion: () => void) => {
    cerrarMenuAcciones();
    window.setTimeout(accion, 0);
  };

  // ── Panel de facturas ─────────────────────────────────────────────────────
  const abrirPanel = (suplidor: Suplidor, tab: 'facturas' | 'pagos' = 'facturas') => {
    const st = statsDe(suplidor.id);
    setTabPanel(tab);
    setFiltroFacturas(st.abiertas > 0 ? 'pendientes' : 'todas');
    setBusquedaFactura('');
    ejecutarDespuesDeCerrarMenu(() => setSuplidorPanelId(suplidor.id));
  };

  const suplidorPanel = suplidores.find(s => s.id === suplidorPanelId) ?? null;

  const facturasPanel = useMemo(
    () => (suplidorPanelId ? facturas.filter(f => f.suplidorId === suplidorPanelId) : []),
    [facturas, suplidorPanelId]
  );

  const facturasPanelVisibles = useMemo(() => {
    const q = normalizar(busquedaFactura.trim());
    return facturasPanel
      .filter(f => {
        if (filtroFacturas === 'pendientes' && !estaAbierta(f)) return false;
        if (filtroFacturas === 'pagadas' && f.estado !== 'Pagado') return false;
        if (filtroFacturas === 'anuladas' && f.estado !== 'Anulada') return false;
        if (!q) return true;
        return normalizar(`${f.numeroFactura} ${f.numeroExterno ?? ''}`).includes(q);
      })
      .sort((a, b) => {
        switch (ordenFacturas) {
          case 'recientes': return new Date(b.fechaEmision).getTime() - new Date(a.fechaEmision).getTime();
          case 'balance': return b.balancePendiente - a.balancePendiente;
          case 'numero': return a.numeroFactura.localeCompare(b.numeroFactura, 'es', { numeric: true });
          default: return new Date(a.fechaVencimiento).getTime() - new Date(b.fechaVencimiento).getTime();
        }
      });
  }, [facturasPanel, filtroFacturas, ordenFacturas, busquedaFactura]);

  const pagosPanel = useMemo(() => {
    const ids = new Set(facturasPanel.map(f => f.id));
    return pagos
      .filter(p => ids.has(p.facturaId))
      .sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());
  }, [pagos, facturasPanel]);

  const resumenPanel = useMemo(() => {
    const activas = facturasPanel.filter(f => f.estado !== 'Anulada');
    const facturado = activas.reduce((s, f) => s + f.montoTotal, 0);
    const pendiente = activas.filter(estaAbierta).reduce((s, f) => s + f.balancePendiente, 0);
    const pagado = Math.max(facturado - pendiente, 0);
    return {
      facturado,
      pendiente,
      pagado,
      porcentaje: facturado > 0 ? Math.round((pagado / facturado) * 100) : 0,
      cuenta: {
        pendientes: facturasPanel.filter(estaAbierta).length,
        pagadas: facturasPanel.filter(f => f.estado === 'Pagado').length,
        anuladas: facturasPanel.filter(f => f.estado === 'Anulada').length,
        todas: facturasPanel.length
      }
    };
  }, [facturasPanel]);

  const proximaAPagar = useMemo(
    () =>
      facturasPanel
        .filter(estaAbierta)
        .sort((a, b) => new Date(a.fechaVencimiento).getTime() - new Date(b.fechaVencimiento).getTime())[0],
    [facturasPanel]
  );

  // ── Crear / editar ────────────────────────────────────────────────────────
  const abrirDialogNuevo = () => {
    setEditando(false);
    setErrorNombre('');
    setErrorOperacion('');
    setSuplidorActual({ id: '', codigo: generarCodigo(), nombre: '', ruc: '', telefono: '', email: '', direccion: '' });
    setDialogOpen(true);
  };

  const abrirDialogEditar = (suplidor: Suplidor) => {
    setEditando(true);
    setErrorNombre('');
    setErrorOperacion('');
    setSuplidorActual({ ...suplidor, codigo: suplidor.codigo || '' });
    ejecutarDespuesDeCerrarMenu(() => setDialogOpen(true));
  };

  const handleGuardar = async () => {
    setGuardando(true);
    setErrorOperacion('');

    if (!suplidorActual.nombre.trim()) {
      setErrorNombre('El nombre del suplidor es obligatorio.');
      setGuardando(false);
      return;
    }

    if (!suplidorActual.ruc.trim()) {
      setErrorOperacion('El RNC / Cédula es obligatorio para crear o editar un suplidor.');
      setGuardando(false);
      return;
    }

    setErrorNombre('');

    try {
      if (editando) {
        await editarSuplidor(suplidorActual.id, {
          ...suplidorActual,
          nombre: suplidorActual.nombre.trim(),
          ruc: suplidorActual.ruc.trim()
        });
      } else {
        await agregarSuplidor({
          codigo: suplidorActual.codigo,
          nombre: suplidorActual.nombre.trim(),
          ruc: suplidorActual.ruc.trim(),
          telefono: suplidorActual.telefono,
          email: suplidorActual.email,
          direccion: suplidorActual.direccion
        });
      }
      setDialogOpen(false);
    } catch (error) {
      setErrorOperacion(error instanceof Error ? error.message : 'No fue posible guardar el suplidor.');
    } finally {
      setGuardando(false);
    }
  };

  // ── Eliminar ──────────────────────────────────────────────────────────────
  const abrirConfirmacionEliminar = async (suplidor: Suplidor) => {
    cerrarMenuAcciones();
    setSuplidorAEliminar(suplidor);
    setDialogEliminarOpen(true);
    setValidandoEliminacion(true);

    const totalFacturas = await contarFacturasDeSuplidor(suplidor.id);
    setFacturasAsociadas(totalFacturas);
    setValidandoEliminacion(false);
  };

  const confirmarEliminar = async () => {
    if (!suplidorAEliminar || facturasAsociadas > 0 || validandoEliminacion) return;
    await eliminarSuplidor(suplidorAEliminar.id);
    setDialogEliminarOpen(false);
    setSuplidorAEliminar(null);
    setFacturasAsociadas(0);
  };

  // ── Menú de acciones (compartido entre tarjeta y lista) ───────────────────
  const menuAcciones = (suplidor: Suplidor) => (
    <DropdownMenu
      open={menuAccionesAbierto === suplidor.id}
      onOpenChange={(open) => setMenuAccionesAbierto(open ? suplidor.id : null)}
    >
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="size-8 text-gray-500" onClick={(e) => e.stopPropagation()}>
          <MoreVertical className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48" onClick={(e) => e.stopPropagation()}>
        <DropdownMenuItem onSelect={() => abrirPanel(suplidor)}>
          <FileText className="size-4 mr-2" /> Ver facturas
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => abrirPanel(suplidor, 'pagos')}>
          <Receipt className="size-4 mr-2" /> Historial de pagos
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => abrirDialogEditar(suplidor)}>
          <Edit className="size-4 mr-2" /> Editar
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => abrirConfirmacionEliminar(suplidor)} className="text-red-600">
          <Trash2 className="size-4 mr-2" /> Eliminar
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Encabezado */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">Suplidores</h1>
          <p className="mt-1 text-gray-500">Directorio de proveedores, sus facturas y pagos</p>
        </div>
        <Button onClick={abrirDialogNuevo} className="shadow-sm">
          <Plus className="size-4 mr-2" />
          Nuevo Suplidor
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi icon={Users} label="Suplidores" value={suplidores.length} tone="bg-blue-50 text-blue-600" />
        <Kpi icon={Wallet} label="Con balance pendiente" value={resumen.conDeuda} tone="bg-amber-50 text-amber-600" />
        <Kpi icon={CreditCard} label="Deuda total" value={formatCurrency(resumen.deudaTotal)} tone="bg-rose-50 text-rose-600" />
        <Kpi icon={AlertTriangle} label="Facturas vencidas" value={resumen.vencidas} tone="bg-red-50 text-red-600" />
      </div>

      {/* Barra de herramientas */}
      <Card className="gap-0 py-0">
        <CardContent className="flex flex-col gap-3 p-4 lg:flex-row lg:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gray-400" />
            <Input
              placeholder="Buscar por nombre, código, RNC, email o teléfono…"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              className="pl-10 pr-9"
            />
            {busqueda && (
              <button
                type="button"
                onClick={() => setBusqueda('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                aria-label="Limpiar búsqueda"
              >
                <X className="size-4" />
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Segmented
              value={filtro}
              onChange={setFiltro}
              options={[
                { value: 'todos', label: 'Todos', count: suplidores.length },
                { value: 'deuda', label: 'Con deuda', count: resumen.conDeuda },
                { value: 'aldia', label: 'Al día', count: suplidores.length - resumen.conDeuda }
              ]}
            />

            <Select value={orden} onValueChange={(v) => setOrden(v as OrdenSuplidores)}>
              <SelectTrigger className="w-[220px]">
                <ArrowUpDown className="size-4 text-gray-400" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(ORDEN_LABELS) as OrdenSuplidores[]).map(k => (
                  <SelectItem key={k} value={k}>{ORDEN_LABELS[k]}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="inline-flex rounded-lg border p-0.5">
              <button
                type="button"
                onClick={() => setVista('grid')}
                className={cn('rounded-md p-1.5', vista === 'grid' ? 'bg-gray-900 text-white' : 'text-gray-500 hover:bg-gray-100')}
                aria-label="Vista de tarjetas"
              >
                <LayoutGrid className="size-4" />
              </button>
              <button
                type="button"
                onClick={() => setVista('lista')}
                className={cn('rounded-md p-1.5', vista === 'lista' ? 'bg-gray-900 text-white' : 'text-gray-500 hover:bg-gray-100')}
                aria-label="Vista de lista"
              >
                <List className="size-4" />
              </button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Resultados */}
      {suplidoresVisibles.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-16 text-center">
            <Users className="size-10 text-gray-300" />
            <p className="font-medium text-gray-700">No se encontraron suplidores</p>
            <p className="text-sm text-gray-500">Prueba con otra búsqueda o cambia el filtro.</p>
          </CardContent>
        </Card>
      ) : vista === 'grid' ? (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
          {suplidoresVisibles.map((suplidor) => {
            const st = statsDe(suplidor.id);
            const pagadoPct = st.facturado > 0 ? Math.round(((st.facturado - st.deuda) / st.facturado) * 100) : 100;

            return (
              <Card key={suplidor.id} className="group gap-0 overflow-hidden py-0 transition-all hover:-translate-y-0.5 hover:shadow-lg">
                <div className="flex items-start gap-3 p-5 pb-4">
                  <Avatar nombre={suplidor.nombre} />
                  <div className="min-w-0 flex-1">
                    {suplidor.codigo && (
                      <span className="mb-1 inline-block rounded bg-blue-50 px-1.5 py-0.5 font-mono text-[11px] text-blue-700">
                        {suplidor.codigo}
                      </span>
                    )}
                    <h3 className="truncate font-semibold text-gray-900" title={suplidor.nombre}>{suplidor.nombre}</h3>
                    <p className="text-xs text-gray-500">RNC: {suplidor.ruc || '—'}</p>
                  </div>
                  {menuAcciones(suplidor)}
                </div>

                <div className="space-y-1.5 px-5 text-sm text-gray-600">
                  <p className="flex items-center gap-2"><Phone className="size-3.5 text-gray-400" /> {suplidor.telefono || <span className="text-gray-400">Sin teléfono</span>}</p>
                  <p className="flex items-center gap-2 truncate"><Mail className="size-3.5 shrink-0 text-gray-400" /> <span className="truncate">{suplidor.email || <span className="text-gray-400">Sin email</span>}</span></p>
                  <p className="flex items-start gap-2"><MapPin className="mt-0.5 size-3.5 shrink-0 text-gray-400" /> <span className="line-clamp-1">{suplidor.direccion || <span className="text-gray-400">Sin dirección</span>}</span></p>
                </div>

                <div className="mt-4 border-t bg-gray-50/60 p-5 pt-4">
                  <div className="flex items-end justify-between">
                    <div>
                      <p className="text-xs text-gray-500">Balance pendiente</p>
                      <p className={cn('text-lg font-semibold', st.deuda > 0 ? 'text-red-600' : 'text-emerald-600')}>
                        {formatCurrency(st.deuda)}
                      </p>
                    </div>
                    <div className="flex flex-wrap justify-end gap-1">
                      {st.vencidas > 0 && (
                        <Badge className="border-red-200 bg-red-50 text-red-700">
                          <AlertTriangle className="size-3" /> {st.vencidas} vencida{st.vencidas > 1 ? 's' : ''}
                        </Badge>
                      )}
                      {st.deuda === 0 && st.total > 0 && (
                        <Badge className="border-emerald-200 bg-emerald-50 text-emerald-700">
                          <CheckCircle2 className="size-3" /> Al día
                        </Badge>
                      )}
                    </div>
                  </div>

                  {st.facturado > 0 && (
                    <div className="mt-2">
                      <div className="h-1.5 overflow-hidden rounded-full bg-gray-200">
                        <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${pagadoPct}%` }} />
                      </div>
                      <p className="mt-1 text-[11px] text-gray-500">{pagadoPct}% pagado de {formatCurrency(st.facturado)}</p>
                    </div>
                  )}

                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <Button variant="outline" size="sm" onClick={() => abrirPanel(suplidor)}>
                      <FileText className="size-4 mr-1.5" />
                      Facturas ({st.total})
                    </Button>
                    <Button
                      size="sm"
                      disabled={st.abiertas === 0}
                      onClick={() => abrirPanel(suplidor)}
                    >
                      <CreditCard className="size-4 mr-1.5" />
                      Pagar
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card className="gap-0 overflow-hidden py-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-4 py-3">
                    <button type="button" onClick={() => toggleOrdenColumna('nombre')} className="flex items-center gap-1 uppercase hover:text-gray-900">
                      Suplidor {iconoOrden('nombre')}
                    </button>
                  </th>
                  <th className="px-4 py-3">Contacto</th>
                  <th className="px-4 py-3">
                    <button type="button" onClick={() => toggleOrdenColumna('facturas')} className="flex items-center gap-1 uppercase hover:text-gray-900">
                      Facturas {iconoOrden('facturas')}
                    </button>
                  </th>
                  <th className="px-4 py-3 text-right">
                    <button type="button" onClick={() => toggleOrdenColumna('deuda')} className="ml-auto flex items-center gap-1 uppercase hover:text-gray-900">
                      Balance {iconoOrden('deuda')}
                    </button>
                  </th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {suplidoresVisibles.map(suplidor => {
                  const st = statsDe(suplidor.id);
                  return (
                    <tr
                      key={suplidor.id}
                      onClick={() => abrirPanel(suplidor)}
                      className="cursor-pointer border-t transition-colors hover:bg-gray-50"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <Avatar nombre={suplidor.nombre} />
                          <div className="min-w-0">
                            <p className="truncate font-medium text-gray-900">{suplidor.nombre}</p>
                            <p className="text-xs text-gray-500">
                              {suplidor.codigo && <span className="font-mono text-blue-700">{suplidor.codigo}</span>}
                              {suplidor.codigo && ' · '}RNC {suplidor.ruc || '—'}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        <p>{suplidor.telefono || '—'}</p>
                        <p className="max-w-[220px] truncate text-xs text-gray-500">{suplidor.email}</p>
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-medium text-gray-900">{st.total}</span>
                        {st.abiertas > 0 && <span className="ml-1 text-xs text-gray-500">({st.abiertas} abiertas)</span>}
                        {st.vencidas > 0 && (
                          <Badge className="ml-2 border-red-200 bg-red-50 text-red-700">{st.vencidas} vencida{st.vencidas > 1 ? 's' : ''}</Badge>
                        )}
                      </td>
                      <td className={cn('px-4 py-3 text-right font-semibold', st.deuda > 0 ? 'text-red-600' : 'text-emerald-600')}>
                        {formatCurrency(st.deuda)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <ChevronRight className="size-4 text-gray-300" />
                          {menuAcciones(suplidor)}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* ── Panel lateral: facturas y pagos del suplidor ── */}
      <Sheet open={suplidorPanel !== null} onOpenChange={(open) => { if (!open) setSuplidorPanelId(null); }}>
        <SheetContent className="w-full gap-0 overflow-y-auto p-0 sm:max-w-2xl">
          {suplidorPanel && (
            <>
              <SheetHeader className="border-b bg-gradient-to-b from-gray-50 to-white p-6">
                <div className="flex items-center gap-4">
                  <Avatar nombre={suplidorPanel.nombre} size="lg" />
                  <div className="min-w-0">
                    <SheetTitle className="truncate text-xl">{suplidorPanel.nombre}</SheetTitle>
                    <SheetDescription>
                      {suplidorPanel.codigo && <span className="font-mono">{suplidorPanel.codigo} · </span>}
                      RNC {suplidorPanel.ruc || '—'}
                    </SheetDescription>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2 text-xs text-gray-600">
                  {suplidorPanel.telefono && (
                    <a href={`tel:${suplidorPanel.telefono}`} className="flex items-center gap-1 rounded-full border bg-white px-2.5 py-1 hover:bg-gray-50">
                      <Phone className="size-3" /> {suplidorPanel.telefono}
                    </a>
                  )}
                  {suplidorPanel.email && (
                    <a href={`mailto:${suplidorPanel.email}`} className="flex items-center gap-1 rounded-full border bg-white px-2.5 py-1 hover:bg-gray-50">
                      <Mail className="size-3" /> {suplidorPanel.email}
                    </a>
                  )}
                </div>

                {/* Resumen financiero */}
                <div className="mt-5 grid grid-cols-3 gap-3">
                  <div className="rounded-xl border bg-white p-3">
                    <p className="text-[11px] font-medium uppercase text-gray-500">Facturado</p>
                    <p className="mt-0.5 truncate font-semibold text-gray-900">{formatCurrency(resumenPanel.facturado)}</p>
                  </div>
                  <div className="rounded-xl border bg-white p-3">
                    <p className="text-[11px] font-medium uppercase text-gray-500">Pagado</p>
                    <p className="mt-0.5 truncate font-semibold text-emerald-600">{formatCurrency(resumenPanel.pagado)}</p>
                  </div>
                  <div className="rounded-xl border bg-white p-3">
                    <p className="text-[11px] font-medium uppercase text-gray-500">Pendiente</p>
                    <p className={cn('mt-0.5 truncate font-semibold', resumenPanel.pendiente > 0 ? 'text-red-600' : 'text-emerald-600')}>
                      {formatCurrency(resumenPanel.pendiente)}
                    </p>
                  </div>
                </div>
                {resumenPanel.facturado > 0 && (
                  <div className="mt-3">
                    <div className="h-2 overflow-hidden rounded-full bg-gray-200">
                      <div className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-emerald-600" style={{ width: `${resumenPanel.porcentaje}%` }} />
                    </div>
                    <p className="mt-1 text-xs text-gray-500">{resumenPanel.porcentaje}% de lo facturado ya está pagado</p>
                  </div>
                )}

                {proximaAPagar && (
                  <div className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-blue-200 bg-blue-50 p-3">
                    <div className="flex min-w-0 items-center gap-2 text-sm">
                      <CalendarClock className="size-4 shrink-0 text-blue-600" />
                      <span className="truncate text-blue-900">
                        Próxima: <b>{proximaAPagar.numeroFactura}</b> · vence {formatDate(proximaAPagar.fechaVencimiento)} · {formatCurrency(proximaAPagar.balancePendiente)}
                      </span>
                    </div>
                    <Button size="sm" onClick={() => setFacturaAPagar(proximaAPagar.id)}>
                      Pagar
                    </Button>
                  </div>
                )}
              </SheetHeader>

              {/* Pestañas */}
              <div className="sticky top-0 z-10 border-b bg-white px-6">
                <div className="flex gap-6">
                  {([
                    ['facturas', 'Facturas', facturasPanel.length],
                    ['pagos', 'Pagos', pagosPanel.length]
                  ] as const).map(([key, label, count]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setTabPanel(key)}
                      className={cn(
                        '-mb-px border-b-2 py-3 text-sm font-medium transition-colors',
                        tabPanel === key ? 'border-gray-900 text-gray-900' : 'border-transparent text-gray-500 hover:text-gray-800'
                      )}
                    >
                      {label} <span className="ml-1 rounded-full bg-gray-100 px-1.5 text-xs text-gray-600">{count}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="p-6">
                {tabPanel === 'facturas' ? (
                  <>
                    <div className="mb-4 flex flex-col gap-3">
                      <Segmented
                        value={filtroFacturas}
                        onChange={setFiltroFacturas}
                        options={[
                          { value: 'pendientes', label: 'Por pagar', count: resumenPanel.cuenta.pendientes },
                          { value: 'pagadas', label: 'Pagadas', count: resumenPanel.cuenta.pagadas },
                          { value: 'anuladas', label: 'Anuladas', count: resumenPanel.cuenta.anuladas },
                          { value: 'todas', label: 'Todas', count: resumenPanel.cuenta.todas }
                        ]}
                      />
                      <div className="flex gap-2">
                        <div className="relative flex-1">
                          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gray-400" />
                          <Input
                            value={busquedaFactura}
                            onChange={(e) => setBusquedaFactura(e.target.value)}
                            placeholder="Buscar No. de factura…"
                            className="pl-9"
                          />
                        </div>
                        <Select value={ordenFacturas} onValueChange={(v) => setOrdenFacturas(v as OrdenFacturas)}>
                          <SelectTrigger className="w-[190px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="vencimiento">Vence primero</SelectItem>
                            <SelectItem value="recientes">Más recientes</SelectItem>
                            <SelectItem value="balance">Mayor balance</SelectItem>
                            <SelectItem value="numero">No. de factura</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {facturasPanelVisibles.length === 0 ? (
                      <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed py-12 text-center">
                        <FileText className="size-8 text-gray-300" />
                        <p className="text-sm text-gray-500">
                          {facturasPanel.length === 0 ? 'Este suplidor no tiene facturas registradas.' : 'No hay facturas en esta vista.'}
                        </p>
                      </div>
                    ) : (
                      <ul className="space-y-2.5">
                        {facturasPanelVisibles.map(f => {
                          const vencida = estaVencida(f);
                          const dias = diasEntre(new Date(f.fechaVencimiento), hoy());
                          const pct = f.montoTotal > 0 ? Math.round(((f.montoTotal - f.balancePendiente) / f.montoTotal) * 100) : 0;
                          return (
                            <li
                              key={f.id}
                              className={cn(
                                'rounded-xl border bg-white p-4 transition-shadow hover:shadow-md',
                                vencida && 'border-red-200 bg-red-50/30',
                                f.estado === 'Anulada' && 'opacity-60'
                              )}
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <p className="font-semibold text-gray-900">{f.numeroFactura}</p>
                                    <Badge className={ESTADO_STYLES[f.estado]}>{f.estado}</Badge>
                                    {vencida && (
                                      <Badge className="border-red-200 bg-red-100 text-red-700">
                                        Vencida hace {Math.abs(dias)} día{Math.abs(dias) !== 1 ? 's' : ''}
                                      </Badge>
                                    )}
                                    {!vencida && estaAbierta(f) && dias <= 7 && (
                                      <Badge className="border-amber-200 bg-amber-50 text-amber-700">
                                        {dias === 0 ? 'Vence hoy' : `Vence en ${dias} día${dias !== 1 ? 's' : ''}`}
                                      </Badge>
                                    )}
                                  </div>
                                  <p className="mt-1 text-xs text-gray-500">
                                    {f.numeroExterno && <>Ext: {f.numeroExterno} · </>}
                                    Emitida {formatDate(f.fechaEmision)} · Vence {formatDate(f.fechaVencimiento)}
                                  </p>
                                </div>
                                <div className="shrink-0 text-right">
                                  <p className="text-xs text-gray-500">Balance</p>
                                  <p className={cn('font-semibold', f.balancePendiente > 0 && estaAbierta(f) ? 'text-gray-900' : 'text-gray-400')}>
                                    {formatCurrency(estaAbierta(f) ? f.balancePendiente : 0)}
                                  </p>
                                  <p className="text-[11px] text-gray-400">de {formatCurrency(f.montoTotal)}</p>
                                </div>
                              </div>

                              {f.estado !== 'Anulada' && (
                                <div className="mt-3 flex items-center gap-3">
                                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-gray-100">
                                    <div
                                      className={cn('h-full rounded-full', pct >= 100 ? 'bg-emerald-500' : 'bg-blue-500')}
                                      style={{ width: `${Math.min(pct, 100)}%` }}
                                    />
                                  </div>
                                  {estaAbierta(f) ? (
                                    <Button size="sm" className="h-8" onClick={() => setFacturaAPagar(f.id)}>
                                      <CreditCard className="size-3.5 mr-1.5" /> Pagar
                                    </Button>
                                  ) : (
                                    <span className="flex items-center gap-1 text-xs font-medium text-emerald-600">
                                      <CheckCircle2 className="size-3.5" /> Saldada
                                    </span>
                                  )}
                                </div>
                              )}
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </>
                ) : pagosPanel.length === 0 ? (
                  <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed py-12 text-center">
                    <Receipt className="size-8 text-gray-300" />
                    <p className="text-sm text-gray-500">Todavía no hay pagos registrados a este suplidor.</p>
                  </div>
                ) : (
                  <ol className="relative space-y-4 border-l border-gray-200 pl-6">
                    {pagosPanel.map(p => (
                      <li key={p.id} className="relative">
                        <span className="absolute -left-[31px] top-1 flex size-4 items-center justify-center rounded-full bg-emerald-500 ring-4 ring-white" />
                        <div className="flex items-start justify-between gap-3 rounded-xl border bg-white p-3">
                          <div className="min-w-0">
                            <p className="font-medium text-gray-900">Factura {p.numeroFactura}</p>
                            <p className="text-xs text-gray-500">
                              {formatDate(p.fecha)} · {p.metodoPago}{p.referencia ? ` · ${p.referencia}` : ''}
                            </p>
                            {p.notas && <p className="mt-1 text-xs italic text-gray-500">{p.notas}</p>}
                          </div>
                          <p className="shrink-0 font-semibold text-emerald-600">{formatCurrency(p.monto)}</p>
                        </div>
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* Registrar pago (mismo diálogo que Cuentas por Pagar) */}
      <PagoDialog
        facturaId={facturaAPagar}
        open={facturaAPagar !== null}
        onOpenChange={(open) => { if (!open) setFacturaAPagar(null); }}
      />

      {/* Dialog para agregar/editar suplidor */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) setErrorNombre(''); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editando ? 'Editar Suplidor' : 'Nuevo Suplidor'}</DialogTitle>
            <DialogDescription>Complete la información del suplidor</DialogDescription>
          </DialogHeader>

          {errorOperacion ? (
            <Alert variant="destructive">
              <AlertTitle>Error al guardar</AlertTitle>
              <AlertDescription>{errorOperacion}</AlertDescription>
            </Alert>
          ) : null}

          <div className="space-y-4">
            <div>
              <Label htmlFor="codigo">Código</Label>
              <Input
                id="codigo"
                value={suplidorActual.codigo}
                readOnly
                className="bg-gray-50 text-gray-500 cursor-not-allowed font-mono"
                tabIndex={-1}
              />
            </div>

            <div>
              <Label htmlFor="nombre">
                Nombre <span className="text-red-500">*</span>
              </Label>
              <Input
                id="nombre"
                value={suplidorActual.nombre}
                onChange={(e) => {
                  setSuplidorActual({ ...suplidorActual, nombre: e.target.value });
                  if (e.target.value.trim()) setErrorNombre('');
                }}
                placeholder="Distribuidora Central"
                className={errorNombre ? 'border-red-500 focus-visible:ring-red-500' : ''}
              />
              {errorNombre && <p className="text-xs text-red-500 mt-1">{errorNombre}</p>}
            </div>

            <div>
              <Label htmlFor="ruc">RNC / Cédula</Label>
              <Input
                id="ruc"
                value={suplidorActual.ruc}
                onChange={(e) => setSuplidorActual({ ...suplidorActual, ruc: e.target.value })}
                placeholder="131-45678-9"
                className={errorOperacion ? 'border-red-500 focus-visible:ring-red-500' : ''}
              />
            </div>

            <div>
              <Label htmlFor="telefono">Teléfono</Label>
              <Input
                id="telefono"
                value={suplidorActual.telefono}
                onChange={(e) => setSuplidorActual({ ...suplidorActual, telefono: e.target.value })}
                placeholder="809-555-0000"
              />
            </div>

            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={suplidorActual.email}
                onChange={(e) => setSuplidorActual({ ...suplidorActual, email: e.target.value })}
                placeholder="contacto@suplidor.com"
              />
            </div>

            <div>
              <Label htmlFor="direccion">Dirección</Label>
              <Input
                id="direccion"
                value={suplidorActual.direccion}
                onChange={(e) => setSuplidorActual({ ...suplidorActual, direccion: e.target.value })}
                placeholder="Calle Principal #123, Ciudad"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleGuardar} disabled={guardando}>
              {guardando ? 'Guardando...' : editando ? 'Actualizar' : 'Guardar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog eliminar */}
      <Dialog
        open={dialogEliminarOpen}
        onOpenChange={(open) => {
          setDialogEliminarOpen(open);
          if (!open) {
            setSuplidorAEliminar(null);
            setFacturasAsociadas(0);
          }
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Confirmar Eliminación de Suplidor</DialogTitle>
            <DialogDescription>
              ¿Está seguro de que desea eliminar al suplidor {suplidorAEliminar?.nombre || ''}? Esta acción no se puede deshacer.
            </DialogDescription>
          </DialogHeader>

          {validandoEliminacion ? (
            <p className="text-sm text-gray-600">Validando facturas asociadas en la base de datos...</p>
          ) : facturasAsociadas > 0 ? (
            <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              No es posible eliminar este suplidor porque tiene facturas registradas. Considere anular al suplidor en su lugar.
            </div>
          ) : (
            <p className="text-sm text-gray-600">No se encontraron facturas asociadas. Puede proceder con la eliminación.</p>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogEliminarOpen(false)}>Cancelar</Button>
            <Button
              variant="destructive"
              onClick={confirmarEliminar}
              disabled={validandoEliminacion || facturasAsociadas > 0}
            >
              Eliminar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
