import { useState, useEffect } from 'react';
import { useData } from '../context/DataContext';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import { Textarea } from './ui/textarea';

// ─── Tipos ────────────────────────────────────────────────────────────────────

type MetodoPago = 'Cheque' | 'Transferencia' | 'Efectivo';

interface PagoDialogProps {
  /** ID de la factura a pagar. Pasar null / undefined cierra el diálogo. */
  facturaId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const ESTADO_INICIAL = {
  monto: '',
  metodoPago: 'Transferencia' as MetodoPago,
  referencia: '',
  notas: '',
};

// ─── Componente ───────────────────────────────────────────────────────────────

export function PagoDialog({ facturaId, open, onOpenChange }: PagoDialogProps) {
  const { facturas, registrarPago } = useData();

  const [form, setForm] = useState(ESTADO_INICIAL);
  const [errores, setErrores] = useState<Partial<typeof ESTADO_INICIAL>>({});

  const factura = facturas.find(f => f.id === facturaId);

  // Pre-llenar el monto con el balance pendiente cuando se abre
  useEffect(() => {
    if (open && factura) {
      setForm({ ...ESTADO_INICIAL, monto: factura.balancePendiente.toString() });
      setErrores({});
    }
  }, [open, facturaId]);

  const requiereReferencia = form.metodoPago !== 'Efectivo';

  // ── Validación ──────────────────────────────────────────────────────────────
  const validar = (): boolean => {
    const nuevosErrores: Partial<typeof ESTADO_INICIAL> = {};

    if (!form.monto || isNaN(parseFloat(form.monto)) || parseFloat(form.monto) <= 0) {
      nuevosErrores.monto = 'Ingrese un monto válido mayor a cero.';
    } else if (factura && parseFloat(form.monto) > factura.balancePendiente) {
      nuevosErrores.monto = `El monto no puede superar el balance pendiente (${formatCurrency(factura.balancePendiente)}).`;
    }

    if (requiereReferencia && !form.referencia.trim()) {
      nuevosErrores.referencia = 'La referencia es obligatoria para este método de pago.';
    }

    setErrores(nuevosErrores);
    return Object.keys(nuevosErrores).length === 0;
  };

  // ── Confirmar pago ──────────────────────────────────────────────────────────
  const handleConfirmar = () => {
    if (!factura || !validar()) return;

    registrarPago({
      facturaId: factura.id,
      numeroFactura: factura.numeroFactura,
      suplidorNombre: factura.suplidorNombre,
      fecha: new Date(),
      monto: parseFloat(form.monto),
      metodoPago: form.metodoPago,
      // En efectivo no aplica referencia; guardamos cadena vacía para no romper el tipo
      referencia: requiereReferencia ? form.referencia.trim() : '',
      notas: form.notas.trim(),
    });

    onOpenChange(false);
  };

  const handleCancelar = () => onOpenChange(false);

  const set = <K extends keyof typeof ESTADO_INICIAL>(key: K, value: string) => {
    setForm(prev => ({ ...prev, [key]: value }));
    // Limpiar error del campo al editar
    if (errores[key]) setErrores(prev => ({ ...prev, [key]: undefined }));
  };

  if (!factura) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Registrar Pago</DialogTitle>
          <DialogDescription>
            {factura.numeroFactura} — {factura.suplidorNombre}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">

          {/* Monto */}
          <div>
            <Label htmlFor="pago-monto">
              Monto del Pago <span className="text-red-500">*</span>
            </Label>
            <Input
              id="pago-monto"
              type="number"
              min="0.01"
              step="0.01"
              value={form.monto}
              onChange={e => set('monto', e.target.value)}
              placeholder="0.00"
              className={errores.monto ? 'border-red-500' : ''}
            />
            {errores.monto && (
              <p className="text-xs text-red-500 mt-1">{errores.monto}</p>
            )}
            <p className="text-xs text-gray-400 mt-1">
              Balance pendiente: {formatCurrency(factura.balancePendiente)}
            </p>
          </div>

          {/* Método de pago */}
          <div>
            <Label>
              Método de Pago <span className="text-red-500">*</span>
            </Label>
            <Select
              value={form.metodoPago}
              onValueChange={v => {
                set('metodoPago', v);
                // Limpiar error de referencia al cambiar método
                if (v === 'Efectivo') setErrores(prev => ({ ...prev, referencia: undefined }));
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Transferencia">Transferencia</SelectItem>
                <SelectItem value="Cheque">Cheque</SelectItem>
                <SelectItem value="Efectivo">Efectivo</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Referencia — oculta en Efectivo */}
          {requiereReferencia && (
            <div>
              <Label htmlFor="pago-referencia">
                Referencia / No. Transacción <span className="text-red-500">*</span>
              </Label>
              <Input
                id="pago-referencia"
                value={form.referencia}
                onChange={e => set('referencia', e.target.value)}
                placeholder={form.metodoPago === 'Cheque' ? 'CHQ-001234' : 'TRF-001234'}
                className={errores.referencia ? 'border-red-500' : ''}
              />
              {errores.referencia && (
                <p className="text-xs text-red-500 mt-1">{errores.referencia}</p>
              )}
            </div>
          )}

          {/* Notas */}
          <div>
            <Label htmlFor="pago-notas">
              Notas{' '}
              <span className="text-gray-400 text-xs font-normal">(opcional)</span>
            </Label>
            <Textarea
              id="pago-notas"
              value={form.notas}
              onChange={e => set('notas', e.target.value)}
              placeholder="Información adicional sobre el pago"
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleCancelar}>
            Cancelar
          </Button>
          <Button onClick={handleConfirmar}>
            Confirmar Pago
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Utilidad local ───────────────────────────────────────────────────────────

function formatCurrency(value: number) {
  return new Intl.NumberFormat('es-DO', {
    style: 'currency',
    currency: 'DOP',
  }).format(value);
}