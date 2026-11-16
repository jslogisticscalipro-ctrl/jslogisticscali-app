/* Oficina → Solicitudes → "Por pasar a mensajero": guías que un patinador ya recogió. Administración genera el QR y el mensajero
   lo escanea desde su app: la guía existente pasa a su nombre (no se crea otra). El QR lleva solo un código de un solo uso. */
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { QrTraspaso } from "../../api/tipos";
import { useVentana } from "../ui";
import { motivoError } from "../datos";
import { hora } from "../motor";
import { TAMANOS_STICKER, guardarImprimirAlGenerar, guardarTamanoSticker, imprimirAlGenerarGuardado, imprimirSticker, tamanoStickerGuardado, type TamanoSticker } from "../sticker";
import { codigoLegible, generarQr, recogidasEnEspera, textoQr } from "../traspaso";

export const claveRecogidas = ["recogidas", "por-pasar"] as const;

function ModalQr({ guia, remitente, alCambiar }: { guia: string; remitente: string; alCambiar: () => void }) {
  const v = useVentana();
  const [qr, setQr] = useState<QrTraspaso | null>(null), [imagen, setImagen] = useState(""), [error, setError] = useState(""), [cargando, setCargando] = useState(true);
  const [cuenta, setCuenta] = useState(0), [ahora, setAhora] = useState(Date.now());
  const [tamano, setTamano] = useState<TamanoSticker>(tamanoStickerGuardado), [auto, setAuto] = useState(imprimirAlGenerarGuardado);
  const imprimir = (q: QrTraspaso, img: string) => imprimirSticker({ imagenQr: img, guia, codigo: codigoLegible(q.codigo), remitente, tamano });
  useEffect(() => {
    let vivo = true; setCargando(true); setError("");
    (async () => {
      try {
        const nuevo = await generarQr(guia); // el servidor anula el QR anterior de esta guía
        const { default: QRCode } = await import("qrcode"); // solo se descarga al generar un QR
        const url = await QRCode.toDataURL(textoQr(nuevo.codigo), { width: 640, margin: 2, errorCorrectionLevel: "M" }); // grande, para que el sticker salga nítido
        if (vivo) { setQr(nuevo); setImagen(url); alCambiar(); if (imprimirAlGenerarGuardado()) imprimir(nuevo, url); }
      } catch (e) { if (vivo) { setQr(null); setError(motivoError(e)); } }
      finally { if (vivo) setCargando(false); }
    })();
    return () => { vivo = false; };
  }, [guia, cuenta]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { const t = window.setInterval(() => setAhora(Date.now()), 30_000); return () => window.clearInterval(t); }, []);
  const faltan = qr ? Math.max(0, Math.round((Date.parse(qr.vence) - ahora) / 60_000)) : 0;
  return <>
    <header><h2>QR de {guia}</h2><button className="cerrar" data-cerrar aria-label="Cerrar">×</button></header>
    <p className="sub">{remitente}. El mensajero lo escanea desde su app y la guía pasa a su nombre.</p>
    {cargando ? <div className="vacio" role="status">Generando el QR…</div>
      : error ? <div className="aviso alerta" role="alert">{error}</div>
      : qr && <div className="qr-caja">
        <img src={imagen} alt={"Código QR de la guía " + guia} width={260} height={260} />
        <p className="qr-codigo" aria-label="Código para escribir a mano">{codigoLegible(qr.codigo)}</p>
        <p className="sub">{faltan > 0 ? "Vence en " + (faltan >= 60 ? Math.floor(faltan / 60) + " h " + (faltan % 60) + " min" : faltan + " min") + ". Sirve una sola vez." : "Venció: genera uno nuevo."}</p>
      </div>}
    {qr && !cargando && <div className="qr-sticker">
      <div className="campo"><label htmlFor="qr-tamano">Tamaño del sticker</label>
        <select id="qr-tamano" value={tamano} onChange={e => { const t = e.target.value as TamanoSticker; setTamano(t); guardarTamanoSticker(t); }}>{TAMANOS_STICKER.map(([k, t]) => <option key={k} value={k}>{t}</option>)}</select></div>
      <label className="qr-auto"><input type="checkbox" checked={auto} onChange={e => { setAuto(e.target.checked); guardarImprimirAlGenerar(e.target.checked); }} /> Imprimir al generar</label>
    </div>}
    <div className="acciones ng-acciones">
      {qr && !cargando && <button type="button" className="btn" onClick={() => imprimir(qr, imagen)}>Imprimir sticker</button>}
      <button type="button" className="btn sec" disabled={cargando} onClick={async () => { if (!qr || await v.confirmar("¿Generar otro QR?", "El sticker que ya imprimiste deja de servir: tendrás que pegar el nuevo.", "Sí, generar otro")) setCuenta(c => c + 1); }}>Generar uno nuevo</button>
      <button type="button" className="btn sec" data-cerrar>Cerrar</button>
    </div>
  </>;
}

export default function RecogidasPatinador() {
  const v = useVentana(), qc = useQueryClient();
  const q = useQuery({ queryKey: claveRecogidas, queryFn: () => recogidasEnEspera(), refetchInterval: 60_000 });
  if (!q.data?.length) return null;
  return <section className="rp-seccion" aria-label="Recogidas por pasar a mensajero">
    <h2>Por pasar a mensajero <span className="num amb">{q.data.length}</span></h2>
    <p className="sub">Un patinador ya recogió estos paquetes. Genera el QR y el mensajero lo escanea para quedarse con la guía.</p>
    <div className="lista">{q.data.map(r => <div className="fila rp-fila" key={r.guia}>
      <span className="info"><span className="guia">{r.guia}</span> <span className="etq pend">Con {r.patinadorNombre}</span>
        <p>{r.remitente} → {r.destinatarioNombre} · {r.paquetes} {r.paquetes === 1 ? "paquete" : "paquetes"} · recogido {hora(Date.parse(r.recogidoEn))}</p>
        <p>{r.codigoVence ? "QR generado, vence " + hora(Date.parse(r.codigoVence)) : "Sin QR todavía"}</p></span>
      <button type="button" className="btn chico" onClick={() => v.abrir(<ModalQr guia={r.guia} remitente={r.remitente} alCambiar={() => void qc.invalidateQueries({ queryKey: claveRecogidas })} />, "centrada")}>{r.codigoVence ? "Generar otro QR" : "Generar QR"}</button>
    </div>)}</div>
  </section>;
}
