import * as Astronomy from 'astronomy-engine';
import * as satellite from 'satellite.js';
import { DEG, Vec, LatLon, geodeticToEcef, enuVec, azElFromEnu } from './_geo';

export type Target = 'Sol' | 'Lua';
const AU_KM = 149597870.7;
const RADIUS_KM: Record<Target, number> = { Sol: 696000, Lua: 1737.4 };
const bodyOf = (t: Target) => (t === 'Sol' ? Astronomy.Body.Sun : Astronomy.Body.Moon);

const STEP = 300_000;
const caches: Record<Target, Map<number, Vec>> = { Sol: new Map(), Lua: new Map() };

function eqdAt(target: Target, k: number): Vec {
  const c = caches[target];
  let v = c.get(k);
  if (!v) {
    const t = Astronomy.MakeTime(new Date(k * STEP));
    const g = Astronomy.GeoVector(bodyOf(target), t, true);
    const q = Astronomy.RotateVector(Astronomy.Rotation_EQJ_EQD(t), g);
    v = [q.x * AU_KM, q.y * AU_KM, q.z * AU_KM];
    if (c.size > 20000) c.clear();
    c.set(k, v);
  }
  return v;
}

/** Posição geofixa do Sol ou da Lua (km), consistente com o referencial GMST do satellite.js. */
export function bodyEcefKm(target: Target, date: Date): Vec {
  const ms = date.getTime();
  const k = Math.floor(ms / STEP);
  const a = eqdAt(target, k);
  const b = eqdAt(target, k + 1);
  const f = (ms - k * STEP) / STEP;
  const x = a[0] + (b[0] - a[0]) * f, y = a[1] + (b[1] - a[1]) * f, z = a[2] + (b[2] - a[2]) * f;
  const th = satellite.gstime(date);
  return [Math.cos(th) * x + Math.sin(th) * y, -Math.sin(th) * x + Math.cos(th) * y, z];
}

export interface BodyState {
  az: number;
  el: number;
  distKm: number;
  radiusDeg: number;
  diamDeg: number;
  enu: Vec;
}

export function bodyTopo(target: Target, date: Date, obs: LatLon): BodyState {
  const oe = geodeticToEcef(obs.lat, obs.lon, 0);
  const enu = enuVec(obs, oe, bodyEcefKm(target, date));
  const { az, el, range } = azElFromEnu(enu);
  const r = Math.asin(RADIUS_KM[target] / range) / DEG;
  return { az, el, distKm: range, radiusDeg: r, diamDeg: 2 * r, enu };
}
