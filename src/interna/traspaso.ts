/* Recogida con patinador y traspaso por QR: lo que piden las tres pantallas (patinador, oficina y mensajero).
   En modo demo todo vive en memoria; con el servidor, las reglas (un solo uso, vencimiento, quién puede canjear) son de él. */
import * as api from "../api/servicios";
import type { QrTraspaso, RecogidaEnEspera, VistaTraspaso } from "../api/tipos";
import { DEMO } from "./demo";
import { yo } from "./motor";
/** La oficina (modo Mensajero) dice a nombre de quién se recibe; el mensajero no manda nada: el servidor usa su cuenta. */
export const aNombreDe = (mensajeroId: string) => (yo.esAdmin || yo.esAsistente ? mensajeroId : undefined);

/** Lo que se dibuja dentro del QR: un enlace con el código (la cámara del celular lo abre) y no los datos del pedido. */
export const textoQr = (codigo: string) => `${location.origin}/?qr=${codigo}`;
/** Saca el código de lo que leyó la cámara (el enlace del QR) o de lo que escribió la persona. */
export function codigoDe(texto: string) {
  const t = texto.trim();
  try { const u = new URL(t); return u.searchParams.get("qr") ?? t; } catch { return t; }
}
/** XXXXX-XXXXX, para leerlo y dictarlo mejor. */
export const codigoLegible = (c: string) => c.length === 10 ? c.slice(0, 5) + "-" + c.slice(5) : c;

/* ---- demo ---- */
const enEspera: RecogidaEnEspera[] = [];
const codigosDemo = new Map<string, { guia: string; vence: number }>();
/** Guías que el patinador de la demo ya recogió; la pantalla de solicitudes las quita de su lista. */
export const recogidasDemoGuias = () => new Set(enEspera.map(r => r.guia));

export const recogidasEnEspera = (mensajeroId?: string): Promise<RecogidaEnEspera[]> =>
  DEMO ? Promise.resolve(enEspera.filter(r => !mensajeroId || r.patinadorId === mensajeroId)) : api.patinador.recogidas(mensajeroId);

export async function marcarRecogido(r: { guia: string; remitente: string; direccionRecogida: string; direccionEntrega: string; destinatarioNombre: string; paquetes: number }) {
  if (!DEMO) return void await api.patinador.marcarRecogido(r.guia);
  if (!enEspera.some(x => x.guia === r.guia)) enEspera.push({ ...r, recogidoEn: new Date().toISOString(), patinadorId: "m-pat", patinadorNombre: "Tomás Vélez", codigoVence: null });
}
export async function deshacerRecogido(guia: string) {
  if (!DEMO) return void await api.patinador.deshacerRecogido(guia);
  const i = enEspera.findIndex(x => x.guia === guia); if (i >= 0) enEspera.splice(i, 1);
}
export async function generarQr(guia: string): Promise<QrTraspaso> {
  if (!DEMO) return api.patinador.generarQr(guia);
  const alfabeto = "0123456789ABCDEFGHJKMNPQRSTVWXYZ", codigo = Array.from({ length: 10 }, () => alfabeto[Math.floor(Math.random() * alfabeto.length)]).join("");
  for (const [c, v] of codigosDemo) if (v.guia === guia) codigosDemo.delete(c); // el anterior deja de servir
  const vence = Date.now() + 24 * 3600_000;
  codigosDemo.set(codigo, { guia, vence });
  const r = enEspera.find(x => x.guia === guia); if (r) r.codigoVence = new Date(vence).toISOString();
  return { guia, codigo, vence: new Date(vence).toISOString() };
}
/** Demo: el código de la guía (para probar el escáner con el QR que se ve en la pantalla de oficina). */
const buscarDemo = (codigo: string) => {
  const c = codigo.toUpperCase().replace(/[\s-]/g, "").replace(/O/g, "0").replace(/[IL]/g, "1"), v = codigosDemo.get(c);
  if (!v || v.vence <= Date.now()) throw new Error("Ese código no sirve o ya venció. Pídele a administración uno nuevo.");
  return enEspera.find(x => x.guia === v.guia)!;
};
export async function vistaPreviaQr(codigo: string, mensajeroId: string): Promise<VistaTraspaso> {
  if (!DEMO) return api.traspasos.vistaPrevia(codigo, aNombreDe(mensajeroId));
  const r = buscarDemo(codigo);
  return { guia: r.guia, remitente: r.remitente, destinatarioNombre: r.destinatarioNombre, direccionEntrega: r.direccionEntrega, paquetes: r.paquetes, patinadorNombre: r.patinadorNombre, vence: r.codigoVence ?? "", yaEsTuyo: false };
}
/** Demo: quita la recogida de la lista de espera y devuelve sus datos para que el mensajero la reciba en memoria. */
export function canjearDemo(codigo: string) {
  const r = buscarDemo(codigo);
  enEspera.splice(enEspera.indexOf(r), 1);
  for (const [c, v] of codigosDemo) if (v.guia === r.guia) codigosDemo.delete(c);
  return r;
}
