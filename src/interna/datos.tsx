/*
 * Datos de la app interna. Carga del backend todo lo que la pantalla necesita, lo pasa a la forma del prototipo
 * (fechas en milisegundos, sin nulos) en el almacén `S` de motor.ts, y avisa a las pantallas para que se vuelvan a pintar.
 * Los módulos que el backend todavía no tiene (caja, sueldos, liquidaciones…) llegan vacíos hasta que existan.
 */
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import * as api from "../api/servicios";
import { FalloApi } from "../api/cliente";
import type * as T from "../api/tipos";
import { S, yo, type Almacen, type Pedido, type Cliente, type Persona, type Movimiento, type Recaudo, type Liquidacion, type Jornada, type CajaMov, type Cuenta, type UsuarioS } from "./motor";
import { DEMO, datosDemo } from "./demo";
import { conectar } from "./acciones";
import { E } from "./estado";
import { crearCacheConsultas } from "../lib/queryCache";

const ms = (x: string | null | undefined) => (x ? new Date(x).getTime() || 0 : 0);
const msONulo = (x: string | null | undefined) => (x ? new Date(x).getTime() || null : null);

export const aPedido = (p: T.Pedido): Pedido => ({
  guia: p.guia, n: p.n, estado: p.estado, creado: ms(p.creado), entregado: msONulo(p.entregado),
  mensajeroId: p.mensajeroId || "", clienteId: p.clienteId || "", clienteNombre: p.clienteNombre || "",
  valorServicio: p.valorServicio || 0, aCobrar: p.aCobrar || 0, destinatario: p.destinatario || "", valorCobrado: p.valorCobrado || 0,
  metodo: p.metodo || "", cuentaJs: p.cuentaJs || "", difCobro: p.difCobro || 0, difRevisada: !!p.difRevisada,
  motivoDev: p.motivoDev || "", notaDev: p.notaDev || "", cobrarDev: !!p.cobrarDev, destinoDev: p.destinoDev || "", reintentoDe: p.reintentoDe || "", reintentos: p.reintentos || [], reintentoPedido: msONulo(p.reintentoPedido), cambio: !!p.cambio, cambioRecibido: msONulo(p.cambioRecibido),
  gasto: p.gasto || 0, gastoNota: p.gastoNota || "", domiPagado: !!p.domiPagado, domiPagoMedio: p.domiPagoMedio || "",
  domiPagoValor: p.domiPagoValor ?? null, domiPagoFecha: ms(p.domiPagoFecha), domiPagoUid: p.domiPagoUid || "",
  intentos: (p.intentos || []).map(i => ({ fecha: ms(i.fecha), motivo: i.motivo || "", nota: i.nota || "" })), mini: p.mini || "", sinFoto: !!p.sinFoto,
  solicitud: p.solicitud ?? null,
});
const aCliente = (c: T.Cliente): Cliente => ({ id: c.id, nombre: c.nombre, telefono: c.telefono || "", tarifa: c.tarifa || 0 });
export const aPersona = (m: T.Mensajero): Persona => ({ id: m.id, nombre: m.nombre, telefono: m.telefono || "", tipo: m.tipo || "mensajero", tarifa: m.tarifa || 0 });
export const aMov = (m: T.Movimiento): Movimiento => ({ id: m.id, clienteId: m.clienteId, tipo: m.tipo, valor: m.valor || 0, medio: m.medio || "", nota: m.nota || "", fecha: ms(m.fecha), porUid: m.porUid || "", porNombre: m.porNombre || "", medioAntes: m.medioAntes || undefined, mensajeroId: m.mensajeroId || undefined });
export const aRec = (r: T.Recaudo): Recaudo => ({ id: r.id, mensajeroId: r.mensajeroId, valor: r.valor || 0, medio: r.medio || "efectivo", nota: r.nota || "", fecha: ms(r.fecha), porUid: r.porUid || "", porNombre: r.porNombre || "", medioAntes: r.medioAntes || undefined });
export const aLiq = (l: T.Liquidacion): Liquidacion => ({ ...l, fecha: ms(l.fecha), desde: ms(l.desde), guias: l.guias ?? undefined });
export const aCaja = (c: T.CajaMovimiento): CajaMov => ({
  id: c.id, tipo: c.tipo, cat: c.cat, valor: c.valor || 0, medio: (c.medio || "") as CajaMov["medio"], concepto: c.concepto || "", fecha: ms(c.fecha),
  personaId: c.personaId || "", personaUid: c.personaUid || "", cuentaId: c.cuentaId || "", semana: c.semana || "", porUid: c.porUid || "", porNombre: c.porNombre || "",
  devuelto: c.devuelto || 0, adelantoId: c.adelantoId || "", deLiquidacion: c.deLiquidacion || "", inicial: !!c.inicial, nivel: !!c.nivel,
  arqueoId: c.arqueoId || "", esperado: c.esperado || undefined, contado: c.contado || undefined, medioAntes: c.medioAntes || undefined,
});
export const aUsuario = (u: T.Usuario): UsuarioS => ({ uid: u.id, email: u.email, nombre: u.nombre, rol: u.rol, clienteId: u.clienteId || "", mensajeroId: u.mensajeroId || "", activo: u.activo !== false, status: u.status });
const porId = <X, K extends keyof X>(xs: X[], k: K) => Object.fromEntries(xs.map(x => [String(x[k]), x])) as Record<string, X>;

