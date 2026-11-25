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

## Altitude do observador (novo)

Nas **Definições → Localização** há um campo "Altitude do ponto de observação" (metros acima do nível
do mar; soma o terreno ao andar/miradouro) e um botão **GPS** que preenche o valor se o telemóvel o
fornecer (precisão típica ±20–50 m). Predefinição 0 = comportamento anterior.

**Porque importa.** Um trânsito só se vê ao longo da linha que une o Sol, o avião e o observador. Essa
linha, prolongada para trás do avião, toca o chão num ponto que depende da altura a que o observador
está. Se o avião voa a altitude `H` e o Sol tem elevação `ε`, o ponto no solo de um observador à
altitude `h` fica deslocado, face ao do nível do mar, de aproximadamente

    Δ ≈ h / tan(ε)        (ex.: h = 1000 m, ε = 30° → Δ ≈ 1,7 km)

e a faixa útil do trânsito tem só centenas de metros de largura — ignorar a altitude faz falhar o local.

**O que foi alterado (todas as fórmulas passam a usar `home.alt`):**
- `geo.ts`: `LatLon.alt` (m); `obsEcef()` — posição ECEF do observador **com** altitude; `rayEarth(o, d, hKm)`
  — interseção com a superfície à altitude `h` (elipsoide de semieixos `A+h`, `B+h`) em vez do nível do mar.
- `aircraft.ts`: vetor observador→avião usa `obsEcef(home)` (altura relativa `H − h`, ângulo de elevação,
  distância oblíqua); locais alternativos (`centerSites`) e faixa de passagem (`offsetBand`) usam o chão à altitude `h`.
- `iss.ts` / `offset.ts`: idem para a ISS (ponto no solo, faixa, análise no local e em casa).
- `routeStats.ts` e `_collector.ts`: distância horizontal do avião ao ponto de alinhamento
  `d = (H − h) / tan(ε)` (antes `H / tan(ε)`); aviões abaixo do observador são ignorados.
- `astro.ts`: `bodyTopo` e `riseSet` recebem a altitude (no nascer/pôr só afeta a atmosfera/refração).
- Base de dados: migração `0002_observer_altitude.sql` (coluna `observer_altitude_m`).

**Verificação numérica** (script de teste, Sol a 30°, avião a 10 000 m): com `alt = 0` os resultados são
idênticos aos anteriores; o deslocamento no solo para h = 100/500/1000/2000 m foi 0,175/0,877/1,754/3,507 km
vs. 0,173/0,865/1,730/3,460 km pela fórmula plana (diferença ≈1,4 %, curvatura da Terra); um observador à
altitude `h` no local calculado vê o avião exatamente no centro do disco (0,0000°), enquanto o mesmo local
calculado ignorando a altitude erraria o disco por 2,7°.

**Limitações assumidas:**
- Os locais alternativos sugeridos assumem **a mesma altitude** do teu ponto; o terreno real noutro sítio pode ser
  diferente (um valor por local exigiria uma API de elevação por ponto).
- A altitude introduzida é tratada como acima do elipsoide ≈ nível do mar; a ondulação do geoide em Portugal
  (~50 m) é ignorada (≈ 0,09 km de erro no solo a 30° de elevação).
- A depressão do horizonte (horizonte visível abaixo da horizontal) **não** é aplicada aos trânsitos: depende da
  altura acima do terreno envolvente, que não é conhecida, e não altera a geometria do alinhamento.
