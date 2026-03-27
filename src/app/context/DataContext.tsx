import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '../supabase';
import { useAuth } from './AuthContext';

export interface Suplidor {
  id: string;
  codigo: string;
  nombre: string;
  ruc: string;
  telefono: string;
  email: string;
  direccion: string;
}

export interface Factura {
  id: string;
  numeroFactura: string;
  numeroExterno?: string;                                              // ← [NUEVO] No. físico del proveedor
  suplidorId: string;
  suplidorNombre: string;
  fechaEmision: Date;
  fechaVencimiento: Date;
  montoTotal: number;
  balancePendiente: number;
  estado: 'Pendiente' | 'Parcial' | 'Pagado' | 'Anulada';           // ← [NUEVO] estado Anulada
}

export interface Pago {
  id: string;
  facturaId: string;
  numeroFactura: string;
  suplidorNombre: string;
  fecha: Date;
  monto: number;
  metodoPago: 'Cheque' | 'Transferencia' | 'Efectivo';
  referencia: string;
  notas?: string;
}

export interface EventoHistorial {
  id: string;
  evento: string;
  descripcion: string;
  usuario: string;
  fechaHora: Date;
}

type EventoHistorialInput = {
  evento: string;
  descripcion: string;
  usuario?: string;
};

interface DataContextType {
  suplidores: Suplidor[];
  facturas: Factura[];
  pagos: Pago[];
  historialEventos: EventoHistorial[];
  cargando: boolean;
  agregarSuplidor: (suplidor: Omit<Suplidor, 'id'>) => Promise<void>;
  editarSuplidor: (id: string, suplidor: Partial<Suplidor>) => Promise<void>;
  eliminarSuplidor: (id: string) => Promise<void>;
  agregarFactura: (factura: Omit<Factura, 'id'>) => Promise<void>;
  editarFactura: (id: string, factura: Partial<Factura>) => Promise<void>;
  eliminarFactura: (id: string) => Promise<void>;
  registrarPago: (pago: Omit<Pago, 'id'>) => Promise<void>;
  contarFacturasDeSuplidor: (suplidorId: string) => Promise<number>;
  registrarEvento: (evento: EventoHistorialInput) => Promise<void>;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

export const useData = () => {
  const context = useContext(DataContext);
  if (!context) {
    throw new Error('useData must be used within a DataProvider');
  }
  return context;
};

export const DataProvider = ({ children }: { children: ReactNode }) => {
  const { perfil } = useAuth();
  const [suplidores, setSuplidores] = useState<Suplidor[]>([]);
  const [facturas, setFacturas] = useState<Factura[]>([]);
  const [pagos, setPagos] = useState<Pago[]>([]);
  const [historialEventos, setHistorialEventos] = useState<EventoHistorial[]>([]);
  const [cargando, setCargando] = useState(true);

  const obtenerUsuarioActual = () => {
    if (typeof window === 'undefined') return 'Usuario del sistema';
    return localStorage.getItem('cxp_usuario') || 'Usuario del sistema';
  };

  const agregarEventoLocal = (evento: EventoHistorial) => {
    setHistorialEventos(prev =>
      [evento, ...prev].sort((a, b) => b.fechaHora.getTime() - a.fechaHora.getTime())
    );
  };

  const registrarEvento = async ({ evento, descripcion, usuario }: EventoHistorialInput) => {
    if (!perfil?.empresaId) return;

    const usuarioFinal = usuario || obtenerUsuarioActual();
    const fallback: EventoHistorial = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      evento,
      descripcion,
      usuario: usuarioFinal,
      fechaHora: new Date(),
    };

    const { data, error } = await supabase
      .from('historial_eventos')
      .insert([{ evento, descripcion, usuario: usuarioFinal, empresa_id: perfil.empresaId }])
      .select()
      .single();

    if (error || !data) {
      agregarEventoLocal(fallback);
      return;
    }

    agregarEventoLocal({
      id: data.id,
      evento: data.evento,
      descripcion: data.descripcion,
      usuario: data.usuario || usuarioFinal,
      fechaHora: new Date(data.created_at),
    });
  };

  const contarFacturasDeSuplidor = async (suplidorId: string) => {
    if (!perfil?.empresaId) return 0;

    const { count, error } = await supabase
      .from('facturas')
      .select('*', { head: true, count: 'exact' })
      .eq('empresa_id', perfil.empresaId)
      .eq('suplidor_id', suplidorId)
      .neq('estado', 'Anulada');                                      // ← [NUEVO] no contar anuladas

    if (error) return 0;
    return count || 0;
  };

