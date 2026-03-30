import { useState } from 'react';
import { useData } from '../context/DataContext';
import { Card, CardContent } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { Search, FileDown } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Button } from '../components/ui/button';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export function Pagos() {
  const { pagos } = useData();
  const [busqueda, setBusqueda] = useState('');
  const [filtroMetodo, setFiltroMetodo] = useState<'Todos' | 'Cheque' | 'Transferencia' | 'Efectivo'>('Todos');

  const pagosFiltrados = pagos.filter(p => {
    const matchBusqueda =
      p.numeroFactura.toLowerCase().includes(busqueda.toLowerCase()) ||
      p.suplidorNombre.toLowerCase().includes(busqueda.toLowerCase()) ||
      p.referencia.toLowerCase().includes(busqueda.toLowerCase());

    const matchMetodo = filtroMetodo === 'Todos' || p.metodoPago === filtroMetodo;

    return matchBusqueda && matchMetodo;
  }).sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());

  const totalPagado = pagosFiltrados.reduce((sum, p) => sum + p.monto, 0);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-DO', {
      style: 'currency',
      currency: 'DOP'
    }).format(value);
  };

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('es-DO', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(new Date(date));
  };

  const formatDateShort = (date: Date) => {
    return new Intl.DateTimeFormat('es-DO', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(new Date(date));
  };

  const getMetodoBadge = (metodo: string) => {
    const colors: Record<string, string> = {
      'Transferencia': 'bg-blue-100 text-blue-800 border-blue-300',
      'Cheque': 'bg-purple-100 text-purple-800 border-purple-300',
      'Efectivo': 'bg-green-100 text-green-800 border-green-300'
    };
    return colors[metodo] || '';
  };

  // ─── EXPORTAR PDF ────────────────────────────────────────────────────────────
  const exportarPDF = () => {
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

    const pageWidth = doc.internal.pageSize.getWidth();
    const fechaGenerado = new Intl.DateTimeFormat('es-DO', {
      year: 'numeric', month: 'long', day: 'numeric',
      hour: '2-digit', minute: '2-digit'
    }).format(new Date());

    // ── Encabezado ──────────────────────────────────────────────────────────────
    doc.setFillColor(30, 64, 175); // azul oscuro
    doc.rect(0, 0, pageWidth, 22, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('Reporte de Pagos / Egresos', 14, 13);

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(`Generado: ${fechaGenerado}`, pageWidth - 14, 13, { align: 'right' });

    // ── Filtro activo ───────────────────────────────────────────────────────────
    doc.setTextColor(80, 80, 80);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'italic');
    const filtroTexto = filtroMetodo !== 'Todos'
      ? `Filtro aplicado: Método de pago = ${filtroMetodo}`
      : 'Sin filtros aplicados';
    doc.text(filtroTexto, 14, 28);

    // ── Tarjetas de resumen ─────────────────────────────────────────────────────
    const promedio = pagosFiltrados.length > 0 ? totalPagado / pagosFiltrados.length : 0;
    const resumen = [
      { label: 'Total Pagado', value: formatCurrency(totalPagado) },
      { label: 'Número de Pagos', value: String(pagosFiltrados.length) },
      { label: 'Promedio por Pago', value: formatCurrency(promedio) }
    ];

    const cardW = (pageWidth - 28 - 8) / 3;
    resumen.forEach((item, i) => {
      const x = 14 + i * (cardW + 4);
      doc.setFillColor(241, 245, 249);
      doc.roundedRect(x, 31, cardW, 16, 2, 2, 'F');
      doc.setTextColor(100, 116, 139);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.text(item.label, x + cardW / 2, 37, { align: 'center' });
      doc.setTextColor(15, 23, 42);
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text(item.value, x + cardW / 2, 44, { align: 'center' });
    });

    // ── Tabla de pagos ──────────────────────────────────────────────────────────
    const columnas = ['Fecha', 'No. Factura', 'Suplidor', 'Método', 'Referencia', 'Monto (DOP)', 'Notas'];

    const filas = pagosFiltrados.map(p => [
      formatDateShort(p.fecha),
      p.numeroFactura,
      p.suplidorNombre,
      p.metodoPago,
      p.referencia,
      formatCurrency(p.monto),
      p.notas || '-'
    ]);

    // Fila de total al final
    filas.push(['', '', '', '', 'TOTAL', formatCurrency(totalPagado), '']);

    autoTable(doc, {
      head: [columnas],
      body: filas,
      startY: 52,
      margin: { left: 14, right: 14 },
      styles: {
        fontSize: 8,
        cellPadding: { top: 3, bottom: 3, left: 3, right: 3 },
        lineColor: [226, 232, 240],
        lineWidth: 0.3,
        textColor: [30, 41, 59]
      },
      headStyles: {
        fillColor: [30, 64, 175],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 8.5,
        halign: 'center'
      },
      columnStyles: {
        0: { halign: 'center', cellWidth: 28 },
        1: { halign: 'center', cellWidth: 28 },
        2: { cellWidth: 48 },
        3: { halign: 'center', cellWidth: 26 },
        4: { halign: 'center', cellWidth: 36 },
        5: { halign: 'right', fontStyle: 'bold', cellWidth: 34 },
        6: { cellWidth: 'auto' }
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252]
      },
      // Última fila = total → fondo diferente
      didParseCell(data) {
        if (data.row.index === filas.length - 1) {
          data.cell.styles.fillColor = [219, 234, 254]; // azul claro
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.textColor = [30, 64, 175];
        }
        // Color por método de pago
        if (data.section === 'body' && data.column.index === 3) {
          const metodo = data.cell.raw as string;
          if (metodo === 'Transferencia') data.cell.styles.textColor = [29, 78, 216];
          else if (metodo === 'Cheque') data.cell.styles.textColor = [109, 40, 217];
          else if (metodo === 'Efectivo') data.cell.styles.textColor = [21, 128, 61];
        }
        // Montos en verde
        if (data.section === 'body' && data.column.index === 5 && data.row.index < filas.length - 1) {
          data.cell.styles.textColor = [21, 128, 61];
        }
      },
      // Pie de página con número de página
      didDrawPage(data) {
        const pageCount = (doc as any).internal.getNumberOfPages();
        const currentPage = (doc as any).internal.getCurrentPageInfo().pageNumber;
        doc.setFontSize(8);
        doc.setTextColor(148, 163, 184);
        doc.setFont('helvetica', 'normal');
        doc.text(
          `Página ${currentPage} de ${pageCount}`,
          pageWidth / 2,
          doc.internal.pageSize.getHeight() - 6,
          { align: 'center' }
        );
      }
    });

    // ── Descargar ───────────────────────────────────────────────────────────────
    const timestamp = new Date().toISOString().slice(0, 10);
    doc.save(`pagos_egresos_${timestamp}.pdf`);
  };
  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Pagos / Egresos</h1>
        <p className="text-gray-500 mt-1">Historial de pagos realizados</p>
      </div>

      {/* Resumen */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-gray-600 mb-1">Total en Resultados</p>
            <p className="text-2xl font-bold text-gray-900">{formatCurrency(totalPagado)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-gray-600 mb-1">Número de Pagos</p>
            <p className="text-2xl font-bold text-gray-900">{pagosFiltrados.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-gray-600 mb-1">Promedio por Pago</p>
            <p className="text-2xl font-bold text-gray-900">
              {pagosFiltrados.length > 0 ? formatCurrency(totalPagado / pagosFiltrados.length) : formatCurrency(0)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filtros */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="relative md:col-span-2">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 size-4 text-gray-400" />
              <Input
                placeholder="Buscar por factura, suplidor o referencia..."
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={filtroMetodo} onValueChange={(v: any) => setFiltroMetodo(v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Todos">Todos los Métodos</SelectItem>
                <SelectItem value="Transferencia">Transferencia</SelectItem>
                <SelectItem value="Cheque">Cheque</SelectItem>
                <SelectItem value="Efectivo">Efectivo</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Tabla de pagos */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr className="border-b">
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Fecha</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">No. Factura</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Suplidor</th>
                  <th className="text-center py-3 px-4 text-sm font-medium text-gray-600">Método</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Referencia</th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-gray-600">Monto</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Notas</th>
                </tr>
              </thead>
              <tbody>
                {pagosFiltrados.map((pago) => (
                  <tr key={pago.id} className="border-b hover:bg-gray-50">
                    <td className="py-3 px-4 text-sm">{formatDate(pago.fecha)}</td>
                    <td className="py-3 px-4 text-sm font-medium">{pago.numeroFactura}</td>
                    <td className="py-3 px-4 text-sm">{pago.suplidorNombre}</td>
                    <td className="py-3 px-4 text-center">
                      <Badge variant="outline" className={getMetodoBadge(pago.metodoPago)}>
                        {pago.metodoPago}
                      </Badge>
                    </td>
                    <td className="py-3 px-4 text-sm font-mono text-gray-600">{pago.referencia}</td>
                    <td className="py-3 px-4 text-sm text-right font-semibold text-green-600">
                      {formatCurrency(pago.monto)}
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-600 max-w-xs truncate">
                      {pago.notas || '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {pagosFiltrados.length === 0 && (
              <div className="py-12 text-center text-gray-500">
                No se encontraron pagos registrados
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Botón de exportar */}
      {pagosFiltrados.length > 0 && (
        <div className="mt-6 flex justify-end">
          <Button
            variant="outline"
            onClick={exportarPDF}
            className="border-blue-300 text-blue-700 hover:bg-blue-50"
          >
            <FileDown className="size-4 mr-2" />
            Exportar a PDF
          </Button>
        </div>
      )}
    </div>
  );
}