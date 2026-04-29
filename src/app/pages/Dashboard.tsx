import { Link } from 'react-router';
import { useData } from '../context/DataContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { AlertCircle, TrendingUp, Calendar, CheckCircle } from 'lucide-react';
import { useState } from 'react';
import { PagoDialog } from '../components/PagoDialog';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

export function Dashboard() {
  const { facturas, pagos } = useData();
  const [facturaIdPago, setFacturaIdPago] = useState<string | null>(null);
  const hasData = facturas.length > 0 || pagos.length > 0;

  const hoy = new Date();
  const inicioSemana = new Date(hoy);
  inicioSemana.setDate(hoy.getDate() + 7);
  const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);

  // Calcular KPIs
  const totalPorPagar = facturas
    .filter(f => f.estado !== 'Pagado')
    .reduce((sum, f) => sum + f.balancePendiente, 0);

  const vencido = facturas
    .filter(f => f.estado !== 'Pagado' && new Date(f.fechaVencimiento) < hoy)
    .reduce((sum, f) => sum + f.balancePendiente, 0);

  const aVencerEstaSemana = facturas
    .filter(f => {
      const vencimiento = new Date(f.fechaVencimiento);
      return f.estado !== 'Pagado' && vencimiento >= hoy && vencimiento <= inicioSemana;
    })
    .reduce((sum, f) => sum + f.balancePendiente, 0);

  const totalPagadoMes = pagos
    .filter(p => new Date(p.fecha) >= inicioMes)
    .reduce((sum, p) => sum + p.monto, 0);

  // Facturas próximas a vencer
  const facturasProximas = facturas
    .filter(f => f.estado !== 'Pagado')
    .sort((a, b) => new Date(a.fechaVencimiento).getTime() - new Date(b.fechaVencimiento).getTime())
    .slice(0, 10);

  // Datos para gráfico de barras (deuda por suplidor)
  const deudaPorSuplidor = facturas
    .filter(f => f.estado !== 'Pagado')
    .reduce((acc, f) => {
      const existing = acc.find(item => item.nombre === f.suplidorNombre);
      if (existing) {
        existing.deuda += f.balancePendiente;
      } else {
        acc.push({ nombre: f.suplidorNombre, deuda: f.balancePendiente });
      }
      return acc;
    }, [] as { nombre: string; deuda: number }[])
    .sort((a, b) => b.deuda - a.deuda)
    .slice(0, 5);

  // Datos para gráfico de pastel (estado de facturas)
  const estadoFacturas = [
    { 
      name: 'Pendiente', 
      value: facturas.filter(f => f.estado === 'Pendiente').length,
      monto: facturas.filter(f => f.estado === 'Pendiente').reduce((sum, f) => sum + f.balancePendiente, 0)
    },
    { 
      name: 'Parcial', 
      value: facturas.filter(f => f.estado === 'Parcial').length,
      monto: facturas.filter(f => f.estado === 'Parcial').reduce((sum, f) => sum + f.balancePendiente, 0)
    },
    { 
      name: 'Pagado', 
      value: facturas.filter(f => f.estado === 'Pagado').length,
      monto: facturas.filter(f => f.estado === 'Pagado').reduce((sum, f) => sum + f.montoTotal, 0)
    }
  ];

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-DO', {
      style: 'currency',
      currency: 'DOP'
    }).format(value);
  };

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('es-DO', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    }).format(new Date(date));
  };

  const isVencida = (fecha: Date) => {
    return new Date(fecha) < hoy;
  };

  return (
    <div>
      <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-500 mt-1">Vista panorámica de tus cuentas por pagar</p>
        </div>

        <div className="flex flex-wrap gap-3">
          <Button asChild variant="outline" className="border-gray-300 bg-white">
            <Link to="/suplidores">Crear suplidor</Link>
          </Button>
          <Button asChild className="bg-blue-600 hover:bg-blue-700">
            <Link to="/cuentas-por-pagar">Crear factura</Link>
          </Button>
        </div>
      </div>

      {!hasData ? (
        <Card className="mb-8 border-dashed border-2 border-blue-200 bg-blue-50/60">
          <CardContent className="py-8">
            <div className="max-w-2xl">
              <h2 className="text-xl font-semibold text-gray-900">Su empresa aún no tiene registros</h2>
              <p className="mt-2 text-sm text-gray-600">
                Puede comenzar creando suplidores y luego registrar facturas para esta empresa. Los datos se guardan separados por empresa y no se mezclan con otras cuentas.
              </p>
              <div className="mt-4 flex flex-wrap gap-3">
                <Button asChild variant="outline" className="border-gray-300 bg-white">
                  <Link to="/suplidores">Ir a suplidores</Link>
                </Button>
                <Button asChild className="bg-blue-600 hover:bg-blue-700">
                  <Link to="/cuentas-por-pagar">Ir a facturas</Link>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Total por Pagar</CardTitle>
            <TrendingUp className="size-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-900">{formatCurrency(totalPorPagar)}</div>
            <p className="text-xs text-gray-500 mt-1">Deuda total actual</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Vencido (En Mora)</CardTitle>
            <AlertCircle className="size-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{formatCurrency(vencido)}</div>
            <p className="text-xs text-gray-500 mt-1">Requiere atención urgente</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">A Vencer esta Semana</CardTitle>
            <Calendar className="size-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{formatCurrency(aVencerEstaSemana)}</div>
            <p className="text-xs text-gray-500 mt-1">Próximos 7 días</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Total Pagado (Mes Actual)</CardTitle>
            <CheckCircle className="size-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{formatCurrency(totalPagadoMes)}</div>
            <p className="text-xs text-gray-500 mt-1">
              {hoy.toLocaleString('es-DO', { month: 'long', year: 'numeric' })}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <Card>
          <CardHeader>
            <CardTitle>Deuda por Suplidor (Top 5)</CardTitle>
            <CardDescription>Suplidores con mayor balance pendiente</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={deudaPorSuplidor}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="nombre" 
                  angle={-45}
                  textAnchor="end"
                  height={100}
                  style={{ fontSize: '12px' }}
                />
                <YAxis 
                  tickFormatter={(value) => `$${(value / 1000).toFixed(0)}K`}
                  style={{ fontSize: '12px' }}
                />
                <Tooltip 
                  formatter={(value: number) => formatCurrency(value)}
                  labelStyle={{ color: '#000' }}
                />
                <Legend />
                <Bar dataKey="deuda" fill="#3b82f6" name="Deuda Pendiente" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Estado de Facturas</CardTitle>
            <CardDescription>Distribución por estado de pago</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={estadoFacturas}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, value }) => `${name}: ${value}`}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {estadoFacturas.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  formatter={(value: number, name: string, props: any) => [
                    `${value} facturas - ${formatCurrency(props.payload.monto)}`,
                    name
                  ]}
                />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Tabla de Atención Rápida - CORREGIDO AQUÍ */}
      <Card className="h-fit w-full overflow-hidden mb-4">
        <CardHeader>
          <CardTitle>Atención Rápida</CardTitle>
          <CardDescription>Facturas próximas a vencer ordenadas por fecha</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto pb-4">
            <table className="w-full min-w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">No. Factura</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Suplidor</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Vencimiento</th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-gray-600">Balance</th>
                  <th className="text-center py-3 px-4 text-sm font-medium text-gray-600">Estado</th>
                  <th className="text-center py-3 px-4 text-sm font-medium text-gray-600">Acción</th>
                </tr>
              </thead>
              <tbody>
                {facturasProximas.map((factura) => (
                  <tr key={factura.id} className="border-b hover:bg-gray-50 transition-colors">
                    <td className="py-3 px-4 text-sm">{factura.numeroFactura}</td>
                    <td className="py-3 px-4 text-sm">{factura.suplidorNombre}</td>
                    <td className={`py-3 px-4 text-sm ${isVencida(factura.fechaVencimiento) ? 'text-red-600 font-semibold' : ''}`}>
                      {formatDate(factura.fechaVencimiento)}
                      {isVencida(factura.fechaVencimiento) && ' ⚠️'}
                    </td>
                    <td className="py-3 px-4 text-sm text-right font-medium">{formatCurrency(factura.balancePendiente)}</td>
                    <td className="py-3 px-4 text-center">
                      <Badge 
                        variant={
                          factura.estado === 'Pendiente' ? 'destructive' : 
                          factura.estado === 'Parcial' ? 'outline' : 
                          'default'
                        }
                        className={
                          factura.estado === 'Parcial' ? 'bg-yellow-100 text-yellow-800 border-yellow-300' : ''
                        }
                      >
                        {factura.estado}
                      </Badge>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <Button 
                        size="sm" 
                        onClick={() => setFacturaIdPago(factura.id)}
                      >
                        Registrar Pago
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Diálogo de pago unificado - CORREGIDO AQUÍ */}
      {facturaIdPago && (
        <PagoDialog
          facturaId={facturaIdPago}
          open={!!facturaIdPago}
          onOpenChange={(open) => { if (!open) setFacturaIdPago(null); }}
        />
      )}
    </div>
  );
}