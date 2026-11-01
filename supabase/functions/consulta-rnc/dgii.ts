// Consulta de RNC / Cédula directamente en la página oficial de la DGII.
// Es la misma lógica de api_rnc_dgii.py (nsmdeveloper/api_consulta_rnc_cedula_dgii),
// portada a TypeScript para correr en nuestra propia Edge Function, sin servidores de terceros.
// No usa APIs específicas de Deno, así que también se puede probar con Node 18+.

export const DGII_RNC_URL = 'https://dgii.gov.do/app/WebApps/ConsultasWeb2/ConsultasWeb/consultas/rnc.aspx';
const TIMEOUT_MS = 20_000;

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (compatible; ConsultaRNC/1.0)',
  'Accept-Language': 'es-ES,es;q=0.9'
};

export interface ResultadoDGII {
  error: boolean;
  codigo_http: number;
  mensaje: string;
  rnc_consultado: string;
  [campo: string]: unknown;
}

// ─── Utilidades de HTML (sin dependencias) ────────────────────────────────────

const ENTIDADES: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
  aacute: 'á', eacute: 'é', iacute: 'í', oacute: 'ó', uacute: 'ú', ntilde: 'ñ',
  Aacute: 'Á', Eacute: 'É', Iacute: 'Í', Oacute: 'Ó', Uacute: 'Ú', Ntilde: 'Ñ', uuml: 'ü', Uuml: 'Ü'
};

function decodificar(texto: string): string {
  return texto.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (m, ent: string) => {
    if (ent[0] === '#') {
      const code = ent[1].toLowerCase() === 'x' ? parseInt(ent.slice(2), 16) : parseInt(ent.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : m;
    }
    return ENTIDADES[ent] ?? m;
  });
}

/** Texto visible de un fragmento HTML (equivale a get_text(strip=True)). */
function textoPlano(html: string): string {
  return decodificar(html.replace(/<[^>]*>/g, '')).replace(/\s+/g, ' ').trim();
}

