import { useMemo, useState } from 'react';
import { Factura, useData } from '../context/DataContext';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import {
  Plus, Search, MoreVertical, DollarSign, Eye, Trash2, Edit, FileText, History, X, Users, ArrowUpDown,
  ArrowUp, ArrowDown, Wallet, AlertTriangle, CalendarClock, CheckCircle2, CreditCard, ChevronLeft, ChevronRight, Download
} from 'lucide-react';
import {
  Avatar, Kpi, Segmented, VencimientoChip, ESTADO_STYLES, estaAbierta, estaVencida, diasHasta,
  formatDateShort, normalizar
} from '../components/finance-ui';
import { cn } from '../components/ui/utils';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '../components/ui/dropdown-menu';
import { PagoDialog } from '../components/PagoDialog';
import { useAuth } from '../context/AuthContext';

type FiltroEstado = 'todas' | 'abiertas' | 'vencidas' | 'pronto' | 'parciales' | 'pagadas';
type OrdenKey = 'prioridad' | 'id' | 'suplidor' | 'emision' | 'vencimiento' | 'monto' | 'balance';
type OrdenDir = 'asc' | 'desc';

const ORDEN_LABELS: Record<OrdenKey, string> = {
  prioridad: 'Prioridad (urgentes primero)',
  vencimiento: 'Fecha de vencimiento',
  emision: 'Fecha de emisión',
  balance: 'Balance pendiente',
  monto: 'Monto total',
  suplidor: 'Suplidor (A → Z)',
  id: 'ID interno'
};

const ORDEN_DIR_DEFAULT: Record<OrdenKey, OrdenDir> = {
  prioridad: 'asc',
  vencimiento: 'asc',
  emision: 'desc',
  balance: 'desc',
  monto: 'desc',
  suplidor: 'asc',
  id: 'asc'
};

// Helper para mensajes de error inline
const FieldError = ({ msg }: { msg?: string }) =>
  msg ? <p className="text-xs text-red-500 mt-1">{msg}</p> : null;

