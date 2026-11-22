import type { Context } from '@netlify/functions';
import { db } from './_db';

export default async (_req: Request, _context: Context) => {
  const rows = await db.sql`SELECT * FROM observer_settings WHERE id = 1`;
  const r = rows[0] as any;
  if (!r) return Response.json({ settings: null });
  return Response.json({
    settings: {
      useGps: r.use_gps ?? true,
      latitude: r.latitude ?? null,
      longitude: r.longitude ?? null,
      defaultTarget: r.default_target ?? 'Sol',
      marginDegrees: r.margin_degrees ?? 2,
      maxTravelKm: r.max_travel_km ?? 30,
      minElevationDegrees: r.min_elevation_degrees ?? 10,
      focalLengthMm: r.focal_length_mm ?? 600,
      sensor: r.sensor ?? 'Micro 4/3',
      issAlertMinutes: r.iss_alert_minutes ?? 15,
      aircraftAlertSeconds: r.aircraft_alert_seconds ?? 60,
      voiceAlerts: r.voice_alerts ?? true,
      aircraftOffsetPercent: r.aircraft_offset_percent ?? 80,
      issOffsetPercent: r.iss_offset_percent ?? 67,
    },
  });
};
