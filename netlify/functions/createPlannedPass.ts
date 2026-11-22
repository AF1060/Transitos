import type { Context } from '@netlify/functions';
import { db } from './_db';

export default async (req: Request, _context: Context) => {
  const b = await req.json();
  const rows = await db.sql`
    INSERT INTO planned_passes (title, object, target, disc_entry_time, seconds_in_disc, site_latitude, site_longitude, quality, alarm_enabled)
    VALUES (${b.title}, ${b.object}, ${b.target}, ${b.discEntryTime}, ${b.secondsInDisc}, ${b.siteLatitude}, ${b.siteLongitude}, ${b.quality}, true)
    RETURNING id
  `;
  return Response.json({ id: String((rows[0] as any).id) });
};