function atributo(tag: string, nombre: string): string | null {
  const m = tag.match(new RegExp(`\\b${nombre}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i'));
  return m ? decodificar(m[2] ?? m[3] ?? m[4] ?? '') : null;
}

const sinAcentos = (t: string) =>
  t.replace(/é/g, 'e').replace(/ó/g, 'o').replace(/í/g, 'i').replace(/á/g, 'a').replace(/ú/g, 'u').replace(/ñ/g, 'n');

/** Inputs ocultos de ASP.NET (__VIEWSTATE, __EVENTVALIDATION, …). */
function inputsOcultos(html: string): Record<string, string> {
  const res: Record<string, string> = {};
  for (const tag of html.match(/<input\b[^>]*>/gi) ?? []) {
    if ((atributo(tag, 'type') ?? '').toLowerCase() !== 'hidden') continue;
    const name = atributo(tag, 'name');
    if (name) res[name] = atributo(tag, 'value') ?? '';
  }
  return res;
}

/** Convierte la página de respuesta de la DGII en un objeto (equivale a parse_result_table). */
function leerResultado(html: string): Record<string, unknown> {
  // 1. Página de error genérica
  const titulo = textoPlano(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? '');
  if (['error', 'bad request', 'not found'].some((k) => titulo.toLowerCase().includes(k))) {
    const h1 = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1];
    const p = html.match(/<p[^>]*>([\s\S]*?)<\/p>/i)?.[1];
    let msg = titulo;
    if (h1) msg += `: ${textoPlano(h1)}`;
    if (p) msg += ` - ${textoPlano(p)}`;
    return { error: true, mensaje: sinAcentos(msg).toLowerCase() };
  }

  // 2. Mensaje de negocio de la DGII (p. ej. "no se encuentra inscrito como contribuyente")
  const span = html.match(/<span[^>]*id=["']cphMain_lblInformacion["'][^>]*>([\s\S]*?)<\/span>/i);
  if (span && textoPlano(span[1])) {
    return { error: true, mensaje: sinAcentos(textoPlano(span[1])).toLowerCase() };
  }

  // 3. Tabla de resultados
  const tabla = html.match(/<table[^>]*id=["'][^"']*dvDatosContribuyentes[^"']*["'][^>]*>([\s\S]*?)<\/table>/i);
  const datos: Record<string, unknown> = {};
  if (tabla) {
    for (const fila of tabla[1].match(/<tr[^>]*>[\s\S]*?<\/tr>/gi) ?? []) {
      const celdas = [...fila.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map((c) => textoPlano(c[1]));
      if (celdas.length === 2) {
        const clave = sinAcentos(celdas[0].replace(/:/g, '').replace(/\//g, '_').replace(/ /g, '_')).toLowerCase();
        datos[clave] = celdas[1];
      }
    }
  }
  return datos;
}

// ─── Cookies (equivale a requests.Session) ────────────────────────────────────

function cookiesDe(res: Response): string {
  const h = res.headers as Headers & { getSetCookie?: () => string[] };
  const lista = typeof h.getSetCookie === 'function'
    ? h.getSetCookie()
    : (res.headers.get('set-cookie') ?? '').split(/,(?=\s*[^;,=\s]+=)/);
  return lista.map((c) => c.split(';')[0].trim()).filter(Boolean).join('; ');
}

async function conTiempoLimite(url: string, init: RequestInit): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } finally {
    clearTimeout(t);
  }
}

// ─── Consulta ────────────────────────────────────────────────────────────────

export async function consultarDGII(rncEntrada: string): Promise<ResultadoDGII> {
  const rnc = String(rncEntrada ?? '').replace(/\D/g, '');
  if (rnc.length !== 9 && rnc.length !== 11) {
    return {
      error: true,
      codigo_http: 400,
      mensaje: "solicitud incorrecta: el campo 'rnc' es obligatorio y debe tener 9 o 11 dígitos.",
      rnc_consultado: rnc
    };
  }

  // 1. Cargar el formulario para obtener __VIEWSTATE y la cookie de sesión
  const r1 = await conTiempoLimite(DGII_RNC_URL, { headers: HEADERS });
  if (r1.status !== 200) {
    return { error: true, codigo_http: 502, mensaje: `No se pudo acceder a la página DGII (HTTP ${r1.status})`, rnc_consultado: rnc };
  }
  const cookie = cookiesDe(r1);
  const payload = new URLSearchParams({
    __EVENTTARGET: '',
    __EVENTARGUMENT: '',
    ...inputsOcultos(await r1.text()),
    'ctl00$cphMain$txtRNCCedula': rnc,
    'ctl00$cphMain$btnBuscarPorRNC': 'BUSCAR'
  });

  // 2. Enviar el formulario
  const r2 = await conTiempoLimite(DGII_RNC_URL, {
    method: 'POST',
    headers: {
      ...HEADERS,
      'Content-Type': 'application/x-www-form-urlencoded',
      ...(cookie ? { Cookie: cookie } : {})
    },
    body: payload.toString()
  });
  if (r2.status !== 200) {
    return { error: true, codigo_http: 502, mensaje: `Error al enviar el formulario a la DGII (HTTP ${r2.status})`, rnc_consultado: rnc };
  }

  const datos = leerResultado(await r2.text());
  if (datos.error === true) {
    return { ...datos, error: true, codigo_http: 404, mensaje: String(datos.mensaje), rnc_consultado: rnc };
  }
  if (!datos.cedula_rnc && !datos.nombre_razon_social) {
    return { error: true, codigo_http: 404, mensaje: 'el rnc/cedula consultado no se encuentra inscrito como contribuyente.', rnc_consultado: rnc };
  }
  return { error: false, codigo_http: 200, mensaje: 'Consulta Exitosa', ...datos, rnc_consultado: rnc };
}
