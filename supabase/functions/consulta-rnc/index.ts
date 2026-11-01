// Edge Function: consulta de RNC / Cédula en la DGII.
// Uso:  GET  /functions/v1/consulta-rnc?rnc=131996035
//       POST /functions/v1/consulta-rnc   { "rnc": "131996035" }
// Solo usuarios con sesión iniciada (verify_jwt activo por defecto).
import { consultarDGII } from './dgii.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' }
  });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  let rnc = '';
  try {
    if (req.method === 'GET') {
      rnc = new URL(req.url).searchParams.get('rnc') ?? '';
    } else if (req.method === 'POST') {
      const body = await req.json().catch(() => ({}));
      rnc = String(body?.rnc ?? '');
    } else {
      return json({ error: true, codigo_http: 405, mensaje: 'Método no permitido.' }, 405);
    }

    const resultado = await consultarDGII(rnc);
    return json(resultado, resultado.codigo_http);
  } catch (e) {
    const mensaje = e instanceof Error && e.name === 'AbortError'
      ? 'La DGII tardó demasiado en responder.'
      : 'error interno del servidor. ha ocurrido un fallo inesperado.';
    console.error('consulta-rnc:', e);
    return json({ error: true, codigo_http: 500, mensaje, rnc_consultado: rnc }, 500);
  }
});
