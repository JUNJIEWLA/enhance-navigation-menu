import { useState } from 'react';
import { useData } from '../context/DataContext';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Plus, Search, MoreVertical, DollarSign, Eye, Trash2, Edit, FileText, History } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '../components/ui/dropdown-menu';
import { PagoDialog } from '../components/PagoDialog';

// Helper para mensajes de error inline
const FieldError = ({ msg }: { msg?: string }) =>
  msg ? <p className="text-xs text-red-500 mt-1">{msg}</p> : null;

export function CuentasPorPagar() {
  const { facturas, suplidores, pagos, agregarFactura, editarFactura, eliminarFactura } = useData();

  const [busqueda, setBusqueda] = useState('');
  const [filtroEstado, setFiltroEstado] = useState<'Todos' | 'Pendiente' | 'Parcial' | 'Pagado'>('Todos');

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
    } else if (datos.fechaEmision && new Date(datos.fechaVencimiento) < new Date(datos.fechaEmision)) {
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

  // ── Filtrado de facturas ───────────────────────────────────────────────────
  const facturasFiltradas = facturas
    .filter(f => {
      if (f.estado === 'Anulada') return false;
      const termino = busqueda.toLowerCase();
      const matchBusqueda =
        f.numeroFactura.toLowerCase().includes(termino) ||
        f.suplidorNombre.toLowerCase().includes(termino) ||
        ((f as any).numeroExterno || '').toLowerCase().includes(termino);
      const matchEstado = filtroEstado === 'Todos' || f.estado === filtroEstado;
      return matchBusqueda && matchEstado;
    })
    .sort((a, b) => new Date(a.fechaVencimiento).getTime() - new Date(b.fechaVencimiento).getTime());

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('es-DO', { style: 'currency', currency: 'DOP' }).format(value);

  const formatDate = (date: Date) =>
    new Intl.DateTimeFormat('es-DO', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(date));

  const isVencida = (fecha: Date) => new Date(fecha) < hoy;

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
      fechaEmision: new Date(nuevaFactura.fechaEmision),
      fechaVencimiento: new Date(nuevaFactura.fechaVencimiento),
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
      fechaEmision: new Date(factura.fechaEmision).toISOString().split('T')[0],
      fechaVencimiento: new Date(factura.fechaVencimiento).toISOString().split('T')[0],
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
      numeroExterno: facturaEditando.numeroExterno || undefined,
      suplidorId: facturaEditando.suplidorId,
      suplidorNombre: suplidor.nombre,
      fechaEmision: new Date(facturaEditando.fechaEmision),
      fechaVencimiento: new Date(facturaEditando.fechaVencimiento),
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
          <div><div class="titulo">FACTURA POR PAGAR</div><div class="subtitulo">Sistema de Gestión - Plaza Max</div></div>
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
            <div class="total-row" style="color:green"><span>Total Pagado:</span><span>${formatCurrency(factura.montoTotal - factura.balancePendiente)}</span></div>
            <div class="total-row total-final"><span>Balance Pendiente:</span><span>${formatCurrency(factura.balancePendiente)}</span></div>
          </div>
        </div>
        ${pagosFactura.length > 0 ? `
        <div class="seccion"><h3>Historial de Pagos</h3>
          <table class="tabla"><thead><tr><th>Fecha</th><th>Método</th><th>Referencia</th><th>Notas</th><th style="text-align:right">Monto</th></tr></thead>
          <tbody>${pagosFactura.map(p => `<tr>
            <td>${formatDate(p.fecha)}</td><td>${p.metodoPago}</td>
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
    <div>
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Cuentas por Pagar</h1>
          <p className="text-gray-500 mt-1">Registro detallado de facturas</p>
        </div>
        <Button onClick={abrirDialogNuevaFactura}>
          <Plus className="size-4 mr-2" />
          Nueva Factura
        </Button>
      </div>

      {/* Filtros */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 size-4 text-gray-400" />
              <Input
                placeholder="Buscar por ID, Ref. Proveedor o Suplidor..."
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={filtroEstado} onValueChange={(v: any) => setFiltroEstado(v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Todos">Todos los Estados</SelectItem>
                <SelectItem value="Pendiente">Pendiente</SelectItem>
                <SelectItem value="Parcial">Parcial</SelectItem>
                <SelectItem value="Pagado">Pagado</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Tabla */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr className="border-b">
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">ID Interno</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Ref. Proveedor</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Suplidor</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">F. Emisión</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">F. Vencimiento</th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-gray-600">Monto Total</th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-gray-600">Balance Pendiente</th>
                  <th className="text-center py-3 px-4 text-sm font-medium text-gray-600">Estado</th>
                  <th className="text-center py-3 px-4 text-sm font-medium text-gray-600">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {facturasFiltradas.map((factura) => (
                  <tr key={factura.id} className="border-b hover:bg-gray-50">
                    <td className="py-3 px-4 text-sm font-mono font-medium text-blue-700">{factura.numeroFactura}</td>
                    <td className="py-3 px-4 text-sm text-gray-500">{(factura as any).numeroExterno || '—'}</td>
                    <td className="py-3 px-4 text-sm">{factura.suplidorNombre}</td>
                    <td className="py-3 px-4 text-sm">{formatDate(factura.fechaEmision)}</td>
                    <td className={`py-3 px-4 text-sm ${isVencida(factura.fechaVencimiento) && factura.estado !== 'Pagado' ? 'text-red-600 font-bold' : ''}`}>
                      {formatDate(factura.fechaVencimiento)}
                      {isVencida(factura.fechaVencimiento) && factura.estado !== 'Pagado' && ' ⚠️'}
                    </td>
                    <td className="py-3 px-4 text-sm text-right">{formatCurrency(factura.montoTotal)}</td>
                    <td className="py-3 px-4 text-sm text-right font-semibold">{formatCurrency(factura.balancePendiente)}</td>
                    <td className="py-3 px-4 text-center">
                      <Badge className={
                        factura.estado === 'Pendiente' ? 'bg-red-100 text-red-800 border-red-300' :
                        factura.estado === 'Parcial' ? 'bg-yellow-100 text-yellow-800 border-yellow-300' :
                        'bg-green-100 text-green-800 border-green-300'
                      }>{factura.estado}</Badge>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <DropdownMenu
                        open={menuAccionesAbierto === factura.id}
                        onOpenChange={(open) => setMenuAccionesAbierto(open ? factura.id : null)}
                      >
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm"><MoreVertical className="size-4" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
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
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {facturasFiltradas.length === 0 && (
              <div className="py-12 text-center text-gray-500">No se encontraron facturas</div>
            )}
          </div>
        </CardContent>
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
                      <td className="py-3 px-4 text-sm">{formatDate(pago.fecha)}</td>
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
                  <span className="font-medium text-green-600">{formatCurrency(facturaDetalle.montoTotal - facturaDetalle.balancePendiente)}</span>
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