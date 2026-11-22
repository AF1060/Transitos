import type { Context } from '@netlify/functions';
import { db } from './_db';

export default async (req: Request, _context: Context) => {
  const { id } = await req.json();
  const rows = await db.sql`DELETE FROM planned_passes WHERE id = ${Number(id)} RETURNING id`;
  if (!rows.length) return Response.json({ error: 'Passagem não encontrada' }, { status: 404 });
  return Response.json({ success: true });
};
