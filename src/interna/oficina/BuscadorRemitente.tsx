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

export function BuscadorRemitente({ elegido, alElegir, alCambiar, alEscribir, idEntrada = "pCliBuscar", etiqueta = "Remitente (cliente)", extra }: {
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
}) {
  const ayuda = useId(), [q, setQ] = useState(""), [opciones, setOpciones] = useState<ClienteBreve[]>([]), [buscando, setBuscando] = useState(false), [eligiendo, setEligiendo] = useState(false);
  const entrada = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const t = q.trim();
    if (t.length < 2) { setOpciones([]); setBuscando(false); return; }
    let vivo = true; setBuscando(true);
    const h = setTimeout(() => { buscarRemitentes(t).then(r => { if (vivo) { setOpciones(r); setBuscando(false); } }, () => { if (vivo) { setOpciones([]); setBuscando(false); } }); }, 250);
    return () => { vivo = false; clearTimeout(h); };
  }, [q]);

  const elegir = async (c: ClienteBreve) => {
    if (eligiendo) return;
    setEligiendo(true);
    const m = remitenteDeMemoria(c.id);
    let tarifa = m?.tarifa ?? 0;
    if (!m && !DEMO) tarifa = Number((await apiClientes.obtener(c.id).catch(() => null))?.tarifa) || 0; // el servidor da la tarifa; la búsqueda solo trae nombre e id
    setEligiendo(false); setQ(""); setOpciones([]); alEscribir?.("");
    alElegir({ id: c.id, nombre: c.nombre, tarifa });
  };

  if (elegido) return <div className="campo"><label htmlFor={idEntrada + "-cambiar"}>{etiqueta}</label>
    <div className="ng-elegido"><div className="ng-elegido-txt"><b>{elegido.nombre}</b></div>
      <button type="button" id={idEntrada + "-cambiar"} className="btn sec chico" onClick={() => { alCambiar(); setTimeout(() => entrada.current?.focus(), 0); }}>Cambiar</button></div>{extra}</div>;
  return <div className="campo"><label htmlFor={idEntrada}>{etiqueta}</label>
    <input id={idEntrada} ref={entrada} type="search" inputMode="search" placeholder="Escribe el nombre o el teléfono del cliente" autoComplete="off" aria-label="Buscar cliente" aria-describedby={ayuda} value={q}
      onChange={e => { setQ(e.target.value); alEscribir?.(e.target.value); }} />
    <ul className="ng-lista" aria-label="Clientes encontrados">{opciones.map(c => <li key={c.id}><button type="button" disabled={eligiendo} onClick={() => elegir(c)}>{c.nombre}</button></li>)}</ul>
    <small id={ayuda} className="sub ng-ayuda" role="status">{q.trim().length < 2 ? "Escribe al menos 2 letras." : buscando ? "Buscando…" : opciones.length ? "" : "No hay un cliente con ese nombre. Puedes crearlo."}</small>
    {extra}</div>;
}
