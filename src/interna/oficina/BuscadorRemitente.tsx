/* Elegir el remitente de una guía buscando en el servidor (desde 2 letras), en vez de dibujar un <select> con todos los clientes.
   Con miles de clientes, ordenar, filtrar y pintar cada <option> en cada tecla hacía lenta la ventana (auditoría
   `auditoria/pedidos-remitente-modal-rendimiento.md`). Devuelve también la tarifa del cliente para llenar el valor del servicio. */
import { useEffect, useId, useRef, useState } from "react";
import type { ClienteBreve } from "../../api/tipos";
import { clientes as apiClientes } from "../../api/servicios";
import { buscarRemitentes } from "../acciones";
import { DEMO } from "../demo";
import { S } from "../motor";

export interface RemitenteElegido { id: string; nombre: string; tarifa: number }

/** Nombre y tarifa de un cliente que ya está en memoria (si no está, la tarifa queda en 0 hasta pedirla). */
export const remitenteDeMemoria = (id: string): RemitenteElegido | null => (S.clientes[id] ? { id, nombre: S.clientes[id].nombre, tarifa: Number(S.clientes[id].tarifa) || 0 } : null);

/** Sin tildes, en minúsculas y sin espacios en los bordes, para comparar lo escrito con el nombre del cliente. */
const normalizar = (t: string) => t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

export function BuscadorRemitente({ elegido, alElegir, alCambiar, alEscribir, idEntrada = "pCliBuscar", etiqueta = "Remitente (cliente)", extra, siguienteId }: {
  elegido: { id: string; nombre: string } | null;
  alElegir: (c: RemitenteElegido) => void;
  /** Se llama al pulsar "Cambiar" (para soltar el remitente elegido). */
  alCambiar: () => void;
  /** Lo que se va escribiendo (para "+ Crear cliente nuevo" con ese nombre). */
  alEscribir?: (q: string) => void;
  idEntrada?: string;
  etiqueta?: string;
  /** Botón u otra cosa que va debajo del campo (por ejemplo "+ Crear cliente nuevo"). */
  extra?: React.ReactNode;
  /** Id del campo al que pasa el foco cuando el remitente se elige solo (por ejemplo "Valor del servicio"). */
  siguienteId?: string;
}) {
  const ayuda = useId(), [q, setQ] = useState(""), [resultado, setResultado] = useState<{ q: string; lista: ClienteBreve[] }>({ q: "", lista: [] }), opciones = resultado.lista, [buscando, setBuscando] = useState(false), [eligiendo, setEligiendo] = useState(false);
  const entrada = useRef<HTMLInputElement>(null), sinAuto = useRef(false); // sinAuto: tras «Cambiar» no se elige solo hasta que se vuelva a escribir
  useEffect(() => {
    const t = q.trim();
    if (t.length < 2) { setResultado({ q: t, lista: [] }); setBuscando(false); return; }
    let vivo = true; setBuscando(true);
    const h = setTimeout(() => { buscarRemitentes(t).then(r => { if (vivo) { setResultado({ q: t, lista: r }); setBuscando(false); } }, () => { if (vivo) { setResultado({ q: t, lista: [] }); setBuscando(false); } }); }, 250);
    return () => { vivo = false; clearTimeout(h); };
  }, [q]);

  const elegir = async (c: ClienteBreve, auto = false) => {
    if (eligiendo) return;
    setEligiendo(true);
    const m = remitenteDeMemoria(c.id);
    let tarifa = m?.tarifa ?? 0;
    if (!m && !DEMO) tarifa = Number((await apiClientes.obtener(c.id).catch(() => null))?.tarifa) || 0; // el servidor da la tarifa; la búsqueda solo trae nombre e id
    setEligiendo(false); setQ(""); setResultado({ q: "", lista: [] }); alEscribir?.("");
    alElegir({ id: c.id, nombre: c.nombre, tarifa });
    if (auto && siguienteId) setTimeout(() => document.getElementById(siguienteId)?.focus(), 0);
  };

  // Elige sola cuando lo escrito es el nombre exacto de un cliente, o cuando, con 3 letras o más, solo queda un resultado.
  // Se compara con lo que se buscó (no con resultados viejos) y con lo que hay escrito ahora.
  useEffect(() => {
    if (elegido || eligiendo || sinAuto.current || buscando) return;
    const escrito = normalizar(q);
    if (escrito.length < 2 || normalizar(resultado.q) !== escrito) return;
    const exacto = opciones.filter(c => normalizar(c.nombre) === escrito);
    const unico = exacto.length === 1 ? exacto[0] : escrito.length >= 3 && opciones.length === 1 ? opciones[0] : null;
    if (unico) void elegir(unico, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resultado, buscando]);

  const cab = <div className="rem-cab"><label htmlFor={elegido ? idEntrada + "-cambiar" : idEntrada}>{etiqueta}</label>{extra}</div>;
  if (elegido) return <div className="campo">{cab}
    <div className="ng-elegido"><div className="ng-elegido-txt"><b>{elegido.nombre}</b></div>
      <button type="button" id={idEntrada + "-cambiar"} className="btn sec chico" onClick={() => { sinAuto.current = true; alCambiar(); setTimeout(() => entrada.current?.focus(), 0); }}>Cambiar</button></div></div>;
  return <div className="campo">{cab}
    <div className="combo-buscar"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>
      <input id={idEntrada} ref={entrada} type="text" inputMode="search" enterKeyHint="search" placeholder="Escribe el nombre del cliente…" autoComplete="off" aria-label="Buscar cliente" aria-describedby={ayuda} value={q}
        onChange={e => { sinAuto.current = false; setQ(e.target.value); alEscribir?.(e.target.value); }} /></div>
    <small id={ayuda} className="sub ng-ayuda" role="status">{q.trim().length < 2 ? "Escribe al menos 2 letras para buscar." : buscando ? "Buscando…" : opciones.length ? "" : "No hay un cliente con ese nombre. Puedes crearlo."}</small>
    <ul className="ng-lista" aria-label="Clientes encontrados">{opciones.map(c => <li key={c.id}><button type="button" disabled={eligiendo} onClick={() => elegir(c)}>{c.nombre}</button></li>)}</ul>
  </div>;
}
