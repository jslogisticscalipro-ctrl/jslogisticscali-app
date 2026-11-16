/* Opción "Instalar app" del menú de perfil. Solo aparece si se puede instalar (Android/computador) o si es Safari de iPhone, donde se explica cómo. */
import { alertaAdmin } from "../lib/alertasAdmin";
import { useInstalarApp } from "../lib/pwa";

const PASOS_IOS = "En Safari toca el botón Compartir (el cuadrado con la flecha hacia arriba), baja y elige «Agregar a pantalla de inicio». Después ábrela desde el ícono nuevo.";

export function OpcionInstalarApp({ alAccionar }: { alAccionar: () => void }) {
  const { modo, instalar } = useInstalarApp();
  if (!modo) return null;
  return <button type="button" className="perfil-opcion" onClick={() => {
    alAccionar();
    if (modo === "instalar") void instalar();
    else void alertaAdmin.info("Instala la app en tu iPhone", PASOS_IOS);
  }}>
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 3v12" /><path d="m7 11 5 5 5-5" /><path d="M5 21h14" /></svg>
    <span>Instalar app</span>
  </button>;
}
