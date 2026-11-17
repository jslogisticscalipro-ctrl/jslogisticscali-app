/* Prueba que diaDe, hora y horaCorta de interna/motor.ts dan el mismo texto que la forma anterior
   (toLocale… con las mismas opciones), incluidos los cambios de día en Colombia, fin de mes y de año, y fechas inválidas.
   Uso: node --experimental-strip-types scripts/prueba-fechas.mjs */
import { diaDe, hora, horaCorta } from "../src/interna/motor.ts";

const ZONA = "America/Bogota";
const antes = {
  diaDe: ts => new Date(ts).toLocaleDateString("en-CA", { timeZone: ZONA }),
  hora: ts => new Date(Number(ts) || 0).toLocaleString("es-CO", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", timeZone: ZONA }),
  horaCorta: ts => new Date(ts).toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit", timeZone: ZONA }),
};
const ahora = { diaDe, hora, horaCorta };

const casos = [0, null, undefined, NaN, Date.now()];
// Alrededor de la medianoche de Colombia (05:00 UTC) en fin de mes, fin de año y un año bisiesto.
for (const iso of ["2025-12-31", "2026-01-01", "2026-02-28", "2026-03-01", "2024-02-29", "2026-11-30", "2026-12-01"])
  for (const min of [-61, -1, 0, 1, 59, 60, 61]) casos.push(Date.parse(iso + "T05:00:00Z") + min * 60_000);
// Una fecha cada 7 minutos y 13 segundos durante dos años.
for (let t = Date.parse("2025-01-01T00:00:00Z"); t < Date.parse("2027-01-01T00:00:00Z"); t += 433_000) casos.push(t);

let fallos = 0;
for (const f of Object.keys(antes))
  for (const ts of casos) {
    if (f === "diaDe" && (ts === null || ts === undefined)) continue; // el tipo no lo permite; NaN sí se prueba
    const a = antes[f](ts), b = ahora[f](ts);
    if (a !== b && fallos++ < 10) console.error(`${f}(${ts}): antes "${a}", ahora "${b}"`);
  }
if (fallos) { console.error(`${fallos} diferencias`); process.exit(1); }
console.log(`OK: ${casos.length} fechas, mismo resultado en diaDe, hora y horaCorta.`);
