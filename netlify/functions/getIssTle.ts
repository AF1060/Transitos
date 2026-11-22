import type { Context } from '@netlify/functions';
import { fetchTimeout } from './_aircraftParse';

let cache: { line1: string; line2: string; fetchedAt: number } | null = null;

async function get(url: string) {
  const res = await fetchTimeout(url, 6000, { 'User-Agent': 'Transitos/1.0' });
  if (!res.ok) throw new Error(`${url} respondeu ${res.status}`);
  return await res.text();
}

const fromText = (txt: string) => {
  const lines = txt.split(/\r?\n/).map((l) => l.trim());
  return { line1: lines.find((l) => l.startsWith('1 ')), line2: lines.find((l) => l.startsWith('2 ')) };
};

const sources: (() => Promise<{ line1?: string; line2?: string }>)[] = [
  async () => fromText(await get('https://celestrak.org/NORAD/elements/gp.php?CATNR=25544&FORMAT=TLE')),
  async () => { const j = JSON.parse(await get('https://tle.ivanstanojevic.me/api/tle/25544')); return { line1: j.line1, line2: j.line2 }; },
  async () => { const j = JSON.parse(await get('https://api.wheretheiss.at/v1/satellites/25544/tles')); return { line1: j.line1, line2: j.line2 }; },
];

export default async (_req: Request, _context: Context) => {
  if (cache && Date.now() - cache.fetchedAt < 3 * 3600_000) return Response.json(cache);
  for (const s of sources) {
    try {
      const { line1, line2 } = await s();
      if (line1?.startsWith('1 ') && line2?.startsWith('2 ')) {
        cache = { line1, line2, fetchedAt: Date.now() };
        return Response.json(cache);
      }
    } catch (e) { console.error('Fonte TLE falhou', e); }
  }
  if (cache) return Response.json(cache);
  return Response.json({ error: 'Nenhuma fonte de TLE respondeu' }, { status: 502 });
};
