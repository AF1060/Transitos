import type { Context } from '@netlify/functions';
import { db } from './_db';

export default async (req: Request, _context: Context) => {
  const { sightings } = await req.json();
  const recs = (sightings ?? []).slice(0, 300);
  for (const s of recs) {
    await db.sql`
      INSERT INTO aircraft_sightings (callsign, icao24, airline, seen_at, weekday, minute_of_day, latitude, longitude, altitude_m, track, speed)
      VALUES (${s.callsign}, ${s.icao24}, ${s.airline}, ${s.seenAt}, ${s.weekday}, ${s.minuteOfDay}, ${s.latitude}, ${s.longitude}, ${s.altitudeM}, ${s.track}, ${s.speed})
    `;
  }
  return Response.json({ saved: recs.length });
};
