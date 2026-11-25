import type { Context } from '@netlify/functions';
import { db } from './_db';

export default async (req: Request, _context: Context) => {
  const b = await req.json();
  await db.sql`
    INSERT INTO observer_settings (
      id, use_gps, latitude, longitude, observer_altitude_m, default_target, margin_degrees, max_travel_km,
      min_elevation_degrees, focal_length_mm, sensor, iss_alert_minutes, aircraft_alert_seconds,
      voice_alerts, aircraft_offset_percent, iss_offset_percent, updated_at
    ) VALUES (
      1, ${b.useGps}, ${b.latitude}, ${b.longitude}, ${b.observerAltitudeM ?? 0}, ${b.defaultTarget}, ${b.marginDegrees}, ${b.maxTravelKm},
      ${b.minElevationDegrees}, ${b.focalLengthMm}, ${b.sensor}, ${b.issAlertMinutes}, ${b.aircraftAlertSeconds},
      ${b.voiceAlerts}, ${b.aircraftOffsetPercent}, ${b.issOffsetPercent}, now()
    )
    ON CONFLICT (id) DO UPDATE SET
      use_gps = EXCLUDED.use_gps, latitude = EXCLUDED.latitude, longitude = EXCLUDED.longitude,
      observer_altitude_m = EXCLUDED.observer_altitude_m,
      default_target = EXCLUDED.default_target, margin_degrees = EXCLUDED.margin_degrees,
      max_travel_km = EXCLUDED.max_travel_km, min_elevation_degrees = EXCLUDED.min_elevation_degrees,
      focal_length_mm = EXCLUDED.focal_length_mm, sensor = EXCLUDED.sensor,
      iss_alert_minutes = EXCLUDED.iss_alert_minutes, aircraft_alert_seconds = EXCLUDED.aircraft_alert_seconds,
      voice_alerts = EXCLUDED.voice_alerts, aircraft_offset_percent = EXCLUDED.aircraft_offset_percent,
      iss_offset_percent = EXCLUDED.iss_offset_percent, updated_at = now()
  `;
  return Response.json({ success: true });
};
