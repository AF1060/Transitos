import { DEG, Vec, LatLon, sub, norm, dot, cross, len, rayEarth, ecefToGeodetic, haversineKm, bearingDeg } from './geo';
export const OFFSET_FRAC = 2 / 3;
export interface OffsetBand {
  frac: number; centre: LatLon; below: LatLon; above: LatLon;
  halfWidthM: number; belowBrg: number; discCentreS: number; discEdgeS: number;
}
export function offsetBand(pe: Vec, vel: Vec, be: Vec, radiusDeg: number, up: Vec, frac = OFFSET_FRAC, hKm = 0): OffsetBand | null {
  const u = norm(sub(be, pe));
  const vp: Vec = [vel[0] - dot(vel, u) * u[0], vel[1] - dot(vel, u) * u[1], vel[2] - dot(vel, u) * u[2]];
  const speed = len(vp);
  if (speed < 1e-9) return null;
  const m: Vec = [vp[0] / speed, vp[1] / speed, vp[2] / speed];
  let n = norm(cross(u, m));
  if (dot(n, up) > 0) n = [-n[0], -n[1], -n[2]];
  const d = frac * radiusDeg * DEG;
  const [c, s] = [Math.cos(d), Math.sin(d)];
  const ground = (sign: number): LatLon | null => {
    const w: Vec = norm([u[0] * c + sign * n[0] * s, u[1] * c + sign * n[1] * s, u[2] * c + sign * n[2] * s]);
    const g = rayEarth(pe, [-w[0], -w[1], -w[2]], hKm);
    return g ? ecefToGeodetic(g) : null;
  };
  const gc = rayEarth(pe, [-u[0], -u[1], -u[2]], hKm);
  const below = ground(1), above = ground(-1);
  if (!gc || !below || !above) return null;
  const centre = ecefToGeodetic(gc);
  const angSpeed = speed / len(sub(pe, gc));
  const r = radiusDeg * DEG;
  return { frac, centre, below, above, halfWidthM: ((haversineKm(centre, below) + haversineKm(centre, above)) / 2) * 1000, belowBrg: bearingDeg(centre, below), discCentreS: (2 * r) / angSpeed, discEdgeS: (2 * r * Math.sqrt(1 - frac * frac)) / angSpeed };
}