  // ─── Cargar datos al iniciar ───────────────────────────────────────────────
  useEffect(() => {
    const cargarDatos = async () => {
      if (!perfil?.empresaId) {
        setSuplidores([]);
        setFacturas([]);
        setPagos([]);
        setHistorialEventos([]);
        setCargando(false);
        return;
      }

      setCargando(true);

      // Cargar suplidores
      const { data: supData } = await supabase
        .from('suplidores')
        .select('*')
        .eq('empresa_id', perfil.empresaId)
        .order('created_at', { ascending: false });

      if (supData) {
        setSuplidores(supData.map(s => ({
          id: s.id,
          codigo: s.codigo || '',
          nombre: s.nombre,
          ruc: s.ruc,
          telefono: s.telefono || '',
          email: s.email || '',
          direccion: s.direccion || ''
        })));
      }

      // Cargar facturas — excluye Anuladas de la carga inicial
      const { data: facData } = await supabase
        .from('facturas')
        .select('*, suplidores(nombre)')
        .eq('empresa_id', perfil.empresaId)
        .neq('estado', 'Anulada')                                      // ← [NUEVO] soft delete filter
        .order('created_at', { ascending: false });

      if (facData) {
        setFacturas(facData.map(f => ({
          id: f.id,
          numeroFactura: f.numero || '',
          numeroExterno: f.numero_externo || '',                        // ← [NUEVO]
          suplidorId: f.suplidor_id,
          suplidorNombre: f.suplidores?.nombre || '',
          fechaEmision: new Date(f.fecha),
          fechaVencimiento: new Date(f.fecha_vencimiento),
          montoTotal: f.monto,
          balancePendiente: f.balance_pendiente,
          estado: f.estado as 'Pendiente' | 'Parcial' | 'Pagado' | 'Anulada'
        })));
      }

      // Cargar pagos
      const { data: pagData } = await supabase
        .from('pagos')
        .select('*, facturas(numero, suplidores(nombre))')
        .eq('empresa_id', perfil.empresaId)
        .order('created_at', { ascending: false });

      if (pagData) {
        setPagos(pagData.map(p => ({
          id: p.id,
          facturaId: p.factura_id,
          numeroFactura: p.facturas?.numero || '',
          suplidorNombre: p.facturas?.suplidores?.nombre || '',
          fecha: new Date(p.fecha),
          monto: p.monto,
          metodoPago: p.metodo_pago as 'Cheque' | 'Transferencia' | 'Efectivo',
          referencia: p.nota || '',
          notas: p.nota || ''
        })));
      }

      // Cargar historial
      const { data: histData } = await supabase
        .from('historial_eventos')
        .select('*')
        .eq('empresa_id', perfil.empresaId)
        .order('created_at', { ascending: false })
        .limit(300);

      if (histData) {
        setHistorialEventos(histData.map(h => ({
          id: h.id,
          evento: h.evento,
          descripcion: h.descripcion,
          usuario: h.usuario || 'Usuario del sistema',
          fechaHora: new Date(h.created_at),
        })));
      }

      setCargando(false);
    };

    cargarDatos();
  }, [perfil?.empresaId]);

  // ─── Suplidores ────────────────────────────────────────────────────────────
  const agregarSuplidor = async (suplidor: Omit<Suplidor, 'id'>) => {
    if (!perfil?.empresaId) return;

    const { data, error } = await supabase
      .from('suplidores')
      .insert([{
        empresa_id: perfil.empresaId,
        codigo: suplidor.codigo,
        nombre: suplidor.nombre,
        ruc: suplidor.ruc,
        telefono: suplidor.telefono,
        email: suplidor.email,
        direccion: suplidor.direccion
      }])
      .select()
      .single();

    if (!error && data) {
      setSuplidores(prev => [{ ...suplidor, id: data.id }, ...prev]);
      await registrarEvento({
        evento: 'Creación de Suplidor',
        descripcion: `Se creó el suplidor ${suplidor.nombre} con código ${suplidor.codigo}.`,
      });
    }
  };

  const editarSuplidor = async (id: string, suplidorActualizado: Partial<Suplidor>) => {
    if (!perfil?.empresaId) return;

    const { error } = await supabase
      .from('suplidores')
      .update({
        // codigo excluido intencionalmente — es inmutable tras la creación
        nombre: suplidorActualizado.nombre,
        ruc: suplidorActualizado.ruc,
        telefono: suplidorActualizado.telefono,
        email: suplidorActualizado.email,
        direccion: suplidorActualizado.direccion
      })
      .eq('empresa_id', perfil.empresaId)
      .eq('id', id);

    if (!error) {
      setSuplidores(prev => prev.map(s => s.id === id ? { ...s, ...suplidorActualizado } : s));
      await registrarEvento({
        evento: 'Edición de Suplidor',
        descripcion: `Se actualizó la información del suplidor ${suplidorActualizado.nombre || id}.`,
      });
    }
  };

  const eliminarSuplidor = async (id: string) => {
    if (!perfil?.empresaId) return;

    const suplidor = suplidores.find(s => s.id === id);
    const { error } = await supabase
      .from('suplidores')
      .delete()
      .eq('empresa_id', perfil.empresaId)
      .eq('id', id);

    if (!error) {
      setSuplidores(prev => prev.filter(s => s.id !== id));
      await registrarEvento({
        evento: 'Eliminación de Suplidor',
        descripcion: `Se eliminó el suplidor ${suplidor?.nombre || id}.`,
      });
    }
  };

