import { useMemo, useState } from 'react';
import { useData } from '../context/DataContext';
import { Card, CardContent } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Search } from 'lucide-react';

export function Historial() {
  const { historialEventos } = useData();
  const [busqueda, setBusqueda] = useState('');

  const eventosFiltrados = useMemo(() => {
    return historialEventos
      .filter((item) => {
        const texto = `${item.evento} ${item.descripcion} ${item.usuario}`.toLowerCase();
        return texto.includes(busqueda.toLowerCase());
      })
      .sort((a, b) => b.fechaHora.getTime() - a.fechaHora.getTime());
  }, [historialEventos, busqueda]);

  const formatDateTime = (value: Date) => {
    return new Intl.DateTimeFormat('es-DO', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).format(new Date(value));
  };

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Historial</h1>
        <p className="text-gray-500 mt-1">Bitácora cronológica de eventos del sistema</p>
      </div>

      <Card className="mb-6">
        <CardContent className="pt-6">
          <Label htmlFor="buscar-historial" className="mb-2 block">Buscar evento</Label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-gray-400" />
            <Input
              id="buscar-historial"
              value={busqueda}
              onChange={(event) => setBusqueda(event.target.value)}
              placeholder="Buscar por evento, descripción o usuario..."
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr className="border-b">
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Evento</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Descripción Detallada</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Usuario</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Fecha y Hora</th>
                </tr>
              </thead>
              <tbody>
                {eventosFiltrados.map((item) => (
                  <tr key={item.id} className="border-b hover:bg-gray-50">
                    <td className="py-3 px-4 text-sm font-medium">{item.evento}</td>
                    <td className="py-3 px-4 text-sm text-gray-700">{item.descripcion}</td>
                    <td className="py-3 px-4 text-sm text-gray-700">{item.usuario}</td>
                    <td className="py-3 px-4 text-sm text-gray-700 whitespace-nowrap">{formatDateTime(item.fechaHora)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {eventosFiltrados.length === 0 && (
              <div className="py-12 text-center text-gray-500">No hay eventos registrados para mostrar</div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
