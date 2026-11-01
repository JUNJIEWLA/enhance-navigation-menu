import { useState, useEffect } from 'react';
import { Factura, useData } from '../context/DataContext';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Alert, AlertDescription, AlertTitle } from './ui/alert';
import { cn } from './ui/utils';
import { Banknote, Landmark, Loader2, ReceiptText } from 'lucide-react';

// ─── Tipos ────────────────────────────────────────────────────────────────────

type MetodoPago = 'Cheque' | 'Transferencia' | 'Efectivo';

const ESTADO_INICIAL = {
  monto: '',
  metodoPago: 'Transferencia' as MetodoPago,
  referencia: '',
  notas: '',
};

type Errores = Partial<Record<keyof typeof ESTADO_INICIAL, string>>;

const METODOS: { value: MetodoPago; label: string; icon: typeof Banknote }[] = [
  { value: 'Transferencia', label: 'Transferencia', icon: Landmark },
  { value: 'Cheque', label: 'Cheque', icon: ReceiptText },
  { value: 'Efectivo', label: 'Efectivo', icon: Banknote },
];

function formatCurrency(value: number) {
  return new Intl.NumberFormat('es-DO', { style: 'currency', currency: 'DOP' }).format(value);
}

// ─── Formulario reutilizable (se usa en diálogo o dentro de un panel) ─────────

interface PagoFormProps {
  factura: Factura;
  onSuccess: (monto: number) => void;
  onCancel: () => void;
  /** Texto del botón cancelar (por defecto "Cancelar") */
  cancelLabel?: string;
}

