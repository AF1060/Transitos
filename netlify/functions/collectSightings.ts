import type { Config, Context } from '@netlify/functions';
import { collectOnce } from './_collector';

// Recolha em segundo plano das observações de aviões para as estatísticas da página Rotas.
//
// DIFERENÇA IMPORTANTE em relação à versão Zite: lá, esta função corria 2x por invocação (com uma
// pausa de 30 s a meio) para aproximar uma cadência de 2x/min, dentro do limite de agendamento do
// Zite. Na Netlify isso NÃO é seguro: as Scheduled Functions têm um limite rígido de execução de
// 30 segundos — uma função que inclua essa pausa seria sempre interrompida a meio. Por isso aqui
// corre-se UMA só recolha por invocação, ao minuto (o cron já dispara a cada 60 s, que é o mínimo
// suportado). Perde-se a precisão de ~30 s da versão Zite, mas ganha-se fiabilidade: nunca corta a
// meio de uma recolha.
//
// Só recolhe quando o Sol ou a Lua estão acima da elevação mínima (ver _collector.ts), e pára
// sozinha a 1 Dez 2026 — tal como a versão Zite. Para continuar depois dessa data, remove o bloco
// "if (Date.now() > END_AT)" abaixo.
const END_AT = Date.parse('2026-12-01T23:59:00Z');

export default async (_req: Request, _context: Context) => {
  if (Date.now() > END_AT) return Response.json({ skipped: 'Período de recolha terminado (2026-12-01)' });
  const results = await collectOnce();
  return Response.json({ results });
};

export const config: Config = {
  schedule: '* * * * *', // todos os minutos — o mínimo suportado pela Netlify
};
