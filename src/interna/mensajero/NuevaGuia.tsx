/* Ventana que se abre al tomar la foto de un pedido. La guía NO se crea al tomar la foto: solo cuando el mensajero
   pulsa "Crear guía". Descartar (o cerrar la ventana) no crea nada y no sube nada. Al pulsar "Crear guía" la ventana
   se cierra de una vez; las guías se crean y las fotos se suben de fondo, y al terminar sale un aviso corto.
   El mensajero no elige el remitente: la guía queda sin remitente y la oficina lo pone. */
import { useEffect, useState } from "react";
import { useVentana } from "../ui";
import { crearGuias } from "../acciones";
import { motivoError } from "../datos";

export function DlgNuevaGuia({ fotos, mensajeroId, alCrear }: { fotos: File[]; mensajeroId: string; alCrear: (guias: string[]) => void }) {
  const v = useVentana();
  const [vista, setVista] = useState("");
  const n = fotos.length;

  useEffect(() => { const u = URL.createObjectURL(fotos[0]); setVista(u); return () => URL.revokeObjectURL(u); }, [fotos]);

  // Recién aquí se crean las guías y se suben las fotos, ya con la ventana cerrada.
  const crear = () => {
    v.cerrar();
    crearGuias(fotos, mensajeroId, () => {}).then(
      guias => { alCrear(guias); v.avisar((guias.length === 1 ? "Guía " + guias[0] + " creada" : guias.length + " guías creadas")); },
      e => v.avisar(textoError(e)),
    );
  };

  return <>
    <header><h2>{n === 1 ? "¿Crear la guía de esta foto?" : "¿Crear " + n + " guías?"}</h2><button className="cerrar" data-cerrar aria-label="Cerrar">×</button></header>
    <div className="ng-subida ng-fase-revisar">
      <div className="ng-foto">
        {vista && <img src={vista} alt="Foto del pedido" />}
        {n > 1 && <span className="ng-cuenta">{n}</span>}
      </div>
      <div className="ng-texto">
        <b>{n === 1 ? "Foto lista" : n + " fotos listas"}</b>
        <span className="sub">Todavía no se crea nada. Pulsa el botón de crear; la oficina pone el remitente.</span>
      </div>
    </div>

    <div className="acciones ng-acciones">
      <button type="button" className="btn" onClick={crear}>{n === 1 ? "Crear guía" : "Crear " + n + " guías"}</button>
      <button type="button" className="btn sec" data-cerrar>Descartar foto</button>
    </div>
  </>;
}

const textoError = (e: unknown) => "No se pudo crear la guía: " + (navigator.onLine === false ? "no hay señal" : motivoError(e)) + ". Revisa tus pedidos antes de volver a tomar la foto.";
