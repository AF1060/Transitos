# Trânsitos Solares e Lunares — versão Netlify

Esta pasta é uma migração **parcial, mas funcional na parte difícil** da app a partir da Zite.

## O que está feito (testado por leitura, não por build real — ver "Limitações")

**Backend (`netlify/functions/`)** — as 9 funções + a recolha agendada, convertidas 1:1 da lógica
original, sem "owner"/login (decisão: app pessoal, de um só utilizador):
- `getAircraft`, `getIssTle`, `getSettings`, `saveSettings`, `listPlannedPasses`,
  `createPlannedPass`, `deletePlannedPass`, `getSightingStats`, `logSightings`
- `collectSightings` — recolha agendada (cron `* * * * *`, todos os minutos)
- `_db.ts`, `_geo.ts`, `_astro.ts`, `_aircraftParse.ts`, `_aircraftSources.ts`, `_collector.ts` —
  módulos partilhados

**Base de dados (`netlify/database/migrations/0001_init.sql`)** — esquema Postgres equivalente às
4 tabelas da Zite (Observer Settings, Planned Passes, Aircraft Sightings, Api Budget), sem colunas
de "owner".

**Configuração** — `netlify.toml`, `package.json` (sem `zitejs`), `vite.config.ts`, `tsconfig*.json`,
`tailwind.config.ts`, `postcss.config.js`, `index.html`, `src/main.tsx` — todos limpos de
referências à Zite.

**Frontend — só a "cola" com o backend**:
- `src/lib/apiClient.ts` (novo) — substitui o `zitejs/api`, com as mesmas assinaturas de função
- `src/App.tsx`, `src/context/AppContext.tsx`, `src/context/AircraftContext.tsx`,
  `src/components/PassDetail.tsx`, `src/pages/Routes.tsx`, `src/lib/sightings.ts` — cada um só com
  a linha do import da API trocada (e `App.tsx` sem o `useAuth` da Zite)

## Estado: completo e verificado

Corri `npm install`, `tsc -b` e `vite build` com sucesso, e empacotei as 10 funções com esbuild.
O erro `exit code 2` que viste na Netlify era o `tsc` a falhar por faltarem ficheiros na primeira
versão do zip — está resolvido nesta.

Todos os ficheiros da app estão incluídos: páginas, componentes, `src/lib/*`, e os componentes de
UI (`src/components/ui/*`, só os que a app usa, copiados do pacote partilhado da Zite).

## Como pôr isto a funcionar

1. Descompacta o zip.
2. `git init`, commit, e _push_ para um repositório (GitHub/GitLab) — a Netlify liga-se a um repo,
   não a uma pasta local.
3. Em [app.netlify.com](https://app.netlify.com), **Add new site → Import an existing project**,
   escolhe o repositório. A Netlify deteta o `netlify.toml` sozinha.
4. Ao instalar as dependências (`@netlify/database` está no `package.json`), a Netlify **aprovisiona
   sozinha** a base de dados Postgres e aplica a migração em `netlify/database/migrations/`.
5. Em **Site configuration → Environment variables**, adiciona `FLYITALYADSB_API_KEY` com a chave
   que já tens (a mesma que puseste no Secrets da Zite).
6. Deploy. As Scheduled Functions só correm em deploys publicados — não em previews de PR.

## Limitações e decisões a conhecer

- **O que foi e não foi testado**: o build do frontend e o empacotamento das funções foram
  testados a sério. O que **não** pude testar é a execução em produção (base de dados Netlify,
  chamadas às APIs de aviões a partir da rede da Netlify, cron) — isso só se vê depois do deploy.
- **Validação de entradas simplificada**: os endpoints da Zite validavam o corpo do pedido com
  `zod`. As funções da Netlify não o fazem (apenas `await req.json()` direto) — funciona para o uso
  normal da app, mas é menos robusto a entradas malformadas do que o original.
- **Recolha agendada: 1x/minuto em vez de ~2x/minuto.** As Scheduled Functions da Netlify têm um
  limite rígido de **30 segundos de execução** — a versão Zite fazia duas recolhas por invocação com
  uma pausa de 30s a meio, o que rebentaria esse limite. Aqui corre-se uma só recolha por invocação.
- **O IP partilhado pode continuar a ser um problema**: as funções da Netlify também correm em
  infraestrutura serverless multi-tenant (IPs de saída partilhados, tal como no Zite). A
  FlyItalyADSB (chave dedicada) deve resolver isto na prática, mas não há garantia de que a adsb.fi
  (reserva de último recurso) não continue a devolver 403 a partir daqui — só se sabe testando em
  produção.
- **Sem login**: qualquer pessoa com o URL da app consegue ver e alterar as definições, criar/apagar
  alarmes, etc. Aceitável para uso pessoal com URL não partilhado — decisão já tomada contigo.
- **Data de fim da recolha mantida (1 Dez 2026)**: tal como na Zite, `collectSightings.ts` para
  sozinho nessa data. Remove o bloco `if (Date.now() > END_AT)` em
  `netlify/functions/collectSightings.ts` se quiseres que continue.