  // ─── Facturas ──────────────────────────────────────────────────────────────
  const agregarFactura = async (factura: Omit<Factura, 'id'>) => {
    if (!perfil?.empresaId) return;

    const { data, error } = await supabase
      .from('facturas')
      .insert([{
        empresa_id: perfil.empresaId,
        numero: factura.numeroFactura,
        numero_externo: factura.numeroExterno || null,                 // ← [NUEVO]
        suplidor_id: factura.suplidorId,
        fecha: factura.fechaEmision,
        fecha_vencimiento: factura.fechaVencimiento,
        monto: factura.montoTotal,
        balance_pendiente: factura.balancePendiente,
        estado: factura.estado
      }])
      .select()
      .single();

    if (!error && data) {
      setFacturas(prev => [{ ...factura, id: data.id }, ...prev]);
      await registrarEvento({
        evento: 'Creación de Factura',
        descripcion: `Se registró la factura ${factura.numeroFactura}${factura.numeroExterno ? ` (Ref. proveedor: ${factura.numeroExterno})` : ''} del suplidor ${factura.suplidorNombre}.`,
      });
    }
  };

  const editarFactura = async (id: string, facturaActualizada: Partial<Factura>) => {
    if (!perfil?.empresaId) return;

    const { error } = await supabase
      .from('facturas')
      .update({
        // numero excluido intencionalmente — el ID interno FACT-XX es inmutable
        numero_externo: facturaActualizada.numeroExterno ?? null,      // ← [NUEVO]
        suplidor_id: facturaActualizada.suplidorId,
        fecha: facturaActualizada.fechaEmision,
        fecha_vencimiento: facturaActualizada.fechaVencimiento,
        monto: facturaActualizada.montoTotal,
        balance_pendiente: facturaActualizada.balancePendiente,
        estado: facturaActualizada.estado
      })
      .eq('empresa_id', perfil.empresaId)
      .eq('id', id);

    if (!error) {
      setFacturas(prev => prev.map(f => f.id === id ? { ...f, ...facturaActualizada } : f));
      await registrarEvento({
        evento: 'Edición de Factura',
        descripcion: `Se actualizó la factura ${facturaActualizada.numeroFactura || id}.`,
      });
    }
  };

  // ← [CAMBIADO] Soft delete: UPDATE estado = 'Anulada' en vez de DELETE
  const eliminarFactura = async (id: string) => {
    if (!perfil?.empresaId) return;

    const factura = facturas.find(f => f.id === id);
    const { error } = await supabase
      .from('facturas')
      .update({ estado: 'Anulada' })
      .eq('empresa_id', perfil.empresaId)
      .eq('id', id);

    if (!error) {
      // Filtra del estado local para que desaparezca de las vistas activas
      setFacturas(prev => prev.filter(f => f.id !== id));
      await registrarEvento({
        evento: 'Anulación de Factura',
        descripcion: `Se anuló la factura ${factura?.numeroFactura || id}${factura?.numeroExterno ? ` (Ref. proveedor: ${factura.numeroExterno})` : ''}.`,
      });
    }
  };

  // ─── Pagos ─────────────────────────────────────────────────────────────────
  const registrarPago = async (pago: Omit<Pago, 'id'>) => {
    if (!perfil?.empresaId) return;

    const { data, error } = await supabase
      .from('pagos')
      .insert([{
        empresa_id: perfil.empresaId,
        factura_id: pago.facturaId,
        monto: pago.monto,
        fecha: pago.fecha,
        metodo_pago: pago.metodoPago,
        nota: pago.notas
      }])
      .select()
      .single();

    if (!error && data) {
      setPagos(prev => [{ ...pago, id: data.id }, ...prev]);
      await registrarEvento({
        evento: 'Pago Registrado',
        descripcion: `Se realizó un pago de ${new Intl.NumberFormat('es-DO', { style: 'currency', currency: 'DOP' }).format(pago.monto)} a la factura #${pago.numeroFactura}.`,
      });

      // Actualizar balance de la factura
      const factura = facturas.find(f => f.id === pago.facturaId);
      if (factura) {
        const nuevoBalance = factura.balancePendiente - pago.monto;
        const nuevoEstado = nuevoBalance <= 0 ? 'Pagado' : 'Parcial';

        await supabase
          .from('facturas')
          .update({ balance_pendiente: nuevoBalance, estado: nuevoEstado })
          .eq('empresa_id', perfil.empresaId)
          .eq('id', pago.facturaId);

        setFacturas(prev => prev.map(f =>
          f.id === pago.facturaId
            ? { ...f, balancePendiente: nuevoBalance, estado: nuevoEstado as 'Pagado' | 'Parcial' }
            : f
        ));
      }
    }
  };

  return (
    <DataContext.Provider value={{
      suplidores,
      facturas,
      pagos,
      historialEventos,
      cargando,
      agregarSuplidor,
      editarSuplidor,
      eliminarSuplidor,
      agregarFactura,
      editarFactura,
      eliminarFactura,
      registrarPago,
      contarFacturasDeSuplidor,
      registrarEvento
    }}>
      {children}
    </DataContext.Provider>
  );
};