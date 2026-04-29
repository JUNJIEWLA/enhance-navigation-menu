import { useMemo, useState } from 'react';
import { useData } from '../context/DataContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from '../components/ui/dialog';
import { Download, FileText, BarChart3, TrendingUp, Calendar, FileSpreadsheet, FileType2, Printer, Mail, Send } from 'lucide-react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import emailjs from '@emailjs/browser';
import logoPlazaMax from '../assets/icon_factura.png';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line,
  Area,
  AreaChart
} from 'recharts';

type TipoReporte = 'resumen-mensual' | 'por-suplidor' | 'flujo-caja' | 'vencimientos';
type FormatoExportacion = 'pdf' | 'excel' | 'csv';
type FilaExportacion = Record<string, string | number>;

const NOMBRE_MES_CORTO = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

const COLUMNA_TRADUCIDA: Record<string, string> = {
  mes: 'Mes',
  facturado: 'Facturado',
  pagado: 'Pagado',
  diferencia: 'Diferencia',
  suplidor: 'Suplidor',
  totalFacturas: 'Total Facturas',
  totalFacturasPagadas: 'Total Facturas Pagadas',
  totalFacturado: 'Total Facturado',
  totalPagado: 'Total Pagado',
  balancePendiente: 'Balance Pendiente',
  fecha: 'Fecha',
  factura: 'Factura',
  metodo: 'Metodo',
  referencia: 'Referencia',
  monto: 'Monto',
  fechaVencimiento: 'Fecha Vencimiento',
  diasVencida: 'Dias Vencida',
  estado: 'Estado'
};