/* ---------- Carga por colección, bajo demanda ----------
   Antes, al entrar se traía todo (todas las guías, clientes, movimientos, caja, sueldos…) y se volvía a traer todo
   cada 45 segundos, aunque la pantalla abierta no lo usara. Ahora cada vista dice qué colecciones necesita
   (`necesarias()`), se traen solo esas, y una colección traída hace menos de 30 segundos no se vuelve a pedir al
   cambiar de pestaña (queryCache.ts). La recarga periódica y la de después de guardar solo piden lo que está en uso. */

export type Coleccion = "pedidos" | "clientes" | "mensajeros" | "usuarios" | "movimientos" | "recaudos" | "liquidaciones" | "jornadas" | "cajamovs" | "cuentas" | "corte";
const TODAS: Coleccion[] = ["pedidos", "clientes", "mensajeros", "usuarios", "movimientos", "recaudos", "liquidaciones", "jornadas", "cajamovs", "cuentas", "corte"];
/* Qué usa cada pestaña de la oficina, contando los cálculos de motor.ts que llama (saldos, períodos, lo ya contado
   en un arqueo…) y las ventanas que abre. Ante la duda se incluye: una colección de más solo cuesta una petición;
   una de menos daría cifras equivocadas. */
const BASE: Coleccion[] = ["pedidos", "mensajeros", "corte"];
const DE_PESTANA: Record<string, Coleccion[]> = {
  pedidos: [...BASE, "clientes", "cajamovs", "liquidaciones"],
  solicitudes: [...BASE, "clientes"],
  clientes: [...BASE, "clientes", "movimientos", "cajamovs", "usuarios", "recaudos"], // recaudos: hoja Mensajeros del Excel del cuadre
};
/** Colecciones que necesita la vista. El modo mensajero y las pestañas que muestran el resumen de la caja o los sueldos
    (Inicio, Caja, Cuentas, Sueldos, Más) piden todas: esos cálculos cruzan pedidos, movimientos, caja, jornadas y usuarios. */
/** Caja: cada sub-pestaña pide solo lo que usa (la lista y el detalle de liquidaciones y arqueos salen del servidor).
    "caja" y "mensajeros" calculan con todo. Ante la duda, una colección de más es mejor que una de menos. */
const DE_CAJA: Record<string, Coleccion[]> = {
  liquidaciones: ["mensajeros"],
  arqueos: ["mensajeros", "cajamovs", "corte"],
  patinadores: ["mensajeros", "recaudos", "cajamovs", "corte", "liquidaciones"]
};
/** Cuentas: la sub-pestaña Cuentas toma sus cifras del servidor. Movimientos necesita casi todo para el formulario
    (saldo del cliente: guías y movimientos; caja del asistente: caja, recaudos, movimientos, guías, mensajeros y cuentas;
    lo ya contado: corte y caja), pero no liquidaciones, jornadas ni usuarios. Ganancias viene del servidor: solo usa los
    nombres de los clientes y los movimientos (para saber cuándo volver a pedir la lista). */
