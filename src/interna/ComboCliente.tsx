import { useEffect, useMemo, useRef, useState } from "react";
import { pesos, sinTildes } from "./motor";

export interface OpcionCliente { id: string; nombre: string; telefono?: string }
const MAX_VISIBLES = 40; // con miles de clientes no se pintan todos: se escribe para afinar

/** Texto del saldo de un cliente: lo que debe, lo que tiene a favor o «Al día». Negativo = debe (igual que `saldoCliente`). */
export function textoSaldo(s: number) {
  return s < 0 ? { txt: "Debe " + pesos(-s), cls: "neg" } : s > 0 ? { txt: "A favor " + pesos(s), cls: "pos" } : { txt: "Al día", cls: "" };
}

/** Selector de cliente con búsqueda y lista desplegable en tiempo real (mismo patrón de Personal → Acceso). */
export function ComboCliente({ id, clientes, saldos, valor, alElegir, alCrear }: {
  id: string; clientes: OpcionCliente[]; saldos: Map<string, number>; valor: string;
  alElegir: (cid: string) => void; alCrear: (texto: string) => void;
}) {
  const [bus, setBus] = useState(""), [abierto, setAbierto] = useState(false), [activo, setActivo] = useState(0);
  const caja = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!abierto) return;
    const fuera = (e: MouseEvent) => { if (caja.current && !caja.current.contains(e.target as Node)) setAbierto(false); };
    document.addEventListener("mousedown", fuera); return () => document.removeEventListener("mousedown", fuera);
  }, [abierto]);
  // El filtrado se memoiza: solo cambia con el texto o la lista, no con otras teclas del formulario
  const q = sinTildes(bus.trim());
  const { lista, total } = useMemo(() => {
    const l: OpcionCliente[] = []; let n = 0;
    for (const c of clientes) if (!q || sinTildes(c.nombre + " " + (c.telefono || "")).includes(q)) { n++; if (l.length < MAX_VISIBLES) l.push(c); }
    return { lista: l, total: n };
  }, [clientes, q]);
  const elegido = valor ? clientes.find(c => c.id === valor) : undefined;
  const elegir = (cid: string) => { alElegir(cid); setBus(""); setAbierto(false); };
  const crear = () => { setAbierto(false); alCrear(bus.trim()); };
  const teclas = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setAbierto(true); setActivo(a => Math.min(a + 1, lista.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActivo(a => Math.max(a - 1, 0)); }
    else if (e.key === "Enter") { if (abierto && lista[activo]) { e.preventDefault(); elegir(lista[activo].id); } else if (abierto) e.preventDefault(); }
    else if (e.key === "Escape" && abierto) { e.preventDefault(); e.stopPropagation(); setAbierto(false); }
  };
  useEffect(() => {
    if (abierto) caja.current?.querySelector<HTMLElement>(`[data-i="${activo}"]`)?.scrollIntoView({ block: "nearest" });
  }, [activo, abierto]);

  return <div className="combo-cliente" ref={caja}>
    <div style={{ display: "flex", gap: 6, alignItems: "flex-start" }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        {elegido
          ? <div className="combo-chip">
              <span><b>{elegido.nombre}</b><small className={textoSaldo(saldos.get(elegido.id) || 0).cls}>{textoSaldo(saldos.get(elegido.id) || 0).txt}</small></span>
              <button type="button" onClick={() => { alElegir(""); setAbierto(true); }}>Cambiar</button>
            </div>
          : <>
              <div className="combo-buscar">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>
                <input id={id} type="text" role="combobox" aria-expanded={abierto} aria-controls={id + "Lista"} aria-autocomplete="list" autoComplete="off" placeholder="Buscar cliente…" value={bus}
                  onFocus={() => setAbierto(true)} onKeyDown={teclas} onChange={e => { setBus(e.target.value); setAbierto(true); setActivo(0); }} />
                {bus ? <button type="button" className="combo-limpiar" aria-label="Borrar búsqueda" onClick={() => { setBus(""); setActivo(0); }}>×</button> : null}
              </div>
              {abierto ? <div className="combo-lista" id={id + "Lista"} role="listbox">
                {lista.map((c, i) => { const t = textoSaldo(saldos.get(c.id) || 0);
                  return <button type="button" key={c.id} data-i={i} role="option" aria-selected={i === activo} className={"combo-opcion fila" + (i === activo ? " activa" : "")} onMouseEnter={() => setActivo(i)} onClick={() => elegir(c.id)}>
                    <span className="combo-nom"><b>{c.nombre}</b>{c.telefono ? <small>{c.telefono}</small> : null}</span><em className={t.cls}>{t.txt}</em>
                  </button>; })}
                {total > lista.length ? <span className="combo-vacio">Hay {total - lista.length} más: escribe para afinar la búsqueda.</span> : null}
                {!lista.length ? <span className="combo-vacio">No se encontraron clientes{q ? ` con “${bus.trim()}”` : ""}.</span> : null}
                {!lista.length ? <button type="button" className="combo-opcion crear" onClick={crear}>+ Crear cliente {q ? `“${bus.trim()}”` : "nuevo"}</button> : null}
              </div> : null}
            </>}
      </div>
      {!elegido ? <button className="btn sec chico" id="mxNuevoCli" type="button" onClick={() => alCrear(bus.trim())}>+ Cliente nuevo</button> : null}
    </div>
  </div>;
}
