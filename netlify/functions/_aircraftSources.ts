import { fetchTimeout, parseTar1090, type RawPlane } from './_aircraftParse';
import { db } from './_db';

export type { RawPlane };

// Fonte principal: FlyItalyADSB (api.flyitalyadsb.com). Limite de 100 pedidos/min por IP — bem acima do
// que o radar (a cada 45 s) e a recolha agendada precisam — sem limite diário conhecido. Requer chave
// própria (FLYITALYADSB_API_KEY, variável de ambiente da Netlify). Dados: flyitalyadsb.com, licença
// CC BY-SA 4.0 (ver crédito na página Aviões).
//
// NOTA IMPORTANTE sobre esta migração: as funções da Netlify (tal como as da Vercel) também correm em
// infraestrutura serverless multi-tenant com IPs de saída partilhados — não há garantia de que o
// bloqueio por IP que afetava o Zite (adsb.fi devolvendo 403) não aconteça aqui também. A FlyItalyADSB,
// por usar uma chave dedicada por app em vez de depender do IP, é precisamente o que resolve isso de
// forma robusta, independentemente da plataforma de hospedagem.
let flyItalyPausedUntil = 0;

async function fromFlyItaly(lat: number, lon: number, radiusKm: number) {
  const key = process.env.FLYITALYADSB_API_KEY;
  if (!key || Date.now() < flyItalyPausedUntil) return null;
  const km = Math.min(400, Math.round(radiusKm));
  const res = await fetchTimeout(
    `https://api.flyitalyadsb.com/v2/lat/${lat.toFixed(4)}/lon/${lon.toFixed(4)}/dist/${km}`,
    8000,
    { 'X-Api-Key': key },
  );
  if (res.status === 429) { flyItalyPausedUntil = Date.now() + 65_000; return null; } // limite é por minuto
  if (!res.ok) { flyItalyPausedUntil = Date.now() + 60_000; return null; } // chave inválida, serviço em baixo, etc.
  return { ...parseTar1090(await res.json()), source: 'flyitalyadsb.com' };
}

// Fonte de reserva: adsb.lol. O seu limite (500 pedidos/24h, janela deslizante) tem de ser partilhado por
// TODAS as execuções: cada invocação de uma função Netlify corre isolada, por isso uma variável em
// memória não chega. Guardamos o estado na tabela Postgres api_budget.
const KEY = 'adsbLol';
const RESERVE = 40; // pedidos que ficam sempre de fora, para nunca chegar mesmo a 0 sem aviso prévio

interface Budget { day: string; used: number; remaining: number; resetAt: number }

function today() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Lisbon' }).format(new Date()); // YYYY-MM-DD
}

async function readBudget(): Promise<Budget> {
  const rows = await db.sql`SELECT day, used, remaining, reset_at FROM api_budget WHERE key = ${KEY}`;
  const r = rows[0] as { day: string; used: number; remaining: number; reset_at: string | null } | undefined;
  if (r && r.day === today()) {
    return { day: r.day, used: r.used ?? 0, remaining: r.remaining ?? 500, resetAt: r.reset_at ? Date.parse(r.reset_at) : 0 };
  }
  return { day: today(), used: 0, remaining: 500, resetAt: 0 };
}

async function writeBudget(b: Budget) {
  const resetAtIso = b.resetAt ? new Date(b.resetAt).toISOString() : null;
  await db.sql`
    INSERT INTO api_budget (key, day, used, remaining, reset_at)
    VALUES (${KEY}, ${b.day}, ${b.used}, ${b.remaining}, ${resetAtIso})
    ON CONFLICT (key, day) DO UPDATE SET used = EXCLUDED.used, remaining = EXCLUDED.remaining, reset_at = EXCLUDED.reset_at
  `;
}

type LolResult = { ok: { planes: RawPlane[]; time: number; source: string; remaining: number; resetAt: number } } | { skipped: Budget };

async function fromAdsbLol(lat: number, lon: number, radiusKm: number): Promise<LolResult> {
  const b = await readBudget();
  // Se a janela de 24h já reiniciou (passou o instante indicado por x-ratelimit-reset na última resposta),
  // não sabemos ainda o saldo real: deixamos passar um pedido de sondagem, que traz o valor verdadeiro.
  const windowOver = b.resetAt > 0 && Date.now() > b.resetAt;
  if (!windowOver && b.remaining <= RESERVE) return { skipped: b };

  const nm = Math.min(250, Math.ceil(radiusKm / 1.852));
  const res = await fetchTimeout(`https://api.adsb.lol/v2/point/${lat.toFixed(4)}/${lon.toFixed(4)}/${nm}`);
  const remaining = Number(res.headers.get('x-ratelimit-remaining') ?? NaN);
  const resetS = Number(res.headers.get('x-ratelimit-reset') ?? 3600);
  const nb: Budget = {
    day: today(), used: b.used + 1,
    remaining: Number.isFinite(remaining) ? remaining : Math.max(0, b.remaining - 1),
    resetAt: Date.now() + resetS * 1000,
  };
  await writeBudget(nb);
  if (res.status === 429) return { skipped: nb };
  if (!res.ok) throw new Error(`adsb.lol respondeu ${res.status}`);
  return { ok: { ...parseTar1090(await res.json()), source: 'adsb.lol', remaining: nb.remaining, resetAt: nb.resetAt } };
}

// Última reserva: adsb.fi. Não publica cabeçalhos de limite. No Zite, a partir da rede de produção,
// respondia 403 (bloqueio da Cloudflare a esse IP específico). Mantido como tentativa de baixo custo —
// o IP de saída da Netlify é diferente, por isso vale a pena deixar esta tentativa correr e observar.
let adsbFiPausedUntil = 0;

async function fromAdsbFi(lat: number, lon: number, radiusKm: number) {
  if (Date.now() < adsbFiPausedUntil) return null;
  const km = Math.min(450, Math.round(radiusKm));
  const res = await fetchTimeout(
    `https://opendata.adsb.fi/api/v2/lat/${lat.toFixed(4)}/lon/${lon.toFixed(4)}/dist/${km}`,
    8000,
    { 'User-Agent': 'Mozilla/5.0' },
  );
  if (!res.ok) { adsbFiPausedUntil = Date.now() + 300_000; return null; }
  return { ...parseTar1090(await res.json()), source: 'adsb.fi' };
}

/**
 * Obtém os aviões num raio à volta de `home`. Ordem de tentativa: FlyItalyADSB (fonte principal, chave
 * própria, sem limite diário conhecido) → adsb.lol (saldo diário partilhado, guardado em Postgres) →
 * adsb.fi (reserva de baixo custo). A OpenSky Network foi testada e excluída: o seu servidor recusou
 * ligações a partir da rede do Zite mesmo com credenciais válidas — vale a pena testar de novo a partir
 * da Netlify, mas não assumimos que vá funcionar sem confirmar.
 */
export async function fetchPlanes(lat: number, lon: number, radiusKm: number): Promise<{ planes: RawPlane[]; time: number; source: string; remaining?: number; resetAt?: number }> {
  const f = await fromFlyItaly(lat, lon, radiusKm);
  if (f) return f;
  const a = await fromAdsbLol(lat, lon, radiusKm);
  if ('ok' in a) return a.ok;
  const b = await fromAdsbFi(lat, lon, radiusKm);
  if (b) return b;
  const e: any = new Error('Sem resposta de nenhuma fonte (FlyItalyADSB, adsb.lol e adsb.fi indisponíveis)');
  e.budget = a.skipped;
  throw e;
}