const DE_CUENTAS: Record<string, Coleccion[]> = {
  // Las cifras y el saldo de las tarjetas vienen del servidor (GET /cuentas/resumen): aquí solo se usan los nombres de las
  // cuentas, los movimientos internos (lo ya contado al quitar) y el corte (día mínimo al registrar).
  cuentas: ["cuentas", "cajamovs", "corte"],
  movimientos: ["pedidos", "clientes", "mensajeros", "movimientos", "recaudos", "cajamovs", "cuentas", "corte"],
  ganancias: ["clientes", "movimientos"]
};
/** La sub-pestaña abierta de las pestañas que cargan por sub-pestaña (para `necesarias`). */
export const subDe = (tab: string) => (tab === "caja" ? E.tabCaja : tab === "cuentas" ? E.tabCuentas : undefined);
export function necesarias(modo: string, tab: string, sub?: string): Coleccion[] {
  if (modo === "patinador") return ["mensajeros"]; // solo para elegir el patinador: su caja la trae su propia consulta
  if (modo === "mensajero") return TODAS;
  if (tab === "caja" && sub && DE_CAJA[sub]) return DE_CAJA[sub];
  if (tab === "cuentas" && sub && DE_CUENTAS[sub]) return DE_CUENTAS[sub];
  return DE_PESTANA[tab] ?? TODAS;
}

/** Todas las guías que el usuario puede ver, de 1000 en 1000. Nunca firma miniaturas: la oficina no las pinta desde aquí
    y las filas del mensajero piden la suya al verse (`interna/miniaturas.ts`). */
async function todosLosPedidos(sinMini: boolean) {
  const out: T.Pedido[] = [];
  let cursor: number | undefined;
  // Si el servidor todavía es de la versión anterior (tope de 500 y sin `sinMini`), responde 400: se sigue con lo de
  // antes, para que la app no se caiga cuando la página se publica antes que el backend.
  let viejo = false;
  for (let i = 0; i < 400; i++) {
    const pedir = () => api.pedidos.listar(viejo ? { limite: 500, cursor } : { limite: 1000, cursor, ...(sinMini ? { sinMini: true } : {}) });
    const r = await pedir().catch(e => {
      if (viejo || !(e instanceof FalloApi) || e.status !== 400) throw e;
      viejo = true;
      return pedir();
    });
    out.push(...r.pedidos);
    if (!r.siguiente) break;
    cursor = r.siguiente;
  }
  return out;
}
/** Todos los clientes, de 500 en 500 (antes se pedían solo los primeros 500). */
async function todosLosClientes() {
  const out: T.Cliente[] = [];
  for (let desde = 0; desde < 200_000; desde += 500) {
    const xs = await api.clientes.listarDesde(desde, 500);
    out.push(...xs);
    if (xs.length < 500) break;
  }
  return out;
}

/** Trae una colección y la deja en S con la forma del prototipo. Lo que el rol no puede ver queda vacío, como antes. */
function cargadorDe(u: T.Usuario, col: Coleccion): () => Promise<(s: Almacen) => void> {
  const oficina = u.rol === "admin" || u.rol === "asistente";
  switch (col) {
    case "pedidos": return async () => { const xs = (await todosLosPedidos(true)).map(aPedido); return s => { s.pedidos = porId(xs, "guia"); }; };
    case "clientes": return async () => { const xs = oficina ? await todosLosClientes() : []; return s => { s.clientes = porId(xs.map(aCliente), "id"); }; };
    case "mensajeros": return async () => {
      const xs = oficina ? await api.mensajeros.listar() : u.mensajeroId ? await api.mensajeros.obtener(u.mensajeroId).then(m => [m]).catch(() => [] as T.Mensajero[]) : [];
      return s => { s.mensajeros = porId(xs.map(aPersona), "id"); };
    };
    case "usuarios": return async () => {
      const us = (u.rol === "admin" ? await api.usuarios.listar() : [u]).map(aUsuario);
      return s => { s.usuarios = porId(us, "uid"); s.vinculos = Object.fromEntries(us.filter(x => x.mensajeroId).map(x => [x.uid, { uid: x.uid, mensajeroId: x.mensajeroId }])); };
    };
    // El mensajero recibe solo los pagos que él anotó en Recepción (los filtra el servidor): suman a lo que debe.
    case "movimientos": return async () => { const xs = oficina || u.mensajeroId ? await api.movimientos.listar() : []; return s => { s.movimientos = porId(xs.map(aMov), "id"); }; };
    case "recaudos": return async () => { const xs = await api.recaudos.listar(); return s => { s.recaudos = porId(xs.map(aRec), "id"); }; };
    case "liquidaciones": return async () => { const xs = await api.liquidaciones.listar(); return s => { s.liquidaciones = porId(xs.map(aLiq), "id"); }; };
    case "jornadas": return async () => { const xs = await api.jornadas.listar(); return s => { s.jornadas = porId(xs as Jornada[], "id"); }; };
    case "cajamovs": return async () => { const xs = await api.cajaMovimientos.listar(); return s => { s.cajamovs = porId(xs.map(aCaja), "id"); }; };
    case "cuentas": return async () => { const xs = oficina ? await api.cuentasInternas.listar() : []; return s => { s.cuentas = porId(xs as Cuenta[], "id"); }; };
    case "corte": return async () => { const c = await api.caja.corte(); return () => { yo.corteRemoto = ms(c); }; };
  }
}

