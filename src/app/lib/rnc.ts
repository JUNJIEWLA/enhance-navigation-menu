// Consulta de RNC / Cédula en la DGII a través de nuestra propia Edge Function de Supabase
// (supabase/functions/consulta-rnc), que consulta directamente la página oficial de la DGII.
// No depende de servidores de terceros.
import { supabase, supabaseKey, supabaseUrl } from '../supabase';

export interface ContribuyenteDGII {
  rnc: string;              // con formato, ej. 131-99603-5
  nombre: string;           // razón social
  nombreComercial: string;
  estado: string;           // ACTIVO, SUSPENDIDO, DADO DE BAJA…
  actividad: string;
  regimen: string;
}

export const soloDigitos = (valor: string) => valor.replace(/\D/g, '');

/** Un RNC tiene 9 dígitos y una cédula 11. */
export const esRncValido = (valor: string) => {
  const d = soloDigitos(valor);
  return d.length === 9 || d.length === 11;
};

export async function consultarRnc(valor: string, signal?: AbortSignal): Promise<ContribuyenteDGII> {
  const rnc = soloDigitos(valor);
  if (!esRncValido(rnc)) {
    throw new Error('El RNC debe tener 9 dígitos o la cédula 11 dígitos.');
  }

  const { data: sesion } = await supabase.auth.getSession();
  const token = sesion.session?.access_token ?? supabaseKey ?? '';

  let res: Response;
  try {
    res = await fetch(`${supabaseUrl}/functions/v1/consulta-rnc?rnc=${rnc}`, {
      headers: { apikey: supabaseKey ?? '', Authorization: `Bearer ${token}` },
      signal
    });
  } catch (e) {
    if ((e as Error).name === 'AbortError') throw e;
    throw new Error('No se pudo conectar con el servicio de consulta de la DGII.');
  }

  let data: Record<string, unknown> | null = null;
  try {
    data = await res.json();
  } catch {
    /* respuesta no JSON */
  }

  if (res.status === 404 && data?.error) {
    throw new Error('Este RNC / cédula no está inscrito como contribuyente en la DGII.');
  }
  if (res.status === 404 || res.status === 401) {
    // 404 sin cuerpo de la función = la función no está desplegada todavía
    throw new Error('El servicio de consulta de RNC no está disponible (función "consulta-rnc" no desplegada o sesión expirada).');
  }
  if (!res.ok || !data || data.error) {
    throw new Error('El servicio de la DGII no respondió correctamente. Intente de nuevo.');
  }

  return {
    rnc: String(data.cedula_rnc || rnc),
    nombre: String(data.nombre_razon_social || ''),
    nombreComercial: String(data.nombre_comercial || ''),
    estado: String(data.estado || ''),
    actividad: String(data.actividad_economica || ''),
    regimen: String(data.regimen_de_pagos || '')
  };
}