export function CuentasPorPagar() {
  const { facturas, suplidores, pagos, agregarFactura, editarFactura, eliminarFactura } = useData();
  const { perfil } = useAuth();

  const parseInputDate = (value: string) => {
    const [year, month, day] = value.split('-').map(Number);
    return new Date(year, month - 1, day);
  };

  const toInputDateValue = (value: Date) => {
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, '0');
    const day = String(value.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const [busqueda, setBusqueda] = useState('');
  const [filtroEstado, setFiltroEstado] = useState<FiltroEstado>('todas');
  const [filtroSuplidor, setFiltroSuplidor] = useState<string>('todos');
  const [orden, setOrden] = useState<{ key: OrdenKey; dir: OrdenDir }>({ key: 'prioridad', dir: 'asc' });
  const [pagina, setPagina] = useState(1);
  const [porPagina, setPorPagina] = useState(25);

  const [dialogNuevaFactura, setDialogNuevaFactura] = useState(false);
  const [dialogEditarFactura, setDialogEditarFactura] = useState(false);
  const [dialogDetalle, setDialogDetalle] = useState(false);
  const [dialogHistorial, setDialogHistorial] = useState(false);
  const [dialogAnularFactura, setDialogAnularFactura] = useState(false);
  const [menuAccionesAbierto, setMenuAccionesAbierto] = useState<string | null>(null);

  const [facturaSeleccionada, setFacturaSeleccionada] = useState('');
  const [facturaAAnular, setFacturaAAnular] = useState('');

  // ── PagoDialog unificado ──────────────────────────────────────────────────
  const [facturaIdPago, setFacturaIdPago] = useState<string | null>(null);

  // ── Estados de validación para ambos formularios ──────────────────────────
  const [erroresNueva, setErroresNueva] = useState<Record<string, string>>({});
  const [erroresEditar, setErroresEditar] = useState<Record<string, string>>({});

  const [nuevaFactura, setNuevaFactura] = useState({
    numeroFactura: '',
    numeroExterno: '',
    suplidorId: '',
    fechaEmision: '',
    fechaVencimiento: '',
    montoTotal: ''
  });

  const [facturaEditando, setFacturaEditando] = useState({
    id: '',
    numeroFactura: '',
    numeroExterno: '',
    suplidorId: '',
    fechaEmision: '',
    fechaVencimiento: '',
    montoTotal: ''
  });

  const hoy = new Date();

  // ── Genera el siguiente ID interno FACT-XX ────────────────────────────────
  const generarNumeroInterno = (): string => {
    const numeros = facturas.map(f => {
      const match = f.numeroFactura?.match(/^FACT-(\d+)$/);
      return match ? parseInt(match[1], 10) : 0;
    });
    const siguiente = numeros.length > 0 ? Math.max(...numeros) + 1 : 1;
    return `FACT-${String(siguiente).padStart(2, '0')}`;
  };

  // ── Validador compartido para creación y edición ──────────────────────────
  const validarFactura = (datos: {
    suplidorId: string;
    fechaEmision: string;
    fechaVencimiento: string;
    montoTotal: string;
  }): Record<string, string> => {
    const err: Record<string, string> = {};

    if (!datos.suplidorId)
      err.suplidorId = 'Debe seleccionar un suplidor.';

    if (!datos.fechaEmision)
      err.fechaEmision = 'La fecha de emisión es obligatoria.';

    if (!datos.fechaVencimiento) {
      err.fechaVencimiento = 'La fecha de vencimiento es obligatoria.';
    } else if (datos.fechaEmision && datos.fechaVencimiento < datos.fechaEmision) {
      err.fechaVencimiento = 'La fecha de vencimiento no puede ser anterior a la de emisión.';
    }

    if (!datos.montoTotal) {
      err.montoTotal = 'El monto es obligatorio.';
    } else if (isNaN(parseFloat(datos.montoTotal)) || parseFloat(datos.montoTotal) <= 0) {
      err.montoTotal = 'El monto debe ser un número mayor a cero.';
    }

    return err;
  };

  const cerrarMenuAcciones = () => setMenuAccionesAbierto(null);

  const ejecutarDespuesDeCerrarMenu = (accion: () => void) => {
    cerrarMenuAcciones();
    window.setTimeout(accion, 0);
  };

  // ── Filtrado, conteos y orden ─────────────────────────────────────────────
  const activas = useMemo(() => facturas.filter(f => f.estado !== 'Anulada'), [facturas]);

  const cumpleEstado = (f: Factura, filtro: FiltroEstado) => {
    switch (filtro) {
      case 'abiertas': return estaAbierta(f);
      case 'vencidas': return estaVencida(f);
      case 'pronto': {
        const dias = diasHasta(f.fechaVencimiento);
        return estaAbierta(f) && dias >= 0 && dias <= 7;
      }
      case 'parciales': return f.estado === 'Parcial';
      case 'pagadas': return f.estado === 'Pagado';
      default: return true;
    }
  };

  // Facturas que cumplen búsqueda + suplidor (sin el filtro de estado), para los contadores
  const baseFiltrada = useMemo(() => {
    const q = normalizar(busqueda.trim());
    return activas.filter(f => {
      if (filtroSuplidor !== 'todos' && f.suplidorId !== filtroSuplidor) return false;
      if (!q) return true;
      return normalizar(`${f.numeroFactura} ${f.numeroExterno ?? ''} ${f.suplidorNombre}`).includes(q);
    });
  }, [activas, busqueda, filtroSuplidor]);

  const conteos = useMemo(() => {
    const c: Record<FiltroEstado, number> = { todas: 0, abiertas: 0, vencidas: 0, pronto: 0, parciales: 0, pagadas: 0 };
    for (const f of baseFiltrada) {
      (Object.keys(c) as FiltroEstado[]).forEach(k => { if (cumpleEstado(f, k)) c[k]++; });
    }
    return c;
  }, [baseFiltrada]);

  const facturasFiltradas = useMemo(() => {
    const lista = baseFiltrada.filter(f => cumpleEstado(f, filtroEstado));
    const signo = orden.dir === 'asc' ? 1 : -1;
    const t = (d: Date) => new Date(d).getTime();
    const prioridad = (f: Factura) => (f.estado === 'Pagado' ? 2 : estaVencida(f) ? 0 : 1);

    return lista.sort((a, b) => {
      let diff = 0;
      switch (orden.key) {
        case 'id': diff = a.numeroFactura.localeCompare(b.numeroFactura, 'es', { numeric: true }); break;
        case 'suplidor': diff = a.suplidorNombre.localeCompare(b.suplidorNombre, 'es', { sensitivity: 'base' }); break;
        case 'emision': diff = t(a.fechaEmision) - t(b.fechaEmision); break;
        case 'vencimiento': diff = t(a.fechaVencimiento) - t(b.fechaVencimiento); break;
        case 'monto': diff = a.montoTotal - b.montoTotal; break;
        case 'balance': diff = a.balancePendiente - b.balancePendiente; break;
        default:
          // Vencidas primero, luego pendientes, pagadas al final; dentro de cada grupo la más próxima a vencer
          diff = prioridad(a) - prioridad(b) || t(a.fechaVencimiento) - t(b.fechaVencimiento);
      }
      return diff * signo;
    });
  }, [baseFiltrada, filtroEstado, orden]);

  const totalPaginas = Math.max(1, Math.ceil(facturasFiltradas.length / porPagina));
  const paginaActual = Math.min(pagina, totalPaginas);
  const facturasPagina = facturasFiltradas.slice((paginaActual - 1) * porPagina, paginaActual * porPagina);

  const totales = useMemo(() => ({
    monto: facturasFiltradas.reduce((s, f) => s + f.montoTotal, 0),
    balance: facturasFiltradas.reduce((s, f) => s + (estaAbierta(f) ? f.balancePendiente : 0), 0)
  }), [facturasFiltradas]);

  const kpis = useMemo(() => {
    const suma = (lista: Factura[]) => ({ count: lista.length, monto: lista.reduce((s, f) => s + f.balancePendiente, 0) });
    const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
    const pagosMes = pagos.filter(p => new Date(p.fecha) >= inicioMes);
    return {
      porPagar: suma(activas.filter(estaAbierta)),
      vencidas: suma(activas.filter(estaVencida)),
      pronto: suma(activas.filter(f => cumpleEstado(f, 'pronto'))),
      pagadoMes: { count: pagosMes.length, monto: pagosMes.reduce((s, p) => s + p.monto, 0) }
    };
  }, [activas, pagos]);

  const cambiarFiltro = (f: FiltroEstado) => {
    // Pulsar el filtro activo otra vez vuelve a "Todas"
    setFiltroEstado(prev => (prev === f && f !== 'todas' ? 'todas' : f));
    setPagina(1);
  };

  const ordenarPor = (key: OrdenKey) => {
    setOrden(prev => prev.key === key
      ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
      : { key, dir: ORDEN_DIR_DEFAULT[key] });
  };

  const hayFiltros = busqueda !== '' || filtroEstado !== 'todas' || filtroSuplidor !== 'todos';
  const limpiarFiltros = () => {
    setBusqueda('');
    setFiltroEstado('todas');
    setFiltroSuplidor('todos');
    setPagina(1);
  };

  // ── Exportar el listado filtrado a CSV (se abre en Excel) ─────────────────
  const exportarCSV = () => {
    const esc = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
    const filas = [
      ['ID Interno', 'Ref. Proveedor', 'Suplidor', 'Emisión', 'Vencimiento', 'Monto Total', 'Balance Pendiente', 'Estado'],
      ...facturasFiltradas.map(f => [
        f.numeroFactura,
        f.numeroExterno ?? '',
        f.suplidorNombre,
        toInputDateValue(new Date(f.fechaEmision)),
        toInputDateValue(new Date(f.fechaVencimiento)),
        f.montoTotal.toFixed(2),
        f.balancePendiente.toFixed(2),
        f.estado
      ])
    ];
    const csv = '﻿' + filas.map(r => r.map(esc).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `cuentas-por-pagar-${toInputDateValue(new Date())}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('es-DO', { style: 'currency', currency: 'DOP' }).format(value);

  const formatDate = (date: Date) =>
    new Intl.DateTimeFormat('es-DO', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(date));

  const formatDateTime = (date: Date) =>
    new Intl.DateTimeFormat('es-DO', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).format(new Date(date));

  const nombreEmpresa = perfil?.nombreEmpresa?.trim() || 'Empresa del usuario';

  const isVencida = (fecha: Date) => new Date(fecha) < hoy;
  const totalPagadoDeFactura = (facturaId: string) =>
    pagos
      .filter((p) => p.facturaId === facturaId)
      .reduce((sum, p) => sum + p.monto, 0);

  // ─── Nueva Factura ────────────────────────────────────────────────────────
  const abrirDialogNuevaFactura = () => {
    setErroresNueva({});
    setNuevaFactura({
      numeroFactura: generarNumeroInterno(),
      numeroExterno: '',
      suplidorId: '',
      fechaEmision: '',
      fechaVencimiento: '',
      montoTotal: ''
    });
    setDialogNuevaFactura(true);
  };

  const handleNuevaFactura = () => {
    const errores = validarFactura(nuevaFactura);
    if (Object.keys(errores).length > 0) { setErroresNueva(errores); return; }

    const suplidor = suplidores.find(s => s.id === nuevaFactura.suplidorId);
    if (!suplidor) return;

    const monto = parseFloat(nuevaFactura.montoTotal);
    agregarFactura({
      numeroFactura: nuevaFactura.numeroFactura,
      numeroExterno: nuevaFactura.numeroExterno || undefined,
      suplidorId: nuevaFactura.suplidorId,
      suplidorNombre: suplidor.nombre,
      fechaEmision: parseInputDate(nuevaFactura.fechaEmision),
      fechaVencimiento: parseInputDate(nuevaFactura.fechaVencimiento),
      montoTotal: monto,
      balancePendiente: monto,
      estado: 'Pendiente'
    } as any);

    setDialogNuevaFactura(false);
  };

  // ─── Editar Factura ───────────────────────────────────────────────────────
  const abrirDialogEditar = (facturaId: string) => {
    const factura = facturas.find(f => f.id === facturaId);
    if (!factura) return;
    setErroresEditar({});
    setFacturaEditando({
      id: factura.id,
      numeroFactura: factura.numeroFactura,
      numeroExterno: (factura as any).numeroExterno || '',
      suplidorId: factura.suplidorId,
      fechaEmision: toInputDateValue(new Date(factura.fechaEmision)),
      fechaVencimiento: toInputDateValue(new Date(factura.fechaVencimiento)),
      montoTotal: factura.montoTotal.toString()
    });
    ejecutarDespuesDeCerrarMenu(() => setDialogEditarFactura(true));
  };

  const handleEditarFactura = () => {
    const errores = validarFactura(facturaEditando);
    if (Object.keys(errores).length > 0) { setErroresEditar(errores); return; }

    const suplidor = suplidores.find(s => s.id === facturaEditando.suplidorId);
    if (!suplidor) return;

    editarFactura(facturaEditando.id, {
      numeroFactura: facturaEditando.numeroFactura,
      numeroExterno: facturaEditando.numeroExterno || undefined,
      suplidorId: facturaEditando.suplidorId,
      suplidorNombre: suplidor.nombre,
      fechaEmision: parseInputDate(facturaEditando.fechaEmision),
      fechaVencimiento: parseInputDate(facturaEditando.fechaVencimiento),
      montoTotal: parseFloat(facturaEditando.montoTotal)
    } as any);

    setDialogEditarFactura(false);
  };

  // ─── Historial ────────────────────────────────────────────────────────────
  const abrirHistorial = (facturaId: string) => {
    setFacturaSeleccionada(facturaId);
    ejecutarDespuesDeCerrarMenu(() => setDialogHistorial(true));
  };

  const pagosDeFactura = pagos.filter(p => p.facturaId === facturaSeleccionada);

  // ─── Ver Detalles ─────────────────────────────────────────────────────────
  const abrirDialogDetalle = (facturaId: string) => {
    setFacturaSeleccionada(facturaId);
    ejecutarDespuesDeCerrarMenu(() => setDialogDetalle(true));
  };

  // ─── Exportar PDF ─────────────────────────────────────────────────────────
  const exportarPDF = (facturaId: string) => {
    const factura = facturas.find(f => f.id === facturaId);
    if (!factura) return;
    const pagosFactura = pagos.filter(p => p.facturaId === facturaId);
    const totalPagadoFactura = pagosFactura.reduce((sum, p) => sum + p.monto, 0);
    const numeroExterno = (factura as any).numeroExterno;

    const contenidoHTML = `
      <!DOCTYPE html><html><head><meta charset="utf-8">
      <title>Factura ${factura.numeroFactura}</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 40px; color: #333; }
        .header { display: flex; justify-content: space-between; margin-bottom: 30px; border-bottom: 2px solid #333; padding-bottom: 20px; }
        .titulo { font-size: 24px; font-weight: bold; }
        .subtitulo { color: #666; font-size: 13px; }
        .seccion { margin-bottom: 20px; }
        .seccion h3 { font-size: 14px; color: #555; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 1px; }
        .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
        .campo { margin-bottom: 10px; }
        .campo label { font-size: 11px; color: #888; display: block; }
        .campo p { font-size: 14px; font-weight: 600; margin: 2px 0; }
        .tabla { width: 100%; border-collapse: collapse; margin-top: 10px; }
        .tabla th { background: #f5f5f5; text-align: left; padding: 10px; font-size: 12px; border: 1px solid #ddd; }
        .tabla td { padding: 10px; font-size: 13px; border: 1px solid #ddd; }
        .totales { background: #f9f9f9; padding: 15px; border-radius: 8px; }
        .total-row { display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 14px; }
        .total-final { font-size: 18px; font-weight: bold; color: #c0392b; }
        .estado { display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: bold; }
        .estado-pendiente { background: #fee2e2; color: #991b1b; }
        .estado-parcial { background: #fef3c7; color: #92400e; }
        .estado-pagado { background: #d1fae5; color: #065f46; }
        .footer { margin-top: 40px; text-align: center; font-size: 11px; color: #aaa; border-top: 1px solid #eee; padding-top: 15px; }
      </style></head><body>
        <div class="header">
          <div><div class="titulo">FACTURA POR PAGAR</div><div class="subtitulo">Sistema de Gestión - ${nombreEmpresa}</div></div>
          <div style="text-align:right">
            <div style="font-size:20px; font-weight:bold">${factura.numeroFactura}</div>
            ${numeroExterno ? `<div style="font-size:13px;color:#666">Ref. Proveedor: ${numeroExterno}</div>` : ''}
            <span class="estado estado-${factura.estado.toLowerCase()}">${factura.estado}</span>
          </div>
        </div>
        <div class="seccion"><div class="grid">
          <div class="campo"><label>Suplidor</label><p>${factura.suplidorNombre}</p></div>
          <div class="campo"><label>ID Interno</label><p>${factura.numeroFactura}</p></div>
          ${numeroExterno ? `<div class="campo"><label>No. Factura Proveedor</label><p>${numeroExterno}</p></div>` : ''}
          <div class="campo"><label>Fecha de Emisión</label><p>${formatDate(factura.fechaEmision)}</p></div>
          <div class="campo"><label>Fecha de Vencimiento</label><p>${formatDate(factura.fechaVencimiento)}</p></div>
        </div></div>
        <div class="seccion"><h3>Resumen Financiero</h3>
          <div class="totales">
            <div class="total-row"><span>Monto Total:</span><span>${formatCurrency(factura.montoTotal)}</span></div>
            <div class="total-row" style="color:green"><span>Total Pagado:</span><span>${formatCurrency(totalPagadoFactura)}</span></div>
            <div class="total-row total-final"><span>Balance Pendiente:</span><span>${formatCurrency(factura.balancePendiente)}</span></div>
          </div>
        </div>
        ${pagosFactura.length > 0 ? `
        <div class="seccion"><h3>Historial de Pagos</h3>
          <table class="tabla"><thead><tr><th>Fecha</th><th>Método</th><th>Referencia</th><th>Notas</th><th style="text-align:right">Monto</th></tr></thead>
          <tbody>${pagosFactura.map(p => `<tr>
            <td>${formatDateTime(p.fecha)}</td><td>${p.metodoPago}</td>
            <td>${p.referencia || '—'}</td><td>${p.notas || '-'}</td>
            <td style="text-align:right">${formatCurrency(p.monto)}</td>
          </tr>`).join('')}</tbody></table>
        </div>` : ''}
        <div class="footer">Documento generado el ${formatDate(new Date())} — Sistema de Cuentas por Pagar</div>
      </body></html>`;

    const ventana = window.open('', '_blank');
    if (ventana) { ventana.document.write(contenidoHTML); ventana.document.close(); ventana.print(); }
  };

  // ─── Anulación con verificación de pagos ─────────────────────────────────
  const abrirConfirmacionAnularFactura = (id: string) => {
    cerrarMenuAcciones();
    setFacturaAAnular(id);
    setDialogAnularFactura(true);
  };

  const confirmarAnulacionFactura = async () => {
    if (!facturaAAnular || facturaAnularTienePagos) return;
    await eliminarFactura(facturaAAnular);
    setDialogAnularFactura(false);
    setFacturaAAnular('');
  };

  const facturaDetalle = facturas.find(f => f.id === facturaSeleccionada);
  const facturaParaAnular = facturas.find(f => f.id === facturaAAnular);
  const facturaAnularTienePagos = facturaAAnular
    ? pagos.some(p => p.facturaId === facturaAAnular)
    : false;

  return (
    <div className="space-y-6">
      {/* Encabezado */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">Cuentas por Pagar</h1>
          <p className="mt-1 text-gray-500">Registro detallado de facturas</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportarCSV} disabled={facturasFiltradas.length === 0}>
            <Download className="size-4 mr-2" />
            Exportar
          </Button>
          <Button onClick={abrirDialogNuevaFactura} className="shadow-sm">
            <Plus className="size-4 mr-2" />
            Nueva Factura
          </Button>
        </div>
      </div>

      {/* KPIs (clic = filtrar) */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi
          icon={Wallet}
          label="Total por pagar"
          value={formatCurrency(kpis.porPagar.monto)}
          hint={`${kpis.porPagar.count} factura${kpis.porPagar.count !== 1 ? 's' : ''} abiertas`}
          tone="bg-blue-50 text-blue-600"
          onClick={() => cambiarFiltro('abiertas')}
          active={filtroEstado === 'abiertas'}
        />
        <Kpi
          icon={AlertTriangle}
          label="Vencido"
          value={formatCurrency(kpis.vencidas.monto)}
          hint={`${kpis.vencidas.count} factura${kpis.vencidas.count !== 1 ? 's' : ''} vencida${kpis.vencidas.count !== 1 ? 's' : ''}`}
          tone="bg-red-50 text-red-600"
          onClick={() => cambiarFiltro('vencidas')}
          active={filtroEstado === 'vencidas'}
        />
        <Kpi
          icon={CalendarClock}
          label="Vence en 7 días"
          value={formatCurrency(kpis.pronto.monto)}
          hint={`${kpis.pronto.count} factura${kpis.pronto.count !== 1 ? 's' : ''}`}
          tone="bg-amber-50 text-amber-600"
          onClick={() => cambiarFiltro('pronto')}
          active={filtroEstado === 'pronto'}
        />
        <Kpi
          icon={CheckCircle2}
          label="Pagado este mes"
          value={formatCurrency(kpis.pagadoMes.monto)}
          hint={`${kpis.pagadoMes.count} pago${kpis.pagadoMes.count !== 1 ? 's' : ''}`}
          tone="bg-emerald-50 text-emerald-600"
        />
      </div>

      {/* Barra de herramientas */}
      <Card className="gap-0 py-0">
        <CardContent className="space-y-3 p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gray-400" />
              <Input
                placeholder="Buscar por ID, Ref. Proveedor o Suplidor…"
                value={busqueda}
                onChange={(e) => { setBusqueda(e.target.value); setPagina(1); }}
                className="pl-10 pr-9"
              />
              {busqueda && (
                <button
                  type="button"
                  onClick={() => { setBusqueda(''); setPagina(1); }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                  aria-label="Limpiar búsqueda"
                >
                  <X className="size-4" />
                </button>
              )}
            </div>

            <Select value={filtroSuplidor} onValueChange={(v) => { setFiltroSuplidor(v); setPagina(1); }}>
              <SelectTrigger className="lg:w-[220px]">
                <Users className="size-4 text-gray-400" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos los suplidores</SelectItem>
                {[...suplidores]
                  .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
                  .map(s => <SelectItem key={s.id} value={s.id}>{s.nombre}</SelectItem>)}
              </SelectContent>
            </Select>

            <Select value={orden.key} onValueChange={(v) => setOrden({ key: v as OrdenKey, dir: ORDEN_DIR_DEFAULT[v as OrdenKey] })}>
              <SelectTrigger className="lg:w-[220px]">
                <ArrowUpDown className="size-4 text-gray-400" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(ORDEN_LABELS) as OrdenKey[]).map(k => (
                  <SelectItem key={k} value={k}>{ORDEN_LABELS[k]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <Segmented
              value={filtroEstado}
              onChange={cambiarFiltro}
              options={[
                { value: 'todas', label: 'Todas', count: conteos.todas },
                { value: 'abiertas', label: 'Por pagar', count: conteos.abiertas },
                { value: 'vencidas', label: 'Vencidas', count: conteos.vencidas },
                { value: 'pronto', label: 'Vence pronto', count: conteos.pronto },
                { value: 'parciales', label: 'Parciales', count: conteos.parciales },
                { value: 'pagadas', label: 'Pagadas', count: conteos.pagadas }
              ]}
            />
            {hayFiltros && (
              <button
                type="button"
                onClick={limpiarFiltros}
                className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900"
              >
                <X className="size-3.5" /> Limpiar filtros
              </button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Tabla */}
      <Card className="gap-0 overflow-hidden py-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
              <tr>
                {([
                  ['id', 'Factura', ''],
                  ['suplidor', 'Suplidor', ''],
                  ['emision', 'Emisión', ''],
                  ['vencimiento', 'Vencimiento', ''],
                  ['monto', 'Monto', 'text-right'],
                  ['balance', 'Balance', 'text-right']
                ] as const).map(([key, label, align]) => (
                  <th key={key} className={cn('px-4 py-3 font-medium', align)}>
                    <button
                      type="button"
                      onClick={() => ordenarPor(key)}
                      className={cn('inline-flex items-center gap-1 uppercase hover:text-gray-900', orden.key === key && 'text-gray-900')}
                    >
                      {label}
                      {orden.key === key
                        ? (orden.dir === 'asc' ? <ArrowUp className="size-3.5" /> : <ArrowDown className="size-3.5" />)
                        : <ArrowUpDown className="size-3.5 opacity-40" />}
                    </button>
                  </th>
                ))}
                <th className="px-4 py-3 text-center font-medium">Estado</th>
                <th className="px-4 py-3 text-right font-medium">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {facturasPagina.map((factura) => {
                const vencida = estaVencida(factura);
                const pagadoPct = factura.montoTotal > 0
                  ? Math.min(Math.round(((factura.montoTotal - factura.balancePendiente) / factura.montoTotal) * 100), 100)
                  : 0;
                return (
                  <tr
                    key={factura.id}
                    onClick={() => abrirDialogDetalle(factura.id)}
                    className={cn(
                      'cursor-pointer border-t transition-colors hover:bg-gray-50',
                      vencida && 'bg-red-50/40 hover:bg-red-50'
                    )}
                  >
                    <td className={cn('border-l-2 px-4 py-3', vencida ? 'border-l-red-500' : 'border-l-transparent')}>
                      <p className="font-mono font-medium text-blue-700">{factura.numeroFactura}</p>
                      {factura.numeroExterno && <p className="text-xs text-gray-500">Ref. {factura.numeroExterno}</p>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <Avatar nombre={factura.suplidorNombre} size="sm" />
                        <span className="max-w-[200px] truncate font-medium text-gray-800">{factura.suplidorNombre}</span>
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-gray-600">{formatDateShort(factura.fechaEmision)}</td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <p className={cn(vencida ? 'font-semibold text-red-600' : 'text-gray-700')}>{formatDateShort(factura.fechaVencimiento)}</p>
                      <VencimientoChip factura={factura} />
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right">
                      <p className="text-gray-800">{formatCurrency(factura.montoTotal)}</p>
                      <div className="ml-auto mt-1 h-1 w-20 overflow-hidden rounded-full bg-gray-100" title={`${pagadoPct}% pagado`}>
                        <div className={cn('h-full rounded-full', pagadoPct >= 100 ? 'bg-emerald-500' : 'bg-blue-500')} style={{ width: `${pagadoPct}%` }} />
                      </div>
                    </td>
                    <td className={cn('whitespace-nowrap px-4 py-3 text-right font-semibold', factura.balancePendiente > 0 ? 'text-gray-900' : 'text-gray-400')}>
                      {formatCurrency(factura.balancePendiente)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Badge className={ESTADO_STYLES[factura.estado]}>{factura.estado}</Badge>
                    </td>
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1">
                        {estaAbierta(factura) && (
                          <Button size="sm" className="h-8" onClick={() => setFacturaIdPago(factura.id)}>
                            <CreditCard className="size-3.5 mr-1.5" /> Pagar
                          </Button>
                        )}
                        <DropdownMenu
                          open={menuAccionesAbierto === factura.id}
                          onOpenChange={(open) => setMenuAccionesAbierto(open ? factura.id : null)}
                        >
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="size-8 text-gray-500"><MoreVertical className="size-4" /></Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48">
                            {factura.estado !== 'Pagado' && (
                              <DropdownMenuItem onSelect={() => ejecutarDespuesDeCerrarMenu(() => setFacturaIdPago(factura.id))}>
                                <DollarSign className="size-4 mr-2 text-green-600" />Aplicar Pago
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem onSelect={() => abrirDialogDetalle(factura.id)}>
                              <Eye className="size-4 mr-2 text-blue-600" />Ver Detalles
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            {factura.estado !== 'Pagado' && (
                              <DropdownMenuItem onSelect={() => abrirDialogEditar(factura.id)}>
                                <Edit className="size-4 mr-2 text-orange-500" />Editar Factura
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem onSelect={() => abrirHistorial(factura.id)}>
                              <History className="size-4 mr-2 text-purple-600" />Historial de Pagos
                            </DropdownMenuItem>
                            <DropdownMenuItem onSelect={() => { cerrarMenuAcciones(); exportarPDF(factura.id); }}>
                              <FileText className="size-4 mr-2 text-gray-600" />Exportar PDF
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onSelect={() => abrirConfirmacionAnularFactura(factura.id)} className="text-red-600">
                              <Trash2 className="size-4 mr-2" />Anular Factura
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            {facturasFiltradas.length > 0 && (
              <tfoot className="border-t bg-gray-50 text-sm">
                <tr>
                  <td colSpan={4} className="px-4 py-3 font-medium text-gray-600">
                    Total ({facturasFiltradas.length} factura{facturasFiltradas.length !== 1 ? 's' : ''})
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right font-semibold text-gray-900">{formatCurrency(totales.monto)}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-right font-semibold text-red-600">{formatCurrency(totales.balance)}</td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            )}
          </table>

          {facturasFiltradas.length === 0 && (
            <div className="flex flex-col items-center gap-2 py-16 text-center">
              <FileText className="size-10 text-gray-300" />
              <p className="font-medium text-gray-700">No se encontraron facturas</p>
              <p className="text-sm text-gray-500">
                {hayFiltros ? 'Prueba con otra búsqueda o limpia los filtros.' : 'Registra tu primera factura con "Nueva Factura".'}
              </p>
            </div>
          )}
        </div>

        {/* Paginación */}
        {facturasFiltradas.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t px-4 py-3 text-sm text-gray-600">
            <div className="flex items-center gap-2">
              <span>Filas por página</span>
              <Select value={String(porPagina)} onValueChange={(v) => { setPorPagina(Number(v)); setPagina(1); }}>
                <SelectTrigger className="h-8 w-[76px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[10, 25, 50, 100].map(n => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-3">
              <span>
                {(paginaActual - 1) * porPagina + 1}–{Math.min(paginaActual * porPagina, facturasFiltradas.length)} de {facturasFiltradas.length}
              </span>
              <div className="flex gap-1">
                <Button variant="outline" size="icon" className="size-8" disabled={paginaActual <= 1} onClick={() => setPagina(paginaActual - 1)} aria-label="Página anterior">
                  <ChevronLeft className="size-4" />
                </Button>
                <Button variant="outline" size="icon" className="size-8" disabled={paginaActual >= totalPaginas} onClick={() => setPagina(paginaActual + 1)} aria-label="Página siguiente">
                  <ChevronRight className="size-4" />
                </Button>
              </div>
            </div>
          </div>
        )}
      </Card>

      {/* ── Dialog: Nueva Factura ── */}
      <Dialog open={dialogNuevaFactura} onOpenChange={(open) => { setDialogNuevaFactura(open); if (!open) setErroresNueva({}); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nueva Factura</DialogTitle>
            <DialogDescription>Registre una nueva factura por pagar</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>ID Interno</Label>
              <Input
                value={nuevaFactura.numeroFactura}
                readOnly
                tabIndex={-1}
                className="bg-gray-50 text-blue-700 cursor-not-allowed font-mono"
              />
            </div>
            <div>
              <Label>
                No. Factura Proveedor{' '}
                <span className="text-gray-400 text-xs font-normal">(opcional)</span>
              </Label>
              <Input
                value={nuevaFactura.numeroExterno}
                onChange={(e) => setNuevaFactura({ ...nuevaFactura, numeroExterno: e.target.value })}
                placeholder="FCT-001234"
              />
            </div>
            <div>
              <Label>Suplidor <span className="text-red-500">*</span></Label>
              <Select
                value={nuevaFactura.suplidorId}
                onValueChange={(v) => {
                  setNuevaFactura({ ...nuevaFactura, suplidorId: v });
                  if (erroresNueva.suplidorId) setErroresNueva(e => ({ ...e, suplidorId: '' }));
                }}
              >
                <SelectTrigger className={erroresNueva.suplidorId ? 'border-red-500' : ''}>
                  <SelectValue placeholder="Seleccione un suplidor" />
                </SelectTrigger>
                <SelectContent>
                  {suplidores.map((s) => (<SelectItem key={s.id} value={s.id}>{s.nombre}</SelectItem>))}
                </SelectContent>
              </Select>
              <FieldError msg={erroresNueva.suplidorId} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Fecha Emisión <span className="text-red-500">*</span></Label>
                <Input
                  type="date"
                  value={nuevaFactura.fechaEmision}
                  onChange={(e) => {
                    setNuevaFactura({ ...nuevaFactura, fechaEmision: e.target.value });
                    if (erroresNueva.fechaEmision) setErroresNueva(e => ({ ...e, fechaEmision: '' }));
                  }}
                  className={erroresNueva.fechaEmision ? 'border-red-500' : ''}
                />
                <FieldError msg={erroresNueva.fechaEmision} />
              </div>
              <div>
                <Label>Fecha Vencimiento <span className="text-red-500">*</span></Label>
                <Input
                  type="date"
                  value={nuevaFactura.fechaVencimiento}
                  onChange={(e) => {
                    setNuevaFactura({ ...nuevaFactura, fechaVencimiento: e.target.value });
                    if (erroresNueva.fechaVencimiento) setErroresNueva(e => ({ ...e, fechaVencimiento: '' }));
                  }}
                  className={erroresNueva.fechaVencimiento ? 'border-red-500' : ''}
                />
                <FieldError msg={erroresNueva.fechaVencimiento} />
              </div>
            </div>
            <div>
              <Label>Monto Total <span className="text-red-500">*</span></Label>
              <Input
                type="number"
                min="0.01"
                step="0.01"
                value={nuevaFactura.montoTotal}
                onChange={(e) => {
                  setNuevaFactura({ ...nuevaFactura, montoTotal: e.target.value });
                  if (erroresNueva.montoTotal) setErroresNueva(e => ({ ...e, montoTotal: '' }));
                }}
                placeholder="0.00"
                className={erroresNueva.montoTotal ? 'border-red-500' : ''}
              />
              <FieldError msg={erroresNueva.montoTotal} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogNuevaFactura(false)}>Cancelar</Button>
            <Button onClick={handleNuevaFactura}>Guardar Factura</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Dialog: Editar Factura ── */}
      <Dialog open={dialogEditarFactura} onOpenChange={(open) => { setDialogEditarFactura(open); if (!open) setErroresEditar({}); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Factura</DialogTitle>
            <DialogDescription>Modifique los datos de la factura</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>ID Interno</Label>
              <Input
                value={facturaEditando.numeroFactura}
                readOnly
                tabIndex={-1}
                className="bg-gray-50 text-blue-700 cursor-not-allowed font-mono"
              />
            </div>
            <div>
              <Label>
                No. Factura Proveedor{' '}
                <span className="text-gray-400 text-xs font-normal">(opcional)</span>
              </Label>
              <Input
                value={facturaEditando.numeroExterno}
                onChange={(e) => setFacturaEditando({ ...facturaEditando, numeroExterno: e.target.value })}
                placeholder="FCT-001234"
              />
            </div>
            <div>
              <Label>Suplidor <span className="text-red-500">*</span></Label>
              <Select
                value={facturaEditando.suplidorId}
                onValueChange={(v) => {
                  setFacturaEditando({ ...facturaEditando, suplidorId: v });
                  if (erroresEditar.suplidorId) setErroresEditar(e => ({ ...e, suplidorId: '' }));
                }}
              >
                <SelectTrigger className={erroresEditar.suplidorId ? 'border-red-500' : ''}>
                  <SelectValue placeholder="Seleccione un suplidor" />
                </SelectTrigger>
                <SelectContent>
                  {suplidores.map((s) => (<SelectItem key={s.id} value={s.id}>{s.nombre}</SelectItem>))}
                </SelectContent>
              </Select>
              <FieldError msg={erroresEditar.suplidorId} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Fecha Emisión <span className="text-red-500">*</span></Label>
                <Input
                  type="date"
                  value={facturaEditando.fechaEmision}
                  onChange={(e) => {
                    setFacturaEditando({ ...facturaEditando, fechaEmision: e.target.value });
                    if (erroresEditar.fechaEmision) setErroresEditar(e => ({ ...e, fechaEmision: '' }));
                  }}
                  className={erroresEditar.fechaEmision ? 'border-red-500' : ''}
                />
                <FieldError msg={erroresEditar.fechaEmision} />
              </div>
              <div>
                <Label>Fecha Vencimiento <span className="text-red-500">*</span></Label>
                <Input
                  type="date"
                  value={facturaEditando.fechaVencimiento}
                  onChange={(e) => {
                    setFacturaEditando({ ...facturaEditando, fechaVencimiento: e.target.value });
                    if (erroresEditar.fechaVencimiento) setErroresEditar(e => ({ ...e, fechaVencimiento: '' }));
                  }}
                  className={erroresEditar.fechaVencimiento ? 'border-red-500' : ''}
                />
                <FieldError msg={erroresEditar.fechaVencimiento} />
              </div>
            </div>
            <div>
              <Label>Monto Total <span className="text-red-500">*</span></Label>
              <Input
                type="number"
                min="0.01"
                step="0.01"
                value={facturaEditando.montoTotal}
                onChange={(e) => {
                  setFacturaEditando({ ...facturaEditando, montoTotal: e.target.value });
                  if (erroresEditar.montoTotal) setErroresEditar(e => ({ ...e, montoTotal: '' }));
                }}
                className={erroresEditar.montoTotal ? 'border-red-500' : ''}
              />
              <FieldError msg={erroresEditar.montoTotal} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogEditarFactura(false)}>Cancelar</Button>
            <Button onClick={handleEditarFactura}>Actualizar Factura</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Dialog: Historial de Pagos ── */}
      <Dialog open={dialogHistorial} onOpenChange={setDialogHistorial}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Historial de Pagos</DialogTitle>
            <DialogDescription>
              {facturaDetalle ? `${facturaDetalle.numeroFactura} — ${facturaDetalle.suplidorNombre}` : ''}
            </DialogDescription>
          </DialogHeader>
          {pagosDeFactura.length === 0 ? (
            <div className="py-8 text-center text-gray-500">No hay pagos registrados para esta factura</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr className="border-b">
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Fecha</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Método</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Referencia</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Notas</th>
                    <th className="text-right py-3 px-4 text-sm font-medium text-gray-600">Monto</th>
                  </tr>
                </thead>
                <tbody>
                  {pagosDeFactura.map((pago) => (
                    <tr key={pago.id} className="border-b hover:bg-gray-50">
                      <td className="py-3 px-4 text-sm whitespace-nowrap">{formatDateTime(pago.fecha)}</td>
                      <td className="py-3 px-4 text-sm"><Badge variant="outline">{pago.metodoPago}</Badge></td>
                      <td className="py-3 px-4 text-sm font-mono text-xs">{pago.referencia || '—'}</td>
                      <td className="py-3 px-4 text-sm text-gray-500">{pago.notas || '—'}</td>
                      <td className="py-3 px-4 text-sm text-right font-semibold text-green-600">{formatCurrency(pago.monto)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-gray-50">
                  <tr>
                    <td colSpan={4} className="py-3 px-4 text-sm font-semibold text-right">Total Pagado:</td>
                    <td className="py-3 px-4 text-sm font-bold text-right text-green-600">
                      {formatCurrency(pagosDeFactura.reduce((sum, p) => sum + p.monto, 0))}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setDialogHistorial(false)}>Cerrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Dialog: Ver Detalles ── */}
      <Dialog open={dialogDetalle} onOpenChange={setDialogDetalle}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Detalles de Factura</DialogTitle>
            <DialogDescription>Información completa de la factura</DialogDescription>
          </DialogHeader>
          {facturaDetalle && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs text-gray-500">ID Interno</Label>
                  <p className="font-mono font-medium text-blue-700">{facturaDetalle.numeroFactura}</p>
                </div>
                <div>
                  <Label className="text-xs text-gray-500">No. Factura Proveedor</Label>
                  <p className="font-medium">{(facturaDetalle as any).numeroExterno || '—'}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs text-gray-500">Suplidor</Label>
                  <p className="font-medium">{facturaDetalle.suplidorNombre}</p>
                </div>
                <div>
                  <Label className="text-xs text-gray-500">Estado</Label>
                  <div className="mt-1">
                    <Badge className={
                      facturaDetalle.estado === 'Pendiente' ? 'bg-red-100 text-red-800' :
                      facturaDetalle.estado === 'Parcial' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-green-100 text-green-800'
                    }>{facturaDetalle.estado}</Badge>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs text-gray-500">Fecha Emisión</Label>
                  <p className="font-medium">{formatDate(facturaDetalle.fechaEmision)}</p>
                </div>
                <div>
                  <Label className="text-xs text-gray-500">Fecha Vencimiento</Label>
                  <p className={`font-medium ${isVencida(facturaDetalle.fechaVencimiento) && facturaDetalle.estado !== 'Pagado' ? 'text-red-600' : ''}`}>
                    {formatDate(facturaDetalle.fechaVencimiento)}
                  </p>
                </div>
              </div>
              <div className="border-t pt-4 space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-600">Monto Total:</span>
                  <span className="font-medium">{formatCurrency(facturaDetalle.montoTotal)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Monto Pagado:</span>
                  <span className="font-medium text-green-600">{formatCurrency(totalPagadoDeFactura(facturaDetalle.id))}</span>
                </div>
                <div className="flex justify-between text-lg">
                  <span className="font-semibold">Balance Pendiente:</span>
                  <span className="font-bold text-red-600">{formatCurrency(facturaDetalle.balancePendiente)}</span>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setDialogDetalle(false); exportarPDF(facturaSeleccionada); }}>
              <FileText className="size-4 mr-2" />Exportar PDF
            </Button>
            <Button onClick={() => setDialogDetalle(false)}>Cerrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Dialog: Anular Factura ── */}
      <Dialog
        open={dialogAnularFactura}
        onOpenChange={(open) => { setDialogAnularFactura(open); if (!open) setFacturaAAnular(''); }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Confirmar Anulación de Factura</DialogTitle>
            <DialogDescription>
              {facturaParaAnular?.numeroFactura}
              {(facturaParaAnular as any)?.numeroExterno ? ` — Ref. ${(facturaParaAnular as any).numeroExterno}` : ''}
            </DialogDescription>
          </DialogHeader>
          {facturaAnularTienePagos ? (
            <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              No es posible anular esta factura porque tiene pagos registrados. Solo se pueden anular facturas sin movimientos de pago para preservar la integridad contable.
            </div>
          ) : (
            <p className="text-sm text-gray-600">
              La factura pasará a estado <strong>Anulada</strong> y desaparecerá de las vistas activas,
              pero el registro se conservará en la base de datos para fines de auditoría.
              Esta acción no se puede revertir.
            </p>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogAnularFactura(false)}>Cancelar</Button>
            <Button
              variant="destructive"
              onClick={confirmarAnulacionFactura}
              disabled={facturaAnularTienePagos}
            >
              Anular Factura
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── PagoDialog unificado ── */}
      <PagoDialog
        facturaId={facturaIdPago}
        open={!!facturaIdPago}
        onOpenChange={(open) => { if (!open) setFacturaIdPago(null); }}
      />
    </div>
  );
}