export function Reportes() {
  const { facturas, pagos, suplidores } = useData();
  const [tipoReporte, setTipoReporte] = useState<TipoReporte>('resumen-mensual');
  const [mesSeleccionado, setMesSeleccionado] = useState(() => {
    const hoy = new Date();
    const year = hoy.getFullYear();
    const month = String(hoy.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
  });
  const [formatoExportacion, setFormatoExportacion] = useState<FormatoExportacion>('pdf');
  const [exportando, setExportando] = useState(false);
  const [dialogCorreoAbierto, setDialogCorreoAbierto] = useState(false);
  const [correoDestino, setCorreoDestino] = useState('');
  const [asuntoCorreo, setAsuntoCorreo] = useState('');
  const [mensajeCorreo, setMensajeCorreo] = useState('');
  const [enviandoCorreo, setEnviandoCorreo] = useState(false);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-DO', { style: 'currency', currency: 'DOP' }).format(value);
  };

  const formatDate = (value: Date) => {
    return new Intl.DateTimeFormat('es-DO', {
      year: 'numeric', month: '2-digit', day: '2-digit'
    }).format(new Date(value));
  };

  const getPeriodoTexto = () => {
    const [year, month] = mesSeleccionado.split('-').map(Number);
    return `${NOMBRE_MES_CORTO[month - 1]} ${year}`;
  };

  const obtenerRangoMes = () => {
    const [year, month] = mesSeleccionado.split('-').map(Number);
    const inicio = new Date(year, month - 1, 1);
    const fin = new Date(year, month, 0, 23, 59, 59, 999);
    return { inicio, fin, year, monthIndex: month - 1 };
  };

  const estaDentroDelPeriodo = (fecha: Date) => {
    const { inicio, fin } = obtenerRangoMes();
    const valor = new Date(fecha);
    return valor >= inicio && valor <= fin;
  };

  const buildLastSixMonths = () => {
    const { year, monthIndex } = obtenerRangoMes();
    const base = new Date(year, monthIndex, 1);
    return Array.from({ length: 6 }, (_, idx) => {
      const d = new Date(base.getFullYear(), base.getMonth() - (5 - idx), 1);
      return { monthLabel: NOMBRE_MES_CORTO[d.getMonth()], monthIndex: d.getMonth(), year: d.getFullYear() };
    });
  };

  const facturasPeriodo = useMemo(
    () => facturas.filter((f) => estaDentroDelPeriodo(f.fechaEmision)),
    [facturas, mesSeleccionado]
  );

  const pagosPeriodo = useMemo(
    () => pagos.filter((p) => estaDentroDelPeriodo(p.fecha)),
    [pagos, mesSeleccionado]
  );

  const getBalancePendienteFactura = (factura: { id: string; montoTotal: number; balancePendiente?: number }) => {
    if (typeof factura.balancePendiente === 'number') {
      return factura.balancePendiente;
    }

    const totalPagadoFactura = pagos
      .filter((p) => p.facturaId === factura.id)
      .reduce((sum, p) => sum + p.monto, 0);

    return Math.max(factura.montoTotal - totalPagadoFactura, 0);
  };

  const pagosPorMes = () => {
    return buildLastSixMonths().map(({ monthLabel, monthIndex, year }) => {
      const pagosMes = pagos.filter(p => {
        const fecha = new Date(p.fecha);
        return fecha.getMonth() === monthIndex && fecha.getFullYear() === year;
      });
      return { mes: monthLabel, pagado: pagosMes.reduce((sum, p) => sum + p.monto, 0) };
    });
  };

  const facturasVsPagesPorMes = () => {
    return buildLastSixMonths().map(({ monthLabel, monthIndex, year }) => {
      const facturasMes = facturas.filter(f => {
        const fecha = new Date(f.fechaEmision);
        return fecha.getMonth() === monthIndex && fecha.getFullYear() === year;
      });
      const pagosMes = pagos.filter(p => {
        const fecha = new Date(p.fecha);
        return fecha.getMonth() === monthIndex && fecha.getFullYear() === year;
      });
      return {
        mes: monthLabel,
        facturado: facturasMes.reduce((sum, f) => sum + f.montoTotal, 0),
        pagado: pagosMes.reduce((sum, p) => sum + p.monto, 0)
      };
    });
  };

  // ── FIX: calcula balancePendiente real sumando de facturas no pagadas por suplidor ──
  const deudaPorSuplidorData = () => {
    return suplidores
      .map(s => {
        const deuda = facturas
          .filter(f => f.suplidorId === s.id && f.estado !== 'Pagado')
          .reduce((sum, f) => {
            const balance = getBalancePendienteFactura(f);
            return sum + balance;
          }, 0);
        return {
          suplidor: s.nombre.length > 22 ? s.nombre.substring(0, 22) + '…' : s.nombre,
          deuda
        };
      })
      .filter(d => d.deuda > 0)
      .sort((a, b) => b.deuda - a.deuda);
  };

  const resumenPorSuplidor = useMemo(() => {
    return suplidores.map((suplidor) => {
      const facturasSupl = facturas.filter((f) => f.suplidorId === suplidor.id);
      const totalFacturasPagadas = facturasSupl.filter((f) => f.estado === 'Pagado').length;
      const totalFact = facturasSupl.reduce((sum, f) => sum + f.montoTotal, 0);
      const pagosSupl = pagos.filter((p) => facturasSupl.some((f) => f.id === p.facturaId));
      const totalPag = pagosSupl.reduce((sum, p) => sum + p.monto, 0);
      const pendiente = facturasSupl
        .filter((f) => f.estado !== 'Pagado')
        .reduce((sum, f) => {
          const balance = getBalancePendienteFactura(f);
          return sum + balance;
        }, 0);
      return { suplidor, facturasSupl, totalFacturasPagadas, totalFact, totalPag, pendiente };
    });
  }, [facturas, pagos, suplidores]);

  const totalFacturado = facturasPeriodo.reduce((sum, f) => sum + f.montoTotal, 0);
  const totalPagado = pagosPeriodo.reduce((sum, p) => sum + p.monto, 0);
  const totalPendiente = facturasPeriodo
    .filter(f => f.estado !== 'Pagado')
    .reduce((sum, f) => {
      const balance = getBalancePendienteFactura(f);
      return sum + balance;
    }, 0);

  const facturasVencidas = facturasPeriodo.filter(f =>
    f.estado !== 'Pagado' && new Date(f.fechaVencimiento) < new Date()
  ).length;

  const getFilasReporte = (): FilaExportacion[] => {
    if (tipoReporte === 'resumen-mensual') {
      return facturasVsPagesPorMes().map((item) => ({
        mes: item.mes,
        facturado: Number(item.facturado.toFixed(2)),
        pagado: Number(item.pagado.toFixed(2)),
        diferencia: Number((item.facturado - item.pagado).toFixed(2))
      }));
    }
    if (tipoReporte === 'por-suplidor') {
      return resumenPorSuplidor.map((r) => ({
        suplidor: r.suplidor.nombre,
        totalFacturas: r.facturasSupl.length,
        totalFacturasPagadas: r.totalFacturasPagadas,
        totalFacturado: Number(r.totalFact.toFixed(2)),
        totalPagado: Number(r.totalPag.toFixed(2)),
        balancePendiente: Number(r.pendiente.toFixed(2))
      }));
    }
    if (tipoReporte === 'flujo-caja') {
      return pagosPeriodo
        .slice()
        .sort((a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime())
        .map((p) => ({
          fecha: formatDate(p.fecha),
          suplidor: p.suplidorNombre,
          factura: p.numeroFactura,
          metodo: p.metodoPago,
          referencia: p.referencia || '-',
          monto: Number(p.monto.toFixed(2))
        }));
    }
    return facturas
      .filter((f) => f.estado !== 'Pagado')
      .map((f) => {
        const fechaVencimiento = new Date(f.fechaVencimiento);
        const diasVencida = Math.max(0, Math.floor((Date.now() - fechaVencimiento.getTime()) / (1000 * 60 * 60 * 24)));
        return {
          suplidor: f.suplidorNombre,
          factura: f.numeroFactura,
          fechaVencimiento: formatDate(fechaVencimiento),
          balancePendiente: Number(f.balancePendiente.toFixed(2)),
          diasVencida,
          estado: f.estado
        };
      })
      .sort((a, b) => (b.diasVencida as number) - (a.diasVencida as number));
  };

  const getNombreReporte = () => {
    const map: Record<TipoReporte, string> = {
      'resumen-mensual': 'Resumen Mensual',
      'por-suplidor': 'Reporte por Suplidor',
      'flujo-caja': 'Flujo de Caja',
      vencimientos: 'Analisis de Vencimientos'
    };
    return map[tipoReporte];
  };

  const getNombreArchivoBase = () => `reporte_${tipoReporte}_${mesSeleccionado}`;

  const getResumenTexto = () =>
    `Total Facturado: ${formatCurrency(totalFacturado)} | Total Pagado: ${formatCurrency(totalPagado)} | Pendiente: ${formatCurrency(totalPendiente)} | Facturas Vencidas: ${facturasVencidas}`;

  const getHeaders = (filas: FilaExportacion[]) => (!filas.length ? [] : Object.keys(filas[0]));

  const exportarExcel = (filas: FilaExportacion[]) => {
    const ws = XLSX.utils.json_to_sheet(filas);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Reporte');
    XLSX.writeFile(wb, `${getNombreArchivoBase()}.xlsx`);
  };

  const exportarCSV = (filas: FilaExportacion[]) => {
    const ws = XLSX.utils.json_to_sheet(filas);
    const csv = XLSX.utils.sheet_to_csv(ws);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${getNombreArchivoBase()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const loadImageAsDataUrl = async (imageUrl: string): Promise<string> => {
    const response = await fetch(imageUrl);
    const blob = await response.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error('No se pudo cargar la imagen del logo.'));
      reader.readAsDataURL(blob);
    });
  };

  const exportarPDF = async (filas: FilaExportacion[]) => {
    const headers = getHeaders(filas);
    const doc = new jsPDF({ orientation: 'landscape' });
    const titulo = getNombreReporte();
    const logoDataUrl = await loadImageAsDataUrl(logoPlazaMax);

    doc.setFillColor(30, 64, 175);
    doc.rect(0, 0, 297, 24, 'F');
    doc.addImage(logoDataUrl, 'PNG', 12, 5, 12, 12);
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(16);
    doc.text('Plaza Max', 28, 14);
    doc.setFontSize(10);
    doc.text('Reporte financiero profesional', 28, 19);
    doc.setTextColor(17, 24, 39);
    doc.setFontSize(14);
    doc.text(titulo, 14, 34);
    doc.setFontSize(10);
    doc.text(`Periodo: ${getPeriodoTexto()} | Generado: ${formatDate(new Date())}`, 14, 40);
    doc.text(getResumenTexto(), 14, 46);

    autoTable(doc, {
      startY: 52,
      head: [headers.map((h) => COLUMNA_TRADUCIDA[h] || h)],
      body: filas.map((fila) =>
        headers.map((header) => {
          const value = fila[header];
          if (typeof value === 'number') return formatCurrency(value);
          return value;
        })
      ),
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [30, 64, 175], textColor: [255, 255, 255] },
      didDrawPage: (data) => {
        const pageHeight = doc.internal.pageSize.getHeight();
        const pageNumber = doc.getNumberOfPages();
        doc.setFontSize(8);
        doc.setTextColor(107, 114, 128);
        doc.text(
          `Documento generado por Plaza Max | Pagina ${pageNumber}`,
          data.settings.margin.left,
          pageHeight - 6
        );
      }
    });

    doc.save(`${getNombreArchivoBase()}.pdf`);
  };

  const handleImprimir = () => window.print();

  const buildCorreoHtml = (filas: FilaExportacion[]) => {
    const headers = getHeaders(filas);
    const headHtml = headers.map((h) => `<th style="text-align:left;padding:8px;background:#1e40af;color:#fff;">${COLUMNA_TRADUCIDA[h] || h}</th>`).join('');
    const rowsHtml = filas.slice(0, 30).map((fila) => {
      const celdas = headers.map((h) => {
        const value = fila[h];
        const printable = typeof value === 'number' ? formatCurrency(value) : String(value);
        return `<td style="padding:8px;border-bottom:1px solid #e5e7eb;">${printable}</td>`;
      }).join('');
      return `<tr>${celdas}</tr>`;
    }).join('');
    return `
      <div style="font-family:Arial,sans-serif;color:#111827;line-height:1.4;">
        <h2 style="color:#1e40af;">Plaza Max - ${getNombreReporte()}</h2>
        <p><strong>Periodo:</strong> ${getPeriodoTexto()}</p>
        <p><strong>Resumen:</strong> ${getResumenTexto()}</p>
        <table style="width:100%;border-collapse:collapse;font-size:12px;">
          <thead><tr>${headHtml}</tr></thead>
          <tbody>${rowsHtml}</tbody>
        </table>
        <p style="color:#6b7280;font-size:12px;">Vista limitada a 30 filas.</p>
      </div>`;
  };

  const enviarConMailto = (filas: FilaExportacion[]) => {
    const body = `${mensajeCorreo}\n\n${getNombreReporte()} - ${getPeriodoTexto()}\n${getResumenTexto()}\n\nFilas: ${Math.min(filas.length, 30)} de ${filas.length}.`;
    window.location.href = `mailto:${encodeURIComponent(correoDestino)}?subject=${encodeURIComponent(asuntoCorreo)}&body=${encodeURIComponent(body)}`;
  };

  const handleEnviarCorreo = async () => {
    const filas = getFilasReporte();
    if (!correoDestino.trim()) { alert('Ingrese un correo destino.'); return; }
    if (!filas.length) { alert('No hay datos para enviar.'); return; }
    setEnviandoCorreo(true);
    try {
      const serviceId = import.meta.env.VITE_EMAILJS_SERVICE_ID as string | undefined;
      const templateId = import.meta.env.VITE_EMAILJS_TEMPLATE_ID as string | undefined;
      const publicKey = import.meta.env.VITE_EMAILJS_PUBLIC_KEY as string | undefined;
      if (serviceId && templateId && publicKey) {
        await emailjs.send(serviceId, templateId, {
          to_email: correoDestino, subject: asuntoCorreo, message: mensajeCorreo,
          report_name: getNombreReporte(), period: getPeriodoTexto(),
          summary: getResumenTexto(), report_html: buildCorreoHtml(filas)
        }, { publicKey });
        alert('Reporte enviado correctamente.');
      } else {
        enviarConMailto(filas);
        alert('No se detectó configuración de EmailJS. Se abrió su cliente de correo.');
      }
      setDialogCorreoAbierto(false);
    } catch (error) {
      console.error('Error enviando reporte:', error);
      alert('No fue posible enviar el reporte. Verifique la configuración de EmailJS.');
    } finally {
      setEnviandoCorreo(false);
    }
  };

  const handleExportarReporte = async () => {
    const filas = getFilasReporte();
    if (!filas.length) { alert('No hay datos para exportar en el período seleccionado.'); return; }
    setExportando(true);
    try {
      if (formatoExportacion === 'pdf') await exportarPDF(filas);
      else if (formatoExportacion === 'excel') exportarExcel(filas);
      else exportarCSV(filas);
    } catch (error) {
      console.error('Error exportando:', error);
      alert('Ocurrió un error al exportar. Intente nuevamente.');
    } finally {
      setExportando(false);
    }
  };

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Reportes</h1>
        <p className="text-gray-500 mt-1">Análisis y exportación de datos</p>
      </div>

      {/* ── Configuración de Reporte ─────────────────────────────────────────── */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Configuración de Reporte</CardTitle>
          <CardDescription>Seleccione el tipo de reporte que desea generar</CardDescription>
        </CardHeader>
        <CardContent>
          {/* Fila 1: selectores */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div>
              <Label htmlFor="tipoReporte">Tipo de Reporte</Label>
              <Select value={tipoReporte} onValueChange={(v) => setTipoReporte(v as TipoReporte)}>
                <SelectTrigger id="tipoReporte">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="resumen-mensual">Resumen Mensual</SelectItem>
                  <SelectItem value="por-suplidor">Por Suplidor</SelectItem>
                  <SelectItem value="flujo-caja">Flujo de Caja</SelectItem>
                  <SelectItem value="vencimientos">Análisis de Vencimientos</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="periodo">Período</Label>
              <Input
                id="periodo"
                type="month"
                value={mesSeleccionado}
                onChange={(e) => setMesSeleccionado(e.target.value)}
              />
            </div>

            <div>
              <Label htmlFor="formato">Formato de Exportación</Label>
              <Select value={formatoExportacion} onValueChange={(v) => setFormatoExportacion(v as FormatoExportacion)}>
                <SelectTrigger id="formato">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pdf">PDF</SelectItem>
                  <SelectItem value="excel">Excel (.xlsx)</SelectItem>
                  <SelectItem value="csv">CSV</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Fila 2: botones de acción — siempre dentro del card */}
          <div className="flex flex-wrap items-center gap-3 pt-1">
            <Button onClick={handleExportarReporte} disabled={exportando} className="min-w-[160px]">
              {formatoExportacion === 'excel' ? (
                <FileSpreadsheet className="size-4 mr-2" />
              ) : formatoExportacion === 'pdf' ? (
                <FileType2 className="size-4 mr-2" />
              ) : (
                <Download className="size-4 mr-2" />
              )}
              {exportando ? 'Exportando…' : `Exportar ${formatoExportacion.toUpperCase()}`}
            </Button>

            <Button variant="outline" onClick={handleImprimir}>
              <Printer className="size-4 mr-2" />
              Imprimir
            </Button>

            <Dialog open={dialogCorreoAbierto} onOpenChange={setDialogCorreoAbierto}>
              <DialogTrigger asChild>
                <Button
                  variant="outline"
                  onClick={() => {
                    setAsuntoCorreo(`Reporte ${getNombreReporte()} - ${getPeriodoTexto()}`);
                    setMensajeCorreo('Adjunto el resumen ejecutivo del reporte solicitado.');
                  }}
                >
                  <Mail className="size-4 mr-2" />
                  Enviar
                </Button>
              </DialogTrigger>

              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Enviar Reporte por Correo</DialogTitle>
                  <DialogDescription>
                    Envíe un resumen profesional del reporte seleccionado. Para adjuntos completos, use exportación PDF/Excel.
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="correoDestino">Correo Destino</Label>
                    <Input
                      id="correoDestino"
                      type="email"
                      value={correoDestino}
                      onChange={(e) => setCorreoDestino(e.target.value)}
                      placeholder="gerencia@plazamax.com"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="asuntoCorreo">Asunto</Label>
                    <Input id="asuntoCorreo" value={asuntoCorreo} onChange={(e) => setAsuntoCorreo(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="mensajeCorreo">Mensaje</Label>
                    <Textarea id="mensajeCorreo" value={mensajeCorreo} onChange={(e) => setMensajeCorreo(e.target.value)} className="min-h-24" />
                  </div>
                </div>

                <DialogFooter>
                  <Button variant="outline" onClick={() => setDialogCorreoAbierto(false)}>Cancelar</Button>
                  <Button onClick={handleEnviarCorreo} disabled={enviandoCorreo}>
                    <Send className="size-4 mr-2" />
                    {enviandoCorreo ? 'Enviando…' : 'Enviar Correo'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </CardContent>
      </Card>

      {/* ── Estadísticas del período ─────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Total Facturado</CardTitle>
            <FileText className="size-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-900">{formatCurrency(totalFacturado)}</div>
            <p className="text-xs text-gray-500 mt-1">Período: {getPeriodoTexto()}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Total Pagado</CardTitle>
            <TrendingUp className="size-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{formatCurrency(totalPagado)}</div>
            <p className="text-xs text-gray-500 mt-1">Histórico de pagos</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Total Pendiente</CardTitle>
            <BarChart3 className="size-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{formatCurrency(totalPendiente)}</div>
            <p className="text-xs text-gray-500 mt-1">Balance por pagar</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Facturas Vencidas</CardTitle>
            <Calendar className="size-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{facturasVencidas}</div>
            <p className="text-xs text-gray-500 mt-1">Requieren atención</p>
          </CardContent>
        </Card>
      </div>

      {/* ── Gráficos ─────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <Card>
          <CardHeader>
            <CardTitle>Facturado vs Pagado por Mes</CardTitle>
            <CardDescription>Comparación mensual del ciclo financiero</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={facturasVsPagesPorMes()}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="mes" style={{ fontSize: '12px' }} />
                <YAxis
                  tickFormatter={(value) => `$${(value / 1000).toFixed(0)}K`}
                  style={{ fontSize: '12px' }}
                />
                <Tooltip formatter={(value: number) => formatCurrency(value)} />
                <Legend />
                <Area type="monotone" dataKey="facturado" stackId="1" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.6} name="Facturado" />
                <Area type="monotone" dataKey="pagado" stackId="2" stroke="#10b981" fill="#10b981" fillOpacity={0.6} name="Pagado" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Tendencia de Pagos</CardTitle>
            <CardDescription>Evolución mensual de pagos realizados</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={pagosPorMes()}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="mes" style={{ fontSize: '12px' }} />
                <YAxis
                  tickFormatter={(value) => `$${(value / 1000).toFixed(0)}K`}
                  style={{ fontSize: '12px' }}
                />
                <Tooltip formatter={(value: number) => formatCurrency(value)} />
                <Legend />
                <Line type="monotone" dataKey="pagado" stroke="#10b981" strokeWidth={3} name="Pagado" dot={{ r: 5 }} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* ── FIX: layout="vertical" para barras horizontales con categorías en Y ── */}
      <Card>
        <CardHeader>
          <CardTitle>Balance Pendiente por Suplidor</CardTitle>
          <CardDescription>Distribución de deuda actual</CardDescription>
        </CardHeader>
        <CardContent>
          {deudaPorSuplidorData().length === 0 ? (
            <div className="flex items-center justify-center h-40 text-gray-400 text-sm">
              No hay balances pendientes registrados
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={Math.max(300, deudaPorSuplidorData().length * 48)}>
              {/* layout vertical para barras horizontales con categorias en Y */}
              <BarChart
                data={deudaPorSuplidorData()}
                layout="vertical"
                margin={{ top: 5, right: 30, left: 160, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis
                  type="number"
                  tickFormatter={(value) => `$${(value / 1000).toFixed(0)}K`}
                  style={{ fontSize: '11px' }}
                />
                <YAxis
                  dataKey="suplidor"
                  type="category"
                  width={155}
                  style={{ fontSize: '11px' }}
                  tick={{ fill: '#374151' }}
                />
                <Tooltip formatter={(value: number) => formatCurrency(value)} />
                <Legend />
                <Bar dataKey="deuda" fill="#ef4444" name="Deuda Pendiente" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* ── Tabla resumen por suplidor ───────────────────────────────────────── */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Resumen por Suplidor</CardTitle>
          <CardDescription>Detalle completo de cada proveedor</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr className="border-b">
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Suplidor</th>
                  <th className="text-center py-3 px-4 text-sm font-medium text-gray-600">Total Facturas</th>                
                  <th className="text-center py-3 px-4 text-sm font-medium text-gray-600">Total Facturas Pagadas</th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-gray-600">Total Facturado</th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-gray-600">Total Pagado</th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-gray-600">Balance Pendiente</th>
                </tr>
              </thead>
              <tbody>
                {resumenPorSuplidor.map(({ suplidor, facturasSupl, totalFacturasPagadas, totalFact, totalPag, pendiente }) => (
                  <tr key={suplidor.id} className="border-b hover:bg-gray-50">
                    <td className="py-3 px-4 text-sm font-medium">{suplidor.nombre}</td>
                    <td className="py-3 px-4 text-sm text-center">{facturasSupl.length}</td>
                    <td className="py-3 px-4 text-sm text-center">{totalFacturasPagadas}</td>
                    <td className="py-3 px-4 text-sm text-right">{formatCurrency(totalFact)}</td>
                    <td className="py-3 px-4 text-sm text-right text-green-600">{formatCurrency(totalPag)}</td>
                    <td className="py-3 px-4 text-sm text-right font-semibold text-red-600">{formatCurrency(pendiente)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-gray-50 font-bold">
                <tr className="border-t-2">
                  <td className="py-3 px-4 text-sm">TOTAL</td>
                  <td className="py-3 px-4 text-sm text-center">{facturas.length}</td>
                  <td className="py-3 px-4 text-sm text-center">{facturas.filter((f) => f.estado === 'Pagado').length}</td>
                  <td className="py-3 px-4 text-sm text-right">{formatCurrency(facturas.reduce((sum, f) => sum + f.montoTotal, 0))}</td>
                  <td className="py-3 px-4 text-sm text-right text-green-600">{formatCurrency(pagos.reduce((sum, p) => sum + p.monto, 0))}</td>
                  <td className="py-3 px-4 text-sm text-right text-red-600">
                    {formatCurrency(
                      facturas
                        .filter((f) => f.estado !== 'Pagado')
                        .reduce((sum, f) => {
                          const balance = getBalancePendienteFactura(f);
                          return sum + balance;
                        }, 0)
                    )}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}