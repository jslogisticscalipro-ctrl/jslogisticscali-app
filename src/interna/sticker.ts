/* Sticker con el QR de traspaso, para imprimirlo en una impresora de etiquetas y pegarlo al paquete.
   Igual que los tiquetes (tiquete.ts): se arma en un marco oculto y se llama a print(); la persona elige la impresora de
   stickers en la ventana del sistema. Lleva solo lo necesario: QR, código escrito, guía y remitente (sin teléfonos ni direcciones,
   porque el paquete anda a la vista de todos). */

export type TamanoSticker = "60x40" | "100x50";
export const TAMANOS_STICKER: [TamanoSticker, string][] = [["60x40", "60 × 40 mm"], ["100x50", "100 × 50 mm"]];
const CLAVE_TAMANO = "js_sticker", CLAVE_AUTO = "js_sticker_auto";

export const tamanoStickerGuardado = (): TamanoSticker => { try { return localStorage.getItem(CLAVE_TAMANO) === "100x50" ? "100x50" : "60x40"; } catch { return "60x40"; } };
export const guardarTamanoSticker = (t: TamanoSticker) => { try { localStorage.setItem(CLAVE_TAMANO, t); } catch { /* sin almacenamiento */ } };
export const imprimirAlGenerarGuardado = () => { try { return localStorage.getItem(CLAVE_AUTO) === "1"; } catch { return false; } };
export const guardarImprimirAlGenerar = (v: boolean) => { try { localStorage.setItem(CLAVE_AUTO, v ? "1" : "0"); } catch { /* sin almacenamiento */ } };

const esc = (s: string) => s.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));
/** Medidas (mm) por tamaño: ancho, alto, lado del QR y letras. */
const MEDIDAS: Record<TamanoSticker, { w: number; h: number; qr: number; guia: number; codigo: number; texto: number }> = {
  "60x40": { w: 60, h: 40, qr: 34, guia: 4.2, codigo: 2.7, texto: 2.6 },
  "100x50": { w: 100, h: 50, qr: 42, guia: 6, codigo: 4.4, texto: 3.4 }
};

export function imprimirSticker({ imagenQr, guia, codigo, remitente, tamano }: { imagenQr: string; guia: string; codigo: string; remitente: string; tamano: TamanoSticker }) {
  const m = MEDIDAS[tamano], pad = 2;
  const fr = document.createElement("iframe");
  fr.setAttribute("aria-hidden", "true");
  fr.style.cssText = "position:fixed;width:0;height:0;border:0;right:0;bottom:0";
  document.body.appendChild(fr);
  const d = fr.contentWindow?.document; if (!d) { fr.remove(); return; }
  d.open();
  d.write(`<!doctype html><html><head><meta charset="utf-8"><title>Sticker ${esc(guia)}</title><style>
@page{size:${m.w}mm ${m.h}mm;margin:0}
html,body{margin:0;background:#fff;color:#000;font-family:Arial,Helvetica,sans-serif}
.s{box-sizing:border-box;width:${m.w}mm;height:${m.h}mm;padding:${pad}mm;display:flex;align-items:center;gap:${pad}mm;overflow:hidden;break-after:page}
.s img{width:${m.qr}mm;height:${m.qr}mm;flex:none;image-rendering:pixelated}
.t{min-width:0;display:flex;flex-direction:column;gap:1mm}
.g{font-size:${m.guia}mm;font-weight:700;line-height:1.1}
.c{white-space:nowrap;font:700 ${m.codigo}mm/1.1 "Courier New",monospace;letter-spacing:.1mm}
.r{font-size:${m.texto}mm;line-height:1.2;overflow-wrap:anywhere}
.p{font-size:${m.texto}mm;line-height:1.2}
</style></head><body><div class="s"><img src="${esc(imagenQr)}" alt=""><div class="t"><div class="g">${esc(guia)}</div><div class="c">${esc(codigo)}</div><div class="r">${esc(remitente)}</div><div class="p">Escanea con la app de JS</div></div></div></body></html>`);
  d.close();
  setTimeout(() => { fr.contentWindow?.focus(); fr.contentWindow?.print(); setTimeout(() => fr.remove(), 60000); }, 300);
}