export function PagoForm({ factura, onSuccess, onCancel, cancelLabel = 'Cancelar' }: PagoFormProps) {
  const { registrarPago } = useData();

  const [form, setForm] = useState({ ...ESTADO_INICIAL, monto: factura.balancePendiente.toFixed(2) });
  const [errores, setErrores] = useState<Errores>({});
  const [errorGeneral, setErrorGeneral] = useState('');
  const [enviando, setEnviando] = useState(false);

  // Reiniciar si cambia la factura
  useEffect(() => {
    setForm({ ...ESTADO_INICIAL, monto: factura.balancePendiente.toFixed(2) });
    setErrores({});
    setErrorGeneral('');
  }, [factura.id]);

  const requiereReferencia = form.metodoPago !== 'Efectivo';
  const montoNum = parseFloat(form.monto);
  const restante = isNaN(montoNum) ? factura.balancePendiente : Math.max(factura.balancePendiente - montoNum, 0);

  const validar = (): boolean => {
    const nuevos: Errores = {};

    if (!form.monto || isNaN(montoNum) || montoNum <= 0) {
      nuevos.monto = 'Ingrese un monto válido mayor a cero.';
    } else if (montoNum > factura.balancePendiente + 0.001) {
      nuevos.monto = `El monto no puede superar el balance pendiente (${formatCurrency(factura.balancePendiente)}).`;
    }

    if (requiereReferencia && !form.referencia.trim()) {
      nuevos.referencia = 'La referencia es obligatoria para este método de pago.';
    }

    setErrores(nuevos);
    return Object.keys(nuevos).length === 0;
  };

  const handleConfirmar = async () => {
    if (enviando || !validar()) return;
    setEnviando(true);
    setErrorGeneral('');

    try {
      await registrarPago({
        facturaId: factura.id,
        numeroFactura: factura.numeroFactura,
        suplidorNombre: factura.suplidorNombre,
        fecha: new Date(),
        monto: Math.round(montoNum * 100) / 100,
        metodoPago: form.metodoPago,
        referencia: requiereReferencia ? form.referencia.trim() : '',
        notas: form.notas.trim(),
      });
      onSuccess(montoNum);
    } catch (error) {
      setErrorGeneral(error instanceof Error ? error.message : 'No se pudo registrar el pago.');
    } finally {
      setEnviando(false);
    }
  };

  const set = <K extends keyof typeof ESTADO_INICIAL>(key: K, value: string) => {
    setForm(prev => ({ ...prev, [key]: value }));
    if (errores[key]) setErrores(prev => ({ ...prev, [key]: undefined }));
  };

  const atajos = [
    { label: 'Total', valor: factura.balancePendiente },
    { label: '50%', valor: factura.balancePendiente / 2 },
    { label: '25%', valor: factura.balancePendiente / 4 },
  ];

  return (
    <form
      className="space-y-5"
      onSubmit={(e) => {
        e.preventDefault();
        handleConfirmar();
      }}
    >
      {/* Resumen de la factura */}
      <div className="grid grid-cols-3 gap-2 rounded-xl border bg-gray-50 p-3 text-center">
        <div>
          <p className="text-[11px] uppercase text-gray-500">Monto factura</p>
          <p className="text-sm font-semibold text-gray-900">{formatCurrency(factura.montoTotal)}</p>
        </div>
        <div>
          <p className="text-[11px] uppercase text-gray-500">Pendiente</p>
          <p className="text-sm font-semibold text-red-600">{formatCurrency(factura.balancePendiente)}</p>
        </div>
        <div>
          <p className="text-[11px] uppercase text-gray-500">Quedará</p>
          <p className={cn('text-sm font-semibold', restante <= 0.001 ? 'text-emerald-600' : 'text-gray-900')}>
            {formatCurrency(restante)}
          </p>
        </div>
      </div>

      {errorGeneral && (
        <Alert variant="destructive">
          <AlertTitle>No se pudo registrar el pago</AlertTitle>
          <AlertDescription>{errorGeneral}</AlertDescription>
        </Alert>
      )}

      {/* Monto */}
      <div>
        <Label htmlFor="pago-monto">
          Monto del pago <span className="text-red-500">*</span>
        </Label>
        <div className="relative mt-1.5">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">RD$</span>
          <Input
            id="pago-monto"
            type="number"
            min="0.01"
            step="0.01"
            value={form.monto}
            onChange={e => set('monto', e.target.value)}
            placeholder="0.00"
            className={cn('pl-12 text-base font-semibold', errores.monto && 'border-red-500')}
            autoFocus
          />
        </div>
        <div className="mt-2 flex gap-1.5">
          {atajos.map(a => (
            <button
              key={a.label}
              type="button"
              onClick={() => set('monto', a.valor.toFixed(2))}
              className="rounded-full border px-2.5 py-0.5 text-xs text-gray-600 transition-colors hover:border-gray-900 hover:text-gray-900"
            >
              {a.label}
            </button>
          ))}
        </div>
        {errores.monto && <p className="mt-1 text-xs text-red-500">{errores.monto}</p>}
      </div>

      {/* Método de pago */}
      <div>
        <Label>
          Método de pago <span className="text-red-500">*</span>
        </Label>
        <div className="mt-1.5 grid grid-cols-3 gap-2">
          {METODOS.map(m => {
            const Icon = m.icon;
            const activo = form.metodoPago === m.value;
            return (
              <button
                key={m.value}
                type="button"
                onClick={() => {
                  set('metodoPago', m.value);
                  if (m.value === 'Efectivo') setErrores(prev => ({ ...prev, referencia: undefined }));
                }}
                className={cn(
                  'flex flex-col items-center gap-1 rounded-xl border p-3 text-xs font-medium transition-all',
                  activo ? 'border-gray-900 bg-gray-900 text-white shadow-sm' : 'text-gray-600 hover:border-gray-400'
                )}
              >
                <Icon className="size-5" />
                {m.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Referencia */}
      {requiereReferencia && (
        <div>
          <Label htmlFor="pago-referencia">
            {form.metodoPago === 'Cheque' ? 'No. de cheque' : 'Referencia / No. transacción'} <span className="text-red-500">*</span>
          </Label>
          <Input
            id="pago-referencia"
            value={form.referencia}
            onChange={e => set('referencia', e.target.value)}
            placeholder={form.metodoPago === 'Cheque' ? 'CHQ-001234' : 'TRF-001234'}
            className={cn('mt-1.5', errores.referencia && 'border-red-500')}
          />
          {errores.referencia && <p className="mt-1 text-xs text-red-500">{errores.referencia}</p>}
        </div>
      )}

      {/* Notas */}
      <div>
        <Label htmlFor="pago-notas">
          Notas <span className="text-xs font-normal text-gray-400">(opcional)</span>
        </Label>
        <Textarea
          id="pago-notas"
          value={form.notas}
          onChange={e => set('notas', e.target.value)}
          placeholder="Información adicional sobre el pago"
          rows={2}
          className="mt-1.5"
        />
      </div>

      <div className="flex justify-end gap-2 pt-1">
        <Button type="button" variant="outline" onClick={onCancel} disabled={enviando}>
          {cancelLabel}
        </Button>
        <Button type="submit" disabled={enviando} className="min-w-[160px]">
          {enviando ? (
            <>
              <Loader2 className="size-4 mr-2 animate-spin" /> Registrando…
            </>
          ) : (
            <>Confirmar pago{!isNaN(montoNum) && montoNum > 0 ? ` · ${formatCurrency(montoNum)}` : ''}</>
          )}
        </Button>
      </div>
    </form>
  );
}

// ─── Diálogo (Cuentas por Pagar, Dashboard) ───────────────────────────────────

interface PagoDialogProps {
  /** ID de la factura a pagar. Pasar null / undefined cierra el diálogo. */
  facturaId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (monto: number) => void;
}

export function PagoDialog({ facturaId, open, onOpenChange, onSuccess }: PagoDialogProps) {
  const { facturas } = useData();
  const factura = facturas.find(f => f.id === facturaId);

  if (!factura) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Registrar pago</DialogTitle>
          <DialogDescription>
            {factura.numeroFactura}
            {factura.numeroExterno ? ` (Ref. ${factura.numeroExterno})` : ''} — {factura.suplidorNombre}
          </DialogDescription>
        </DialogHeader>
        <PagoForm
          factura={factura}
          onCancel={() => onOpenChange(false)}
          onSuccess={(monto) => {
            onSuccess?.(monto);
            onOpenChange(false);
          }}
        />
      </DialogContent>
    </Dialog>
  );
}
