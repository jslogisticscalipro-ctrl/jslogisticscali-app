/* Campanita del mensajero: abre el panel "Alertas y recomendaciones" (antes la tarjeta "Recomendaciones para ti" del Inicio).
   El número es de alertas urgentes: devoluciones por confirmar, pedidos por recoger o con más de un día, y plata sin entregar. */
import { E } from "../estado";
import { Cab, Icono, useVentana } from "../ui";
import { IconoCampana } from "../Solicitudes";
import { ETIQUETA_ACCION, alertasActivas, irAMensajero, recomendacionesMensajero, type Reco } from "./recomendaciones";

export function CampanaMensajero({ version, pintar }: { version: number; pintar: () => void }) {
  const { abrir } = useVentana();
  // Se calcula en cada pintada: los datos (S) cambian en sitio y `version` no avisa de todo (por ejemplo, al elegir el nombre).
  void version;
  const R = recomendacionesMensajero(E.miMensajero);
  const n = alertasActivas(R);
  const txt = n ? `Alertas y recomendaciones: ${n} ${n === 1 ? "alerta" : "alertas"}` : "Alertas y recomendaciones: sin alertas";
  return (
    <button type="button" className="campana" aria-label={txt} title={txt} onClick={() => abrir(<PanelAlertas pintar={pintar} />, "drawer-ancho")}>
      <IconoCampana />
      {n > 0 && <span className="campana-num nueva" aria-hidden="true">{n > 9 ? "9+" : n}</span>}
    </button>
  );
}

function PanelAlertas({ pintar }: { pintar: () => void }) {
  const R = recomendacionesMensajero(E.miMensajero);
  const { cerrar } = useVentana();
  const ir = (destino: NonNullable<Reco["ir"]>) => { cerrar(); irAMensajero(destino); pintar(); scrollTo(0, 0); };
  return <>
    <Cab sub={<small>Lo urgente primero, y cómo mejorar tus entregas</small>}><h2>Alertas y recomendaciones</h2></Cab>
    {R.length
      ? <div className="recos" style={{ marginTop: 12 }}>{R.map((r, i) => <div key={i} className={"reco " + r.cls}><span className="reco-ic"><Icono n={r.ic} /></span><div><b>{r.titulo}</b><p>{r.texto}</p>{r.ir && <button type="button" className="btn sec chico" onClick={() => ir(r.ir!)}>{ETIQUETA_ACCION[r.ir]}</button>}</div></div>)}</div>
      : <div className="vacio">No hay alertas por ahora.</div>}
  </>;
}
