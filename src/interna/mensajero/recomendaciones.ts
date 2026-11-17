/* Alertas y recomendaciones del mensajero: primero lo urgente, luego cómo mejorar, y siempre reconocer lo que va bien.
   Las muestra la campanita de la barra (Marco). Va aparte de Mensajero.tsx para no descargar toda la pantalla solo por el contador. */
import { E, guardarLocal } from "../estado";
import { S, cerrado, diaDe, hoy, moverDia, pct, periodoMensajero, semanaDe, pesos, CONSEJOS_MOTIVO, MOTIVOS } from "../motor";
import { pl } from "../ui";

export type Reco = {
  /** sin = urgente · pend = por mejorar · ruta = consejo · ent = va bien */
  cls: "sin" | "ent" | "pend" | "ruta";
  /** nombre del ícono de `ui.tsx` */
  ic: string;
  titulo: string;
  texto: string;
  /** a dónde lleva el botón de la tarjeta (sin él no lleva botón) */
  ir?: "recoger" | "entregar" | "caja" | "pend";
};

export const ETIQUETA_ACCION: Record<NonNullable<Reco["ir"]>, string> = { entregar: "Ver por entregar", recoger: "Ver por recoger", caja: "Ver mi caja", pend: "Ver mis pedidos" };

/** Lleva al mensajero a la pestaña pedida (los mismos pasos que `irM` de Mensajero.tsx). */
export function irAMensajero(destino: NonNullable<Reco["ir"]>) {
  let k: string = destino;
  if (k === "recoger" || k === "entregar") { E.subPedM = k; guardarLocal("js_pedidos_m", k); k = "pend"; }
  E.tabM = k as typeof E.tabM; if (k === "pend") E.diaPedM = "";
}

