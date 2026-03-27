import { useState } from 'react';
import { Suplidor, useData } from '../context/DataContext';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Plus, Search, MoreVertical, Edit, Trash2, Phone, Mail, MapPin } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../components/ui/dropdown-menu';

export function Suplidores() {
  const { suplidores, facturas, agregarSuplidor, editarSuplidor, eliminarSuplidor, contarFacturasDeSuplidor } = useData();
  const [busqueda, setBusqueda] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogEliminarOpen, setDialogEliminarOpen] = useState(false);
  const [menuAccionesAbierto, setMenuAccionesAbierto] = useState<string | null>(null);
  const [editando, setEditando] = useState(false);
  const [validandoEliminacion, setValidandoEliminacion] = useState(false);
  const [facturasAsociadas, setFacturasAsociadas] = useState(0);
  const [suplidorAEliminar, setSuplidorAEliminar] = useState<Suplidor | null>(null);
  // ── [CAMBIO 3] Error de validación para el campo Nombre ──────────────────
  const [errorNombre, setErrorNombre] = useState('');
  const [suplidorActual, setSuplidorActual] = useState({
    id: '',
    // ── [CAMBIO 1] Campo código añadido al estado ────────────────────────
    codigo: '',
    nombre: '',
    ruc: '',
    telefono: '',
    email: '',
    direccion: ''
  });

  // ── [CAMBIO 1] Genera el siguiente código SUP-XXX secuencial ─────────────
  const generarCodigo = (): string => {
    const numerosExistentes = suplidores
      .map(s => {
        const match = (s as any).codigo?.match(/^SUP-(\d+)$/);
        return match ? parseInt(match[1], 10) : 0;
      });
    const siguiente = numerosExistentes.length > 0 ? Math.max(...numerosExistentes) + 1 : 1;
    return `SUP-${String(siguiente).padStart(3, '0')}`;
  };

  const suplidoresFiltrados = suplidores.filter(s =>
    s.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
    s.ruc.includes(busqueda) ||
    s.email.toLowerCase().includes(busqueda.toLowerCase())
  );

  const calcularDeuda = (suplidorId: string) => {
    return facturas
      .filter(f => f.suplidorId === suplidorId && f.estado !== 'Pagado')
      .reduce((sum, f) => sum + f.balancePendiente, 0);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-DO', {
      style: 'currency',
      currency: 'DOP'
    }).format(value);
  };

  const cerrarMenuAcciones = () => setMenuAccionesAbierto(null);

  const ejecutarDespuesDeCerrarMenu = (accion: () => void) => {
    cerrarMenuAcciones();
    window.setTimeout(accion, 0);
  };

  const abrirDialogNuevo = () => {
    setEditando(false);
    setErrorNombre('');
    setSuplidorActual({
      id: '',
      // ── [CAMBIO 1] Se genera el código automáticamente al abrir el formulario
      codigo: generarCodigo(),
      nombre: '',
      ruc: '',
      telefono: '',
      email: '',
      direccion: ''
    });
    setDialogOpen(true);
  };

  const abrirDialogEditar = (suplidor: typeof suplidores[0]) => {
    setEditando(true);
    setErrorNombre('');
    setSuplidorActual(suplidor as any);
    ejecutarDespuesDeCerrarMenu(() => setDialogOpen(true));
  };

  const handleGuardar = () => {
    // ── [CAMBIO 3] Validación: Nombre no puede estar vacío ni solo espacios ─
    if (!suplidorActual.nombre.trim()) {
      setErrorNombre('El nombre del suplidor es obligatorio.');
      return;
    }

    if (!suplidorActual.ruc) return;

    setErrorNombre('');

    if (editando) {
      editarSuplidor(suplidorActual.id, suplidorActual);
    } else {
      agregarSuplidor({
        codigo: suplidorActual.codigo,
        nombre: suplidorActual.nombre.trim(),
        ruc: suplidorActual.ruc,
        telefono: suplidorActual.telefono,
        email: suplidorActual.email,
        direccion: suplidorActual.direccion
      } as any);
    }

    setDialogOpen(false);
  };

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
    if (!suplidorAEliminar || facturasAsociadas > 0 || validandoEliminacion) {
      return;
    }

    await eliminarSuplidor(suplidorAEliminar.id);
    setDialogEliminarOpen(false);
    setSuplidorAEliminar(null);
    setFacturasAsociadas(0);
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Suplidores</h1>
          <p className="text-gray-500 mt-1">Directorio de proveedores</p>
        </div>
        <Button onClick={abrirDialogNuevo}>
          <Plus className="size-4 mr-2" />
          Nuevo Suplidor
        </Button>
      </div>

      {/* Barra de búsqueda */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 size-4 text-gray-400" />
            <Input
              placeholder="Buscar por nombre, RNC o email..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* Grid de tarjetas de suplidores */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {suplidoresFiltrados.map((suplidor) => {
          const deuda = calcularDeuda(suplidor.id);
          
          return (
            <Card key={suplidor.id} className="hover:shadow-lg transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex justify-between items-start">
                  <div>
                    {/* ── [CAMBIO 1] Muestra el código en la tarjeta ── */}
                    {(suplidor as any).codigo && (
                      <p className="text-xs font-mono text-blue-600 mb-0.5">{(suplidor as any).codigo}</p>
                    )}
                    <CardTitle className="text-lg">{suplidor.nombre}</CardTitle>
                  </div>
                  <DropdownMenu
                    open={menuAccionesAbierto === suplidor.id}
                    onOpenChange={(open) => setMenuAccionesAbierto(open ? suplidor.id : null)}
                  >
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm">
                        <MoreVertical className="size-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onSelect={() => abrirDialogEditar(suplidor)}>
                        <Edit className="size-4 mr-2" />
                        Editar
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        onSelect={() => abrirConfirmacionEliminar(suplidor)}
                        className="text-red-600"
                      >
                        <Trash2 className="size-4 mr-2" />
                        Eliminar
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                <p className="text-sm text-gray-500">RNC: {suplidor.ruc}</p>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Phone className="size-4" />
                  <span>{suplidor.telefono}</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Mail className="size-4" />
                  <span className="truncate">{suplidor.email}</span>
                </div>
                <div className="flex items-start gap-2 text-sm text-gray-600">
                  <MapPin className="size-4 mt-0.5 flex-shrink-0" />
                  <span className="line-clamp-2">{suplidor.direccion}</span>
                </div>
                
                <div className="pt-3 border-t mt-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Balance Pendiente:</span>
                    <span className={`font-semibold ${deuda > 0 ? 'text-red-600' : 'text-green-600'}`}>
                      {formatCurrency(deuda)}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {suplidoresFiltrados.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-gray-500">No se encontraron suplidores</p>
          </CardContent>
        </Card>
      )}

      {/* Dialog para agregar/editar suplidor */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) setErrorNombre(''); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editando ? 'Editar Suplidor' : 'Nuevo Suplidor'}</DialogTitle>
            <DialogDescription>
              Complete la información del suplidor
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* ── [CAMBIO 2] Campo Código: solo lectura en Creación y Edición ── */}
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

            {/* ── [CAMBIO 3] Campo Nombre con validación y mensaje de error ── */}
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
              {errorNombre && (
                <p className="text-xs text-red-500 mt-1">{errorNombre}</p>
              )}
            </div>

            <div>
              <Label htmlFor="ruc">RNC / Cédula</Label>
              <Input
                id="ruc"
                value={suplidorActual.ruc}
                onChange={(e) => setSuplidorActual({ ...suplidorActual, ruc: e.target.value })}
                placeholder="131-45678-9"
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
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleGuardar}>
              {editando ? 'Actualizar' : 'Guardar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
            <Button variant="outline" onClick={() => setDialogEliminarOpen(false)}>
              Cancelar
            </Button>
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