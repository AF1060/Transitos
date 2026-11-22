import type { Context } from '@netlify/functions';
import { fetchPlanes } from './_aircraftSources';

export default async (req: Request, _context: Context) => {
  try {
    const { lat, lon, radiusKm } = await req.json();
    const r = await fetchPlanes(Number(lat), Number(lon), Number(radiusKm));
    return Response.json(r);
  } catch (e: any) {
    return Response.json({ error: e?.message ?? 'Erro desconhecido', budget: e?.budget }, { status: 502 });
  }
};
