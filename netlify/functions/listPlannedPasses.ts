import type { Context } from '@netlify/functions';
import { db } from './_db';

export default async (_req: Request, _context: Context) => {
  const cutoff = new Date(Date.now() - 3600_000).toISOString();
  const rows = await db.sql`
    SELECT id, title, object, target, disc_entry_time, seconds_in_disc, site_latitude, site_longitude, quality, alarm_enabled
    FROM planned_passes
    WHERE disc_entry_time > ${cutoff}
    ORDER BY disc_entry_time ASC
    LIMIT 200
  `;
  return Response.json({
    passes: rows.map((r: any) => ({
      id: String(r.id),
      title: r.title ?? '',
      object: r.object ?? 'ISS',
      target: r.target ?? 'Sol',
      discEntryTime: new Date(r.disc_entry_time).toISOString(),
      secondsInDisc: r.seconds_in_disc ?? 0,
      siteLatitude: r.site_latitude ?? 0,
      siteLongitude: r.site_longitude ?? 0,
      quality: r.quality ?? '',
      alarmEnabled: r.alarm_enabled ?? true,
    })),
  });
};
