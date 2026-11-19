/* Compresión de fotos en el celular antes de subirlas. Mismos valores que la app actual:
   800 px y calidad 0,5 para las fotos (~100 KB), 140 px para la miniatura de la lista. */
export const FOTO = { px: 800, calidad: 0.5 };
export const MINI = { px: 140, calidad: 0.6 };

const aBlob = (c: HTMLCanvasElement, calidad: number) =>
  new Promise<Blob>((ok, mal) => c.toBlob(b => (b ? ok(b) : mal(new Error("No se pudo preparar la foto"))), "image/jpeg", calidad));

/* Los Samsung (y otros Android) guardan las fotos de la galería en HEIC/HEIF si la cámara tiene activadas las
   «Imágenes de alta eficiencia». Chrome y Samsung Internet no saben abrir ese formato, así que la foto no se puede
   preparar. La cámara de la app sí entrega JPEG: por eso con la cámara funciona y desde la galería no. */
const MARCAS_HEIF = ["heic", "heix", "hevc", "hevx", "heim", "heis", "mif1", "msf1"];

/** ¿El archivo es HEIC/HEIF? Mira el tipo y, si no lo trae, los primeros bytes (`ftypheic`, `ftypmif1`…). */
export async function esHeif(archivo: Blob): Promise<boolean> {
  if (/^image\/hei[cf]/i.test(archivo.type)) return true;
  try {
    const b = new Uint8Array(await archivo.slice(0, 12).arrayBuffer());
    const txt = String.fromCharCode(...b.slice(4, 12));
    return txt.startsWith("ftyp") && MARCAS_HEIF.includes(txt.slice(4));
  } catch { return false; }
}

export const AVISO_HEIF = "la foto está en formato HEIC (alta eficiencia) y el celular no la deja abrir aquí. Tómala con el botón de cámara, o en la cámara del celular ve a Ajustes › Formatos de imagen y apaga «Imágenes de alta eficiencia»";

/** Abre la imagen. Si `createImageBitmap` falla (pasa en algunos Android con fotos grandes), prueba con un <img>. */
async function abrir(archivo: Blob): Promise<{ img: CanvasImageSource; ancho: number; alto: number; soltar: () => void }> {
  try {
    const b = await createImageBitmap(archivo);
    return { img: b, ancho: b.width, alto: b.height, soltar: () => b.close() };
  } catch { /* se intenta con <img> */ }
  const url = URL.createObjectURL(archivo);
  try {
    const el = new Image();
    el.decoding = "async";
    el.src = url;
    await el.decode();
    if (!el.naturalWidth) throw new Error("vacía");
    return { img: el, ancho: el.naturalWidth, alto: el.naturalHeight, soltar: () => URL.revokeObjectURL(url) };
  } catch {
    URL.revokeObjectURL(url);
    if (await esHeif(archivo)) throw new Error(AVISO_HEIF.charAt(0).toUpperCase() + AVISO_HEIF.slice(1));
    throw new Error("No se pudo abrir esa foto. Si está en la nube, descárgala primero, o tómala con la cámara");
  }
}

/** Prepara la foto en varios tamaños abriéndola una sola vez (abrir una foto de 12 a 108 MP dos veces a la vez
    puede agotar la memoria del celular). Cada tamaño queda en JPEG con fondo blanco y `px` en su lado mayor. */
export async function prepararFoto(archivo: Blob, tamanos: { px: number; calidad: number }[]): Promise<Blob[]> {
  const { img, ancho, alto, soltar } = await abrir(archivo);
  try {
    const salida: Blob[] = [];
    for (const { px, calidad } of tamanos) {
      const k = Math.min(1, px / Math.max(ancho, alto));
      const c = document.createElement("canvas");
      c.width = Math.max(1, Math.round(ancho * k));
      c.height = Math.max(1, Math.round(alto * k));
      const x = c.getContext("2d")!;
      x.fillStyle = "#fff"; // las transparencias de un PNG quedan blancas, no negras
      x.fillRect(0, 0, c.width, c.height);
      x.drawImage(img, 0, 0, c.width, c.height);
      salida.push(await aBlob(c, calidad));
      c.width = c.height = 0; // suelta la memoria del lienzo de una vez
    }
    return salida;
  } finally { soltar(); }
}

/** Reduce la imagen a `px` en su lado mayor y la pasa a JPEG con fondo blanco. */
export async function comprimir(archivo: Blob, tamano = FOTO): Promise<Blob> {
  return (await prepararFoto(archivo, [tamano]))[0];
}

/** Copia la firma a 480 px de ancho sobre fondo blanco (así se ve igual en modo oscuro). */
export function firmaABlob(lienzo: HTMLCanvasElement): Promise<Blob> {
  const c = document.createElement("canvas");
  c.width = 480;
  c.height = Math.round((480 * lienzo.height) / lienzo.width);
  const x = c.getContext("2d")!;
  x.fillStyle = "#fff";
  x.fillRect(0, 0, c.width, c.height);
  x.drawImage(lienzo, 0, 0, c.width, c.height);
  return aBlob(c, 0.7);
}