interface Datos {
  version: number;
  /** Sube cuando llega una colección que faltaba (solo para volver a pintar). */
  pinta: number;
  error: string;
  /** Vuelve a pedir al servidor lo que está en pantalla (lo demás queda vencido y se pide al abrirlo). */
  recargar: () => Promise<void>;
  /** Cambia el almacén aquí mismo (con lo que respondió el servidor) y vuelve a pintar. */
  tocar: (fn?: (s: Almacen) => void) => void;
  /** Una vista avisa qué colecciones usa: se traen las que falten o estén vencidas. Devuelve la función para soltarlas. */
  usar: (cols: readonly Coleccion[]) => () => void;
  /** Adelanta la descarga de colecciones sin marcarlas "en uso": no se refrescan solas cada 45 s, solo quedan listas para cuando se abra la pestaña. */
  precargar: (cols: readonly Coleccion[]) => void;
  /** ¿Están ya en memoria (aunque se estén actualizando)? */
  tiene: (cols: readonly Coleccion[]) => boolean;
  /** Llegó un aviso en tiempo real (GET /eventos) con las colecciones que cambiaron: se vuelven a pedir solo las que están en uso. */
  cambioRemoto: (cols: readonly string[]) => void;
  /** El canal en tiempo real se conectó o se cayó: con el canal vivo la recarga periódica es lenta; sin él, la de siempre. */
  canalEstado: (vivo: boolean) => void;
}
const Ctx = createContext<Datos | null>(null);
const CADA = 45_000;
/** Con el canal en tiempo real conectado, la recarga periódica queda solo como red de seguridad (por si se pierde un aviso). */
const CADA_CON_CANAL = 300_000;
/** Los avisos que llegan juntos (una acción suele cambiar varias colecciones) se juntan en una sola recarga. */
const JUNTAR_AVISOS = 1_500;
/** Tiempo mínimo entre dos recargas de la misma colección por avisos (los pedidos se bajan de 1000 en 1000). */
const MIN_COLECCION = 4_000;
const MIN_PEDIDOS = 45_000;
/** Cuánto se considera fresca una colección al cambiar de pestaña. */
const TTL = 30_000;