export function recomendacionesMensajero(mid: string): Reco[] {
  const m = S.mensajeros[mid];
  if (!m) return [];
  const H = 36e5, h = hoy(), desde = moverDia(h, -29), mis = Object.values(S.pedidos).filter(p => p.mensajeroId === mid);
  const enRuta = mis.filter(p => p.estado === "pendiente"), viejos = enRuta.filter(p => Date.now() - p.creado > 24 * H);
  const porRecoger = mis.filter(p => p.estado === "aceptado").length;
  const porDefinir = mis.filter(p => p.estado === "devuelto" && p.destinoDev === "por_definir").length;
  const mes = mis.filter(p => cerrado(p) && diaDe(p.entregado || 0) >= desde), ent = mes.filter(p => p.estado === "entregado"), dev = mes.filter(p => p.estado === "devuelto");
  const efec = pct(ent.length, mes.length);
  const fallos: Record<string, number> = {};
  dev.forEach(p => { const k = p.motivoDev || "otro"; fallos[k] = (fallos[k] || 0) + 1; });
  mis.forEach(p => p.intentos.forEach(i => { if (diaDe(i.fecha) >= desde) { const k = i.motivo || "otro"; fallos[k] = (fallos[k] || 0) + 1; } }));
  const motivos = Object.entries(fallos).sort((a, b) => b[1] - a[1]);
  const conDif = ent.filter(p => Number(p.difCobro)).length;
  const tiempos = ent.map(p => ((p.entregado || 0) - p.creado) / H).filter(x => x >= 0).sort((a, b) => a - b), mediana = tiempos.length ? tiempos[Math.floor(tiempos.length / 2)] : 0;
  const diasTrab = new Set(ent.map(p => diaDe(p.entregado || 0))).size, porDia = diasTrab ? ent.length / diasTrab : 0;
  const sem = semanaDe(h), entSem = ent.filter(p => diaDe(p.entregado || 0) >= sem), diasSem = new Set(entSem.map(p => diaDe(p.entregado || 0))).size, porDiaSem = diasSem ? entSem.length / diasSem : 0;
  const pm = periodoMensajero(mid);
  const tiempoTxt = (x: number) => (x < 1 ? Math.round(x * 60) + " min" : x.toFixed(1).replace(".", ",") + " h");
  const coma = (x: number) => x.toFixed(1).replace(".", ",");
  const nomMotivo = (k: string) => MOTIVOS[k as keyof typeof MOTIVOS] || "Otro motivo";

  const R: Reco[] = [];
  if (porDefinir) R.push({ cls: "sin", ic: "dev", titulo: porDefinir === 1 ? "Tienes 1 devolución por confirmar" : `Tienes ${porDefinir} devoluciones por confirmar`, texto: "Cuéntanos dónde quedó el paquete: con el cliente, en la oficina o si harás el reintento.", ir: "pend" });
  if (porRecoger) R.push({ cls: "sin", ic: "pedidos", titulo: `Tienes ${porRecoger} ${pl(porRecoger, "pedido")} por recoger`, texto: "La oficina te los asignó desde una solicitud. Ve por ellos y pulsa “Recoger” para tomarle la foto al paquete: sin la foto no los puedes entregar.", ir: "recoger" });
  if (viejos.length) R.push({ cls: "sin", ic: "pend", titulo: `Tienes ${viejos.length} ${pl(viejos.length, "pedido")} con más de un día en ruta`, texto: "Entrégalos hoy o márcalos como “No se pudo entregar” con el motivo, para que la oficina le avise al remitente.", ir: "entregar" });
  const ultimaEntregaPlata = Math.max(pm.ul?.fecha || 0, ...pm.recs.map(r => r.fecha)), desdeCuando = ultimaEntregaPlata || pm.ps[0]?.entregado || Date.now(), diasSinEntregar = Math.floor((Date.now() - desdeCuando) / (24 * H));
  if (pm.debe >= 100000 && diasSinEntregar >= 1) R.push({ cls: "sin", ic: "plata", titulo: `Llevas ${pesos(pm.debe)} sin entregar a la oficina`, texto: `Hace ${diasSinEntregar === 1 ? "más de un día" : diasSinEntregar + " días"} que no le pasas plata a la oficina. Entrégala hoy: andar con mucha plata es un riesgo para ti, y la caja de la empresa no cuadra hasta que la recibe.`, ir: "caja" });
  if (mes.length >= 10 && efec < 90 && motivos.length) { const [k, n] = motivos[0], c = CONSEJOS_MOTIVO[k] || CONSEJOS_MOTIVO.otro;
    R.push({ cls: "pend", ic: "dev", titulo: `Devuelves ${100 - efec} de cada 100 pedidos`, texto: `La causa que más se repite es “${nomMotivo(k)}” (${n} ${n === 1 ? "vez" : "veces"} en 30 días). Consejo: ${c[1]}` }); }
  else if (motivos.length && motivos[0][1] >= 3) { const [k, n] = motivos[0], c = CONSEJOS_MOTIVO[k] || CONSEJOS_MOTIVO.otro;
    R.push({ cls: "ruta", ic: "dev", titulo: c[0], texto: `“${nomMotivo(k)}” se repitió ${n} veces en 30 días. ${c[1]}` }); }
  if (conDif) R.push({ cls: "pend", ic: "plata", titulo: `${conDif} ${pl(conDif, "entrega")} con un valor cobrado distinto al de la guía`, texto: "Antes de entregar, mira en la app cuánto hay que cobrar y cuenta la plata delante del cliente. Si el cliente paga otro valor, escribe en la nota por qué." });
  if (tiempos.length >= 10 && mediana > 5) R.push({ cls: "ruta", ic: "ruta", titulo: `Tus pedidos tardan ${tiempoTxt(mediana)} desde que salen`, texto: "Organiza la ruta por barrios antes de salir y llama primero a los que más lejos están. Entregar más rápido te deja hacer más domicilios en el día." });
  if (diasSem >= 2 && diasTrab >= 5 && porDiaSem < porDia * 0.8) R.push({ cls: "ruta", ic: "pedidos", titulo: `Esta semana vas en ${coma(porDiaSem)} entregas por día`, texto: `Tu promedio del último mes es ${coma(porDia)}. Pide en la oficina más pedidos de tu zona o arranca un poco más temprano.` });
  if (mes.length >= 10 && efec >= 95) R.unshift({ cls: "ent", ic: "ok", titulo: "¡Vas excelente!", texto: `Entregaste ${efec}% de tus pedidos en los últimos 30 días. Sigue llamando antes de llegar y confirmando direcciones: eso es lo que hace la diferencia.` });
  else if (!R.length && mes.length) R.push({ cls: "ent", ic: "ok", titulo: "Vas bien", texto: "No hay nada urgente. Sigue confirmando direcciones y llamando antes de llegar para mantener tus entregas al día." });
  if (!mes.length && !enRuta.length && !porRecoger) R.push({ cls: "ruta", ic: "nuevo", titulo: "Empieza tu día", texto: "Toma la foto de cada pedido al salir. Aquí vas a ver cómo te va y consejos para mejorar." });
  const orden = { sin: 0, ent: 1, pend: 2, ruta: 3 };
  return R.sort((a, b) => orden[a.cls] - orden[b.cls]);
}

/** Alertas activas: lo urgente (cls "sin"). Es lo que cuenta la campanita. */
export const alertasActivas = (R: Reco[]) => R.filter(r => r.cls === "sin").length;
