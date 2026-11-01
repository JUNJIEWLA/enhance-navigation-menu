import { createContext, ReactNode, useContext, useEffect, useState } from 'react';
import { ZH, ZH_PATRONES } from './zh';

export type Idioma = 'es' | 'zh';

interface LanguageContextType {
  idioma: Idioma;
  setIdioma: (idioma: Idioma) => void;
  alternarIdioma: () => void;
}

const STORAGE_KEY = 'app-idioma';
const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

// ─── Traducción de un texto ───────────────────────────────────────────────────

const LETRA = /[A-Za-zÁÉÍÓÚÜÑáéíóúüñ¿¡]/;
// Signos que pueden rodear a una palabra (p. ej. "Facturas (", "RNC: ", "Sin resultados para “")
const BORDE_INICIO = /^[\s\d%·•—–\-:;,.()[\]“”"'¿¡?#/+]*/;
const BORDE_FIN = /[\s:;,()[\]·•—–\-“”"'#/+]*$/;

function traducirNucleo(texto: string): string | null {
  const directo = ZH[texto];
  if (directo !== undefined) return directo;
  for (const [re, fn] of ZH_PATRONES) {
    const m = texto.match(re);
    if (m) return fn(...m);
  }
  return null;
}

/** Devuelve el texto en chino, o null si no hay traducción. Conserva espacios y signos alrededor. */
export function traducirTexto(original: string): string | null {
  if (!LETRA.test(original)) return null;
  const recortado = original.trim();
  if (!recortado) return null;

  const inicioEsp = original.slice(0, original.indexOf(recortado));
  const finEsp = original.slice(inicioEsp.length + recortado.length);

  let res = traducirNucleo(recortado);
  if (res === null) {
    const inicio = recortado.match(BORDE_INICIO)?.[0] ?? '';
    const resto = recortado.slice(inicio.length);
    const fin = resto.match(BORDE_FIN)?.[0] ?? '';
    const nucleo = resto.slice(0, resto.length - fin.length);
    if (nucleo && nucleo !== recortado) {
      const t = traducirNucleo(nucleo) ?? traducirNucleo(nucleo.replace(/[.:]$/, ''));
      if (t !== null) res = inicio + t + (nucleo.endsWith(':') && !fin ? '：' : fin.replace(':', '：'));
    } else if (/[.:]$/.test(recortado)) {
      const t = traducirNucleo(recortado.slice(0, -1));
      if (t !== null) res = t + (recortado.endsWith(':') ? '：' : '');
    }
  }
  return res === null ? null : inicioEsp + res + finEsp;
}

// ─── Traductor del DOM ────────────────────────────────────────────────────────
// Traduce lo que React pinta en pantalla (incluidos diálogos y menús en portales)
// sin tener que modificar cada componente. Al volver a español restaura los textos.

const ATRIBUTOS = ['placeholder', 'title', 'aria-label'] as const;
const OMITIR = new Set(['SCRIPT', 'STYLE', 'TEXTAREA', 'INPUT', 'CODE', 'PRE']);

const textoOriginal = new Map<Text, string>();
const textoTraducido = new WeakMap<Text, string>();
const atribOriginal = new Map<Element, Record<string, string>>();

function omitido(el: Element | null): boolean {
  for (let n = el; n; n = n.parentElement) {
    if (OMITIR.has(n.tagName) || n.getAttribute('translate') === 'no' || n.hasAttribute('data-no-traducir')) return true;
    if ((n as HTMLElement).isContentEditable) return true;
  }
  return false;
}

function traducirNodoTexto(nodo: Text) {
  const actual = nodo.nodeValue ?? '';
  if (textoTraducido.get(nodo) === actual) return; // ya está traducido
  if (omitido(nodo.parentElement)) return;
  const t = traducirTexto(actual);
  if (t === null || t === actual) {
    textoOriginal.delete(nodo);
    return;
  }
  textoOriginal.set(nodo, actual);
  textoTraducido.set(nodo, t);
  nodo.nodeValue = t;
}

function traducirAtributos(el: Element) {
  for (const attr of ATRIBUTOS) {
    const valor = el.getAttribute(attr);
    if (!valor) continue;
    const guardados = atribOriginal.get(el);
    if (guardados && guardados[`__t_${attr}`] === valor) continue;
    const t = traducirTexto(valor);
    if (t === null || t === valor) continue;
    const reg = guardados ?? {};
    reg[attr] = valor;
    reg[`__t_${attr}`] = t;
    atribOriginal.set(el, reg);
    el.setAttribute(attr, t);
  }
}

function traducirArbol(raiz: Node) {
  if (raiz.nodeType === Node.TEXT_NODE) {
    traducirNodoTexto(raiz as Text);
    return;
  }
  if (raiz.nodeType !== Node.ELEMENT_NODE) return;
  const el = raiz as Element;
  if (omitido(el)) return;
  traducirAtributos(el);
  el.querySelectorAll('[placeholder],[title],[aria-label]').forEach(traducirAtributos);
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) traducirNodoTexto(n as Text);
}

function restaurarTodo() {
  textoOriginal.forEach((orig, nodo) => {
    if (nodo.isConnected && textoTraducido.get(nodo) === nodo.nodeValue) nodo.nodeValue = orig;
    textoTraducido.delete(nodo);
  });
  textoOriginal.clear();
  atribOriginal.forEach((reg, el) => {
    for (const attr of ATRIBUTOS) {
      if (reg[attr] !== undefined && el.getAttribute(attr) === reg[`__t_${attr}`]) el.setAttribute(attr, reg[attr]);
    }
  });
  atribOriginal.clear();
}

function iniciarTraductor(): () => void {
  const tituloOriginal = document.title;
  const tituloZh = traducirTexto(document.title);
  if (tituloZh) document.title = tituloZh;

  traducirArbol(document.body);

  const observer = new MutationObserver((mutaciones) => {
    for (const m of mutaciones) {
      if (m.type === 'characterData') {
        traducirNodoTexto(m.target as Text);
      } else if (m.type === 'childList') {
        m.addedNodes.forEach(traducirArbol);
      } else if (m.type === 'attributes' && m.target instanceof Element) {
        if (!omitido(m.target)) traducirAtributos(m.target);
      }
    }
  });
  observer.observe(document.body, {
    subtree: true,
    childList: true,
    characterData: true,
    attributes: true,
    attributeFilter: [...ATRIBUTOS]
  });

  // Limpieza periódica de nodos que ya no están en pantalla
  const limpieza = window.setInterval(() => {
    textoOriginal.forEach((_, nodo) => { if (!nodo.isConnected) textoOriginal.delete(nodo); });
    atribOriginal.forEach((_, el) => { if (!el.isConnected) atribOriginal.delete(el); });
  }, 30_000);

  return () => {
    observer.disconnect();
    window.clearInterval(limpieza);
    restaurarTodo();
    document.title = tituloOriginal;
  };
}

// ─── Provider ─────────────────────────────────────────────────────────────────

function idiomaGuardado(): Idioma {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'zh' ? 'zh' : 'es';
  } catch {
    return 'es';
  }
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [idioma, setIdioma] = useState<Idioma>(idiomaGuardado);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, idioma);
    } catch {
      /* sin almacenamiento */
    }
    document.documentElement.lang = idioma === 'zh' ? 'zh-CN' : 'es';
    if (idioma !== 'zh') return;
    return iniciarTraductor();
  }, [idioma]);

  return (
    <LanguageContext.Provider
      value={{ idioma, setIdioma, alternarIdioma: () => setIdioma((i) => (i === 'zh' ? 'es' : 'zh')) }}
    >
      {children}
    </LanguageContext.Provider>
  );
}

export function useIdioma() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useIdioma debe usarse dentro de LanguageProvider');
  return ctx;
}