export function ProveedorDatos({ usuario, children }: { usuario: T.Usuario; children: ReactNode }) {
  const [version, setVersion] = useState(0);
  const [pinta, setPinta] = useState(0);
  const [error, setError] = useState("");
  const cache = useRef(crearCacheConsultas<Coleccion>(TTL)).current;
  const enUso = useRef(new Map<Coleccion, number>());
  const demoCargado = useRef(false);
  const modo = useRef(E.rol);

  Object.assign(yo, { uid: usuario.id, nombre: usuario.nombre || usuario.email, esAdmin: usuario.rol === "admin", esAsistente: usuario.rol === "asistente" });

  /** Trae las colecciones pedidas (las frescas se saltan, salvo con `forzar`) y vuelve a pintar una sola vez al final. */
  const traer = useCallback(async (cols: readonly Coleccion[], forzar = false) => {
    if (DEMO) { // en demo todo está en memoria desde el principio y los cambios no se reemplazan
      if (!demoCargado.current) { Object.assign(S, datosDemo(usuario)); demoCargado.current = true; TODAS.forEach(c => void cache.obtener(c, async () => true)); setVersion(v => v + 1); }
      return;
    }
    // Si el modo cambió (oficina ↔ mensajero), los pedidos se vuelven a pedir.
    if (modo.current !== E.rol) { modo.current = E.rol; cache.invalidar("pedidos"); }
    const faltan = cols.filter(c => forzar || !cache.fresco(c));
    if (!faltan.length) return;
    try {
      const aplicar = await Promise.all(faltan.map(c => cache.obtener(c, cargadorDe(usuario, c), { forzar })));
      aplicar.forEach(fn => fn(S));
      // `version` está en las claves de las listas paginadas: solo sube cuando se actualiza lo que ya había (recarga
      // periódica o después de guardar). Traer una colección nueva al abrir otra pestaña solo vuelve a pintar.
      setError(""); if (forzar) setVersion(v => v + 1); else setPinta(v => v + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudieron cargar los datos.");
    }
  }, [usuario, cache]);

  const enPantalla = () => [...enUso.current.keys()];
  // Después de guardar: lo que está en pantalla se vuelve a pedir ya; lo demás se olvida, para que al abrirlo
  // se espere la versión nueva en vez de mostrar por un momento cifras de antes del cambio.
  const recargar = useCallback(() => {
    const usadas = enPantalla();
    TODAS.forEach(c => (usadas.includes(c) ? cache.invalidar(c) : cache.olvidar(c)));
    return traer(usadas, true);
  }, [cache, traer]);

  // Después de un cambio pequeño (por ejemplo, recibir dinero) solo se vuelven a pedir esas colecciones, no todo.
  const recargarSolo = useCallback((cols: readonly Coleccion[]) => {
    const usadas = enPantalla();
    cols.forEach(c => cache.invalidar(c));
    return traer(cols.filter(c => usadas.includes(c)), true);
  }, [cache, traer]);

  const usar = useCallback((cols: readonly Coleccion[]) => {
    cols.forEach(c => enUso.current.set(c, (enUso.current.get(c) || 0) + 1));
    void traer(cols);
    return () => cols.forEach(c => { const n = (enUso.current.get(c) || 1) - 1; if (n > 0) enUso.current.set(c, n); else enUso.current.delete(c); });
  }, [traer]);
  const precargar = useCallback((cols: readonly Coleccion[]) => { void traer(cols); }, [traer]);
  const tiene = useCallback((cols: readonly Coleccion[]) => DEMO ? demoCargado.current : cols.every(c => cache.cargado(c)), [cache]);

  const [canal, setCanal] = useState(false);
  const huboCaida = useRef(false), aviso = useRef({ t: 0, lote: new Map<Coleccion, number>() });
  const canalEstado = useCallback((vivo: boolean) => {
    setCanal(vivo);
    if (!vivo) { huboCaida.current = true; return; }
    // Si el canal se cayó y volvió, se pudieron perder avisos: se actualiza lo que está en pantalla.
    if (huboCaida.current) { huboCaida.current = false; void traer(enPantalla(), true); }
  }, [traer]);
  // Un aviso dice qué colecciones cambiaron (los nombres de las tablas; "meta" es la hora del último arqueo). Se juntan unos
  // segundos y se piden solo las que están en uso. Si la colección ya se pidió DESPUÉS del aviso (por ejemplo la recarga que
  // hace esta misma pantalla al guardar), esa petición ya trae el cambio y no se repite.
  /** Una guía nueva o editada aparece en la memoria de una vez: se piden solo las más recientes y se mezclan, sin esperar la recarga
      completa de todas las guías (que tarda y tiene una pausa mínima). La recarga completa sigue siendo la que deja todo exacto. */
  const recientes = useRef({ t: 0, enCurso: false });
  const traerRecientes = useCallback(() => {
    const r = recientes.current;
    if (DEMO || r.t || !cache.cargado("pedidos") || (usuario.rol !== "admin" && usuario.rol !== "asistente") || E.rol === "mensajero") return;
    r.t = window.setTimeout(async () => {
      r.t = 0;
      if (r.enCurso) return;
      r.enCurso = true;
      try {
        const { pedidos } = await api.pedidos.listar({ limite: 60, sinMini: true });
        let cambio = false;
        const nuevos: Pedido[] = [];
        for (const p of pedidos) {
          const x = aPedido(p), viejo = S.pedidos[x.guia], mezcla = viejo ? { ...viejo, ...x } : x;
          if (!viejo || JSON.stringify(mezcla) !== JSON.stringify(viejo)) { nuevos.push(mezcla); cambio = true; }
        }
        if (cambio) tocar(s => { for (const x of nuevos) s.pedidos[x.guia] = x; });
      } catch { /* si falla, queda la recarga completa de siempre */ } finally { r.enCurso = false; }
    }, 300);
  }, [cache, usuario.rol]); // eslint-disable-line react-hooks/exhaustive-deps
  const cambioRemoto = useCallback((cols: readonly string[]) => {
    if (cols.includes("pedidos")) traerRecientes();
    const a = aviso.current, ahora = Date.now();
    for (const n of cols) { const c = (n === "meta" ? "corte" : n) as Coleccion; if (TODAS.includes(c) && !a.lote.has(c)) a.lote.set(c, ahora); }
    if (!a.lote.size || a.t) return;
    const vaciar = () => {
      a.t = 0;
      const usadas = enPantalla(), pedir: Coleccion[] = [], ahora2 = Date.now();
      let espera = 0;
      for (const [c, desde] of [...a.lote]) {
        if (!usadas.includes(c)) { a.lote.delete(c); cache.olvidar(c); continue; } // al abrirla se pide de nuevo, sin mostrar cifras de antes
        if (cache.inicio(c) > desde) { a.lote.delete(c); continue; } // ya se pidió después del aviso: trae el cambio
        // Entre una recarga y la siguiente de la misma colección pasa un mínimo (más largo para los pedidos, que son lo más pesado):
        // en un día con muchos cambios no se vuelve a bajar todo a cada rato, y nunca más seguido que la recarga de antes.
        const falta = (c === "pedidos" ? MIN_PEDIDOS : MIN_COLECCION) - (ahora2 - cache.inicio(c));
        if (falta > 0) { espera = espera ? Math.min(espera, falta) : falta; continue; }
        a.lote.delete(c); cache.invalidar(c); pedir.push(c);
      }
      if (pedir.length) void traer(pedir, true);
      if (a.lote.size && espera) a.t = window.setTimeout(vaciar, espera + 50);
    };
    a.t = window.setTimeout(vaciar, JUNTAR_AVISOS);
  }, [cache, traer, traerRecientes]);

  useEffect(() => {
    // Cada 45 segundos (cada 5 minutos con el canal en tiempo real) y al volver a la app se actualiza solo lo que está en pantalla.
    const t = setInterval(() => { if (document.visibilityState === "visible") void traer(enPantalla(), true); }, canal ? CADA_CON_CANAL : CADA);
    const alVolver = () => { if (document.visibilityState === "visible") void traer(enPantalla()); };
    document.addEventListener("visibilitychange", alVolver);
    return () => { clearInterval(t); document.removeEventListener("visibilitychange", alVolver); };
  }, [traer, canal]);
  useEffect(() => () => window.clearTimeout(aviso.current.t), []);

  // Con `fn` cambió el almacén (lo que respondió el servidor, o la demo): sube `version` y las listas se vuelven a pedir.
  // Sin `fn` es solo volver a pintar (cambió la pestaña o un filtro de `E`): antes eso también volvía a pedir la página.
  const tocar = useCallback((fn?: (s: Almacen) => void) => { if (fn) { fn(S); setVersion(v => v + 1); } else setPinta(v => v + 1); }, []);
  conectar(tocar, recargar, recargarSolo);
  return <Ctx.Provider value={{ version, pinta, error, recargar, tocar, usar, precargar, tiene, cambioRemoto, canalEstado }}>{children}</Ctx.Provider>;
}

/** Muestra "Cargando…" hasta que estén las colecciones (para las ventanas que se abren desde otra pestaña). */
export function ConColecciones({ cols, children, esperando }: { cols: readonly Coleccion[]; children: ReactNode; esperando?: ReactNode }) {
  return useColecciones(cols) ? <>{children}</> : <>{esperando ?? <div className="vacio" role="status">Cargando…</div>}</>;
}

/** Pide las colecciones que usa una vista mientras está montada. Devuelve true cuando ya están en memoria. */
export function useColecciones(cols: readonly Coleccion[]) {
  const d = useDatos(), clave = cols.join(",");
  useEffect(() => d.usar(cols), [clave, d.usar]);
  return d.tiene(cols);
}

export function useDatos() {
  const d = useContext(Ctx);
  if (!d) throw new Error("useDatos fuera de ProveedorDatos");
  return d;
}

/** Texto para el usuario cuando una acción falla. */
export function motivoError(e: unknown) {
  if (api.faltaEnServidor(e)) return "Esta función todavía no está lista en el servidor. Avísale a administración.";
  if (e instanceof FalloApi) return e.message;
  return e instanceof Error ? e.message : "Algo salió mal. Intenta de nuevo.";
}
