import { bodyTopo, Target } from './_astro';
import { DEG, destination, haversineKm, LatLon } from './_geo';
import { fetchPlanes, RawPlane } from './_aircraftSources';
import { db } from './_db';

const RADAR_KM = 120;
const RADIUS = 50; // km à volta de casa onde o alinhamento interessa

function lisbonParts(d: Date) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Lisbon', weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(d).map((x) => [x.type, x.value]));
  return { weekday: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].indexOf(p.weekday as string), minuteOfDay: Number(p.hour) * 60 + Number(p.minute) };
}

/** O avião pode alinhar com o corpo a partir de um ponto a menos de RADIUS km de casa, nos próximos ±150 s? */
function relevant(p: RawPlane, home: LatLon, up: { body: Target; az: number; el: number }[]) {
  for (const b of up) {
    const back = (b.az + 180) % 360;
    const d = p.altM / 1000 / Math.tan(b.el * DEG);
    if (d > 300) continue;
    for (let s = -150; s <= 150; s += 15) {
      const pt = destination(p, p.track, (p.velocity * s) / 1000);
      if (haversineKm(home, destination(pt, back, d)) <= RADIUS) return true;
    }
  }
  return false;
}

/**
 * Versão single-user: já não há "owner" nem ciclo por vários utilizadores — há sempre, no máximo, uma
 * linha em observer_settings (id = 1). Se ainda não existir (app nunca configurada), não há nada a
 * recolher.
 */
export async function collectOnce(dryRun = false) {
  const rows = await db.sql`SELECT latitude, longitude, min_elevation_degrees FROM observer_settings WHERE id = 1`;
  const s = rows[0] as { latitude: number | null; longitude: number | null; min_elevation_degrees: number } | undefined;
  const out: { seen: number; saved: number; source?: string; skipped?: string }[] = [];
  if (!s) { out.push({ seen: 0, saved: 0, skipped: 'Definições do observador ainda não guardadas' }); return out; }

  const now = new Date();
  const home = { lat: s.latitude ?? 38.7223, lon: s.longitude ?? -9.1393 };
  const minEl = s.min_elevation_degrees ?? 10;
  const up = (['Sol', 'Lua'] as const)
    .map((body) => ({ body, ...bodyTopo(body, now, home) }))
    .filter((b) => b.el >= minEl);
  if (!up.length) { out.push({ seen: 0, saved: 0, skipped: 'Sol e Lua abaixo da elevação mínima' }); return out; }

  let fetched: Awaited<ReturnType<typeof fetchPlanes>>;
  try {
    fetched = await fetchPlanes(home.lat, home.lon, RADAR_KM);
  } catch (e) {
    out.push({ seen: 0, saved: 0, skipped: `Sem fontes disponíveis (${e instanceof Error ? e.message : 'erro'})` });
    return out;
  }
  const planes = fetched.planes
    .filter((p) => p.altM > 1500 && p.velocity > 60 && /^[A-Z]{3}\d/.test(p.callsign) && relevant(p, home, up));

  if (!dryRun) {
    for (const p of planes) {
      const d = new Date(p.posTime * 1000);
      const { weekday, minuteOfDay } = lisbonParts(d);
      await db.sql`
        INSERT INTO aircraft_sightings (callsign, icao24, airline, seen_at, weekday, minute_of_day, latitude, longitude, altitude_m, track, speed)
        VALUES (${p.callsign}, ${p.icao24}, ${p.callsign.slice(0, 3)}, ${d.toISOString()}, ${weekday}, ${minuteOfDay}, ${p.lat}, ${p.lon}, ${Math.round(p.altM)}, ${Math.round(p.track)}, ${p.velocity})
      `;
    }
  }
  out.push({ seen: planes.length, saved: dryRun ? 0 : planes.length, source: fetched.source });
  return out;
}
