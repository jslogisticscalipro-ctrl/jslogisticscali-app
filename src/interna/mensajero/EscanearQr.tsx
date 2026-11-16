/* Ventana "Escanear QR": el mensajero recibe una guía que ya recogió un patinador. Lee el QR con la cámara (o escribe el código),
   ve de qué paquete se trata y confirma. La guía YA EXISTÍA: no se crea otra. Queda "por recoger" y sigue el flujo de siempre
   (Recoger → foto del paquete → en ruta). Las reglas (un solo uso, vencimiento) las aplica el servidor. */
import { useEffect, useRef, useState } from "react";
import type { VistaTraspaso } from "../../api/tipos";
import { useVentana } from "../ui";
import { motivoError } from "../datos";
import { canjearQr } from "../acciones";
import { codigoDe, vistaPreviaQr } from "../traspaso";
import { DlgRecoger } from "./Recoger";

type Fase = "leyendo" | "buscando" | "vista" | "guardando" | "lista";

export function DlgEscanearQr({ mensajeroId }: { mensajeroId: string }) {
  const v = useVentana();
  const [fase, setFase] = useState<Fase>("leyendo"), [error, setError] = useState(""), [aviso, setAviso] = useState("");
  const [codigo, setCodigo] = useState(""), [escrito, setEscrito] = useState(""), [datos, setDatos] = useState<VistaTraspaso | null>(null);
  const video = useRef<HTMLVideoElement>(null), fasePrev = useRef<Fase>("leyendo"), montado = useRef(true);
  fasePrev.current = fase;

  const revisar = async (texto: string) => {
    const c = codigoDe(texto); if (!c) return;
    setFase("buscando"); setError("");
    try { const d = await vistaPreviaQr(c); if (!montado.current) return; setCodigo(c); setDatos(d); setFase("vista"); }
    catch (e) { if (!montado.current) return; setError(motivoError(e)); setFase("leyendo"); }
  };
  const revisarRef = useRef(revisar); revisarRef.current = revisar;

  // Cámara trasera y lectura continua. Si no hay cámara, no hay permiso o la página no es segura, queda el código escrito.
  useEffect(() => {
    montado.current = true;
    let parar = false, flujo: MediaStream | null = null, cuadro = 0;
    (async () => {
      if (!navigator.mediaDevices?.getUserMedia) { setAviso("Este celular no deja abrir la cámara aquí. Escribe el código que aparece debajo del QR."); return; }
      try {
        flujo = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false });
        if (parar) { flujo.getTracks().forEach(t => t.stop()); return; }
        const el = video.current; if (!el) return;
        el.srcObject = flujo; await el.play().catch(() => {});
        const { default: jsQR } = await import("jsqr"); // solo se descarga al abrir esta ventana
        const lienzo = document.createElement("canvas"), ctx = lienzo.getContext("2d", { willReadFrequently: true });
        let ultimo = 0;
        const leer = (t: number) => {
          if (parar) return;
          cuadro = requestAnimationFrame(leer);
          if (t - ultimo < 180 || fasePrev.current !== "leyendo" || !el.videoWidth || !ctx) return;
          ultimo = t;
          const escala = Math.min(1, 640 / el.videoWidth); lienzo.width = Math.round(el.videoWidth * escala); lienzo.height = Math.round(el.videoHeight * escala);
          ctx.drawImage(el, 0, 0, lienzo.width, lienzo.height);
          const r = jsQR(ctx.getImageData(0, 0, lienzo.width, lienzo.height).data, lienzo.width, lienzo.height, { inversionAttempts: "dontInvert" });
          if (r?.data) void revisarRef.current(r.data);
        };
        cuadro = requestAnimationFrame(leer);
      } catch (e) {
        const negado = e instanceof DOMException && (e.name === "NotAllowedError" || e.name === "SecurityError");
        setAviso(negado ? "No diste permiso para usar la cámara. Actívalo en el navegador o escribe el código." : "No se pudo abrir la cámara. Escribe el código que aparece debajo del QR.");
      }
    })();
    return () => { parar = true; montado.current = false; cancelAnimationFrame(cuadro); flujo?.getTracks().forEach(t => t.stop()); };
  }, []);

  const confirmar = async () => {
    if (!datos || fase === "guardando") return;
    setFase("guardando"); setError("");
    try { await canjearQr(codigo, mensajeroId); if (montado.current) setFase("lista"); else v.avisar(datos.guia + " ya es tuyo: recógelo con la foto."); }
    catch (e) { if (montado.current) { setError(motivoError(e)); setFase("vista"); } else v.avisar("No se pudo recibir: " + motivoError(e)); }
  };
  const otro = () => { setDatos(null); setCodigo(""); setError(""); setFase("leyendo"); };

  return <>
    <header><h2>{fase === "lista" ? "Paquete recibido" : fase === "vista" || fase === "guardando" ? "¿Es este paquete?" : "Escanear QR"}</h2><button className="cerrar" data-cerrar aria-label="Cerrar">×</button></header>
    {datos && fase !== "leyendo" && fase !== "buscando" ? <>
      <dl className="datos rec-datos qr-datos">
        <div><dt>Guía</dt><dd><b>{datos.guia}</b></dd></div>
        {datos.remitente && <div><dt>Remitente</dt><dd>{datos.remitente}</dd></div>}
        <div><dt>Entregar a</dt><dd>{datos.destinatarioNombre}<br />{datos.direccionEntrega}</dd></div>
        {datos.paquetes > 1 && <div><dt>Paquetes</dt><dd>{datos.paquetes}</dd></div>}
        {datos.patinadorNombre && <div><dt>Lo recogió</dt><dd>{datos.patinadorNombre}</dd></div>}
      </dl>
      {fase === "lista" ? <p className="qr-nota" role="status">Ya es tuyo. Todavía está por recoger: tómale la foto al paquete para que pase a en ruta.</p>
        : datos.yaEsTuyo ? <p className="qr-nota" role="status">Este paquete ya es tuyo. Sigue en “Por recoger”.</p>
        : <p className="qr-nota">Confirma solo si tienes el paquete en la mano.</p>}
      {error && <div className="aviso alerta" role="alert">{error}</div>}
      <div className="acciones ng-acciones">
        {fase === "lista" || datos.yaEsTuyo ? <button type="button" className="btn ok" onClick={() => v.abrir(<DlgRecoger guia={datos.guia} />, "centrada")}>Recoger ahora (foto)</button>
          : <button type="button" className="btn" disabled={fase === "guardando"} onClick={confirmar}>{fase === "guardando" ? "Guardando…" : "Quedármelo"}</button>}
        {fase !== "guardando" && fase !== "lista" && !datos.yaEsTuyo && <button type="button" className="btn sec" onClick={otro}>No es este</button>}
        {(fase === "lista" || datos.yaEsTuyo) && <button type="button" className="btn sec" data-cerrar>Después</button>}
      </div>
    </> : <>
      <p className="sub">Apunta la cámara al QR que te muestra administración.</p>
      <div className="qr-visor" aria-hidden={!!aviso}>
        <video ref={video} playsInline muted />
        {!aviso && <span className="qr-marco" aria-hidden="true" />}
        {fase === "buscando" && <span className="qr-capa" role="status"><span className="ng-girador" aria-hidden="true" />Buscando el paquete…</span>}
        {aviso && <p className="qr-sin-camara">{aviso}</p>}
      </div>
      {error && <div className="aviso alerta" role="alert">{error}</div>}
      <form className="qr-manual" onSubmit={e => { e.preventDefault(); void revisar(escrito); }}>
        <label htmlFor="qr-codigo">O escribe el código</label>
        <div><input id="qr-codigo" value={escrito} onChange={e => setEscrito(e.target.value)} placeholder="XXXXX-XXXXX" autoComplete="off" autoCapitalize="characters" spellCheck={false} maxLength={14} />
          <button type="submit" className="btn sec" disabled={!escrito.trim() || fase === "buscando"}>Buscar</button></div>
      </form>
      <div className="acciones ng-acciones"><button type="button" className="btn sec" data-cerrar>Cancelar</button></div>
    </>}
  </>;
}
