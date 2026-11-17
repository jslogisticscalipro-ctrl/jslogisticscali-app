/* Avisos en tiempo real del backend (GET /eventos). Cuando cambia una colección, se vuelve a pedir lo que usa esa
   pantalla. Si el navegador o el proxy no mantienen SSE, las consultas siguen con su sondeo normal. */
import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { BASE } from "../api/cliente";
import { DEMO } from "./demo";

/** `alCambiar`: llegó un aviso con las colecciones que cambiaron. `alCanal`: el canal en tiempo real se conectó (true) o se cayó (false). */
export interface AvisosEventos { alCambiar?: (cols: string[]) => void; alCanal?: (vivo: boolean) => void }

export function useEventos(avisos?: AvisosEventos) {
  const qc = useQueryClient();
  const aviso = useRef(avisos);
  useEffect(() => { aviso.current = avisos; });
  useEffect(() => {
    if (DEMO || typeof EventSource === "undefined") return;
    const es = new EventSource(`${BASE}/eventos`, { withCredentials: true });
    const alCambiar = (e: MessageEvent) => {
      try {
        const d = JSON.parse(e.data) as { cols?: string[] };
        if (d?.cols?.length) aviso.current?.alCambiar?.(d.cols);
        if (d?.cols?.includes("solicitudes")) qc.invalidateQueries({ queryKey: ["solicitudes"] }, { cancelRefetch: false }); // si ya hay un refresco en curso (por la acción de esta pantalla), no se repite
        if (d?.cols?.includes("recaudos") || d?.cols?.includes("caja_patinador")) qc.invalidateQueries({ queryKey: ["patinador"] }); // el resumen de patinadores (Caja) se arma con sus pagos y con lo que ya entregaron
        // Las cifras de Cuentas → Cuentas vienen del servidor y cruzan casi todo (guías, pagos, caja, sueldos): cualquier cambio
        // las deja viejas. Solo se vuelven a pedir si están en pantalla.
        if (d?.cols?.length) qc.invalidateQueries({ queryKey: ["cuentas", "resumen"] }, { cancelRefetch: false });
        if (d?.cols?.includes("pedidos")) { qc.invalidateQueries({ queryKey: ["pedidos"] }); qc.invalidateQueries({ queryKey: ["patinador"] }); qc.invalidateQueries({ queryKey: ["recogidas"] }); }
      } catch { /* un evento incompleto no debe romper la pantalla */ }
    };
    es.addEventListener("cambio", alCambiar);
    es.onopen = () => aviso.current?.alCanal?.(true);
    es.onerror = () => aviso.current?.alCanal?.(false); // el navegador reintenta solo (retry: 5000)
    return () => { es.removeEventListener("cambio", alCambiar); es.close(); aviso.current?.alCanal?.(false); };
  }, [qc]);
}
