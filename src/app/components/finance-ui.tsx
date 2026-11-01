import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import type { Factura } from '../context/DataContext';
import { Card, CardContent } from './ui/card';
import { cn } from './ui/utils';

// ─── Formato y fechas ─────────────────────────────────────────────────────────

export const formatCurrency = (value: number) =>
  new Intl.NumberFormat('es-DO', { style: 'currency', currency: 'DOP' }).format(value);

export const formatDateShort = (value: Date | string) =>
  new Date(value).toLocaleDateString('es-DO', { day: '2-digit', month: 'short', year: 'numeric' });

export const normalizar = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export const hoy = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};

/** Días desde hoy hasta la fecha (negativo = ya pasó). */
export const diasHasta = (fecha: Date | string) => {
  const d = new Date(fecha);
  d.setHours(0, 0, 0, 0);
  return Math.round((d.getTime() - hoy().getTime()) / 86_400_000);
};

export const estaAbierta = (f: Factura) => f.estado === 'Pendiente' || f.estado === 'Parcial';
export const estaVencida = (f: Factura) => estaAbierta(f) && diasHasta(f.fechaVencimiento) < 0;

export const ESTADO_STYLES: Record<Factura['estado'], string> = {
  Pendiente: 'bg-red-50 text-red-700 border-red-200',
  Parcial: 'bg-amber-50 text-amber-700 border-amber-200',
  Pagado: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  Anulada: 'bg-gray-100 text-gray-500 border-gray-200'
};

// ─── Avatar con iniciales ─────────────────────────────────────────────────────

const AVATAR_COLORS = [
  'from-sky-500 to-blue-600',
  'from-rose-500 to-pink-600',
  'from-amber-400 to-orange-500',
  'from-emerald-500 to-teal-600',
  'from-violet-500 to-purple-600',
  'from-cyan-500 to-sky-600'
];

const colorDe = (texto: string) => {
  let hash = 0;
  for (let i = 0; i < texto.length; i++) hash = (hash * 31 + texto.charCodeAt(i)) | 0;
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
};

const iniciales = (nombre: string) => {
  const partes = nombre.trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return '?';
  return (partes.length > 1 ? partes[0][0] + partes[1][0] : partes[0].slice(0, 2)).toUpperCase();
};

export function Avatar({ nombre, size = 'md' }: { nombre: string; size?: 'sm' | 'md' | 'lg' }) {
  return (
    <div
      className={cn(
        'flex shrink-0 items-center justify-center bg-gradient-to-br font-semibold text-white shadow-sm',
        colorDe(nombre),
        size === 'lg' && 'size-14 rounded-xl text-lg',
        size === 'md' && 'size-11 rounded-xl text-sm',
        size === 'sm' && 'size-8 rounded-lg text-xs'
      )}
    >
      {iniciales(nombre)}
    </div>
  );
}

// ─── Tarjeta KPI ──────────────────────────────────────────────────────────────

export function Kpi({ icon: Icon, label, value, hint, tone, onClick, active }: {
  icon: LucideIcon;
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone: string;
  onClick?: () => void;
  active?: boolean;
}) {
  return (
    <Card
      onClick={onClick}
      className={cn(
        'gap-0 py-0 transition-all',
        onClick && 'cursor-pointer hover:shadow-md',
        active && 'ring-2 ring-gray-900'
      )}
    >
      <CardContent className="flex items-center gap-4 p-5">
        <div className={cn('flex size-11 shrink-0 items-center justify-center rounded-xl', tone)}>
          <Icon className="size-5" />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-medium text-gray-500">{label}</p>
          <p className="truncate text-xl font-semibold text-gray-900">{value}</p>
          {hint && <p className="truncate text-xs text-gray-500">{hint}</p>}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Control segmentado ───────────────────────────────────────────────────────

export function Segmented<T extends string>({ value, onChange, options }: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string; count?: number }[];
}) {
  return (
    <div className="inline-flex max-w-full overflow-x-auto rounded-lg bg-gray-100 p-1">
      {options.map(o => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={cn(
            'flex shrink-0 items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-all',
            value === o.value ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-800'
          )}
        >
          {o.label}
          {o.count !== undefined && (
            <span className={cn('rounded-full px-1.5 text-xs', value === o.value ? 'bg-gray-900 text-white' : 'bg-gray-200 text-gray-600')}>
              {o.count}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

// ─── Chip de vencimiento ──────────────────────────────────────────────────────

export function VencimientoChip({ factura }: { factura: Factura }) {
  if (!estaAbierta(factura)) return null;
  const dias = diasHasta(factura.fechaVencimiento);
  if (dias < 0) {
    return (
      <span className="inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-medium text-red-700">
        Vencida hace {Math.abs(dias)} día{Math.abs(dias) !== 1 ? 's' : ''}
      </span>
    );
  }
  if (dias <= 7) {
    return (
      <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-700">
        {dias === 0 ? 'Vence hoy' : `Vence en ${dias} día${dias !== 1 ? 's' : ''}`}
      </span>
    );
  }
  return null;
}
