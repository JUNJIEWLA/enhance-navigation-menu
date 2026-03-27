import { useState } from 'react';
import { useData } from '../context/DataContext';
import { Card, CardContent } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { Search, Download } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Button } from '../components/ui/button';

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

  const getMetodoBadge = (metodo: string) => {
    const colors: Record<string, string> = {
      'Transferencia': 'bg-blue-100 text-blue-800 border-blue-300',
      'Cheque': 'bg-purple-100 text-purple-800 border-purple-300',
      'Efectivo': 'bg-green-100 text-green-800 border-green-300'
    };
    return colors[metodo] || '';
  };

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
          <Button variant="outline" onClick={() => alert('Funcionalidad de exportación en desarrollo')}>
            <Download className="size-4 mr-2" />
            Exportar a Excel
          </Button>
        </div>
      )}
    </div>
  );
}
