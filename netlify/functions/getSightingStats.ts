import type { Context } from '@netlify/functions';
import { db } from './_db';

export default async (req: Request, _context: Context) => {
  const { minFrom, minTo, weekday } = await req.json();

  const totals = await db.sql`
    SELECT COUNT(*) AS n, COUNT(DISTINCT to_char(seen_at AT TIME ZONE 'Europe/Lisbon', 'YYYY-MM-DD')) AS days,
           MIN(to_char(seen_at AT TIME ZONE 'Europe/Lisbon', 'YYYY-MM-DD')) AS first
    FROM aircraft_sightings
  `;
  const rows = await db.sql`
    SELECT callsign, airline, weekday, minute_of_day, latitude, longitude, altitude_m, track, speed,
           to_char(seen_at AT TIME ZONE 'Europe/Lisbon', 'YYYY-MM-DD') AS day
    FROM aircraft_sightings
    WHERE minute_of_day BETWEEN ${minFrom} AND ${minTo}
      AND (${weekday}::int IS NULL OR weekday = ${weekday}::int)
      AND altitude_m > 1500
    ORDER BY seen_at DESC
    LIMIT 10001
  `;
  const t = (totals[0] ?? {}) as any;
  const truncated = rows.length > 10000;
  return Response.json({
    totalSightings: Number(t.n ?? 0),
    daysObserved: Number(t.days ?? 0),
    firstDay: t.first ? String(t.first) : null,
    truncated,
    rows: rows.slice(0, 10000).map((x: any) => ({
      callsign: String(x.callsign ?? ''), airline: String(x.airline ?? ''), weekday: Number(x.weekday),
      minuteOfDay: Number(x.minute_of_day), day: String(x.day),
      latitude: Number(x.latitude), longitude: Number(x.longitude), altitudeM: Number(x.altitude_m),
      track: Number(x.track), speed: Number(x.speed),
    })),
  });
};
