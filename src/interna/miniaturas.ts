/* Miniaturas de las filas del mensajero. La lista de guías ya no trae la URL de cada foto (firmar miles en cada recarga
   era lo que más tardaba): cada fila pide la suya cuando aparece en pantalla, y las que se piden en el mismo momento
   viajan juntas en una sola llamada (`POST /pedidos/miniaturas`). Lo ya pedido se recuerda por guía, así que una recarga
   de la lista no vuelve a pedir ni a descargar nada. */
import { useEffect, useRef, useState } from "react";
import { pedidos as apiPedidos } from "../api/servicios";
import { DEMO } from "./demo";
import type { Pedido } from "./motor";

const VIGENCIA_MS = 45 * 60 * 1000; // el servidor da URL con al menos 1 hora de vida
const REINTENTO_MS = 30 * 1000;
const POR_LLAMADA = 100;
const ESPERA_MS = 60;

const memoria = new Map<string, { url: string | null; hasta: number }>(); // url null: la guía no tiene miniatura (o falló)
const esperando = new Set<string>();
const oyentes = new Set<() => void>();
let temporizador = 0;

const vigente = (guia: string) => { const m = memoria.get(guia); return m && m.hasta > Date.now() ? m : undefined; };

async function vaciar() {
  temporizador = 0;
  const guias = [...esperando]; esperando.clear();
  for (let i = 0; i < guias.length; i += POR_LLAMADA) {
    const lote = guias.slice(i, i + POR_LLAMADA);
    try {
      const minis = await apiPedidos.miniaturas(lote);
      for (const g of lote) memoria.set(g, minis[g] ? { url: minis[g], hasta: Date.now() + VIGENCIA_MS } : { url: null, hasta: Date.now() + VIGENCIA_MS });
    } catch {
      for (const g of lote) memoria.set(g, { url: null, hasta: Date.now() + REINTENTO_MS }); // sin miniatura por ahora; se reintenta
    }
  }
  oyentes.forEach(f => f());
}

function pedir(guia: string) {
  if (vigente(guia) || esperando.has(guia)) return;
  esperando.add(guia);
  if (!temporizador) temporizador = window.setTimeout(() => { void vaciar(); }, ESPERA_MS);
}

/** URL de la miniatura de un pedido. Si la lista ya la trae (`p.mini`) se usa; si no, se pide cuando la fila se ve. */
export function useMini(p: Pedido): { ref: (el: HTMLElement | null) => void; url: string } {
  const [, repintar] = useState(0);
  const nodo = useRef<HTMLElement | null>(null);
  const guia = p.guia, trae = !!p.mini || DEMO;
  useEffect(() => {
    const f = () => repintar(n => n + 1);
    oyentes.add(f);
    return () => { oyentes.delete(f); };
  }, []);
  useEffect(() => {
    if (trae || typeof IntersectionObserver === "undefined") { if (!trae) pedir(guia); return; }
    const el = nodo.current;
    if (!el) return;
    const o = new IntersectionObserver(es => { if (es.some(e => e.isIntersecting)) { pedir(guia); } }, { rootMargin: "200px" });
    o.observe(el);
    return () => o.disconnect();
  }, [guia, trae]);
  const url = p.mini || vigente(guia)?.url || "";
  return { ref: el => { nodo.current = el; }, url };
}
