import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Pause, Play } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { cn } from '../lib/utils';
import { useApp } from '../context/AppContext';
import { useAircraft, RADAR_KM, STALE_MS } from '../context/AircraftContext';
import { planeAt, planePolar, planeTrack, PlanePrediction } from '../lib/aircraft';
import { compass } from '../lib/geo';
import { Navigation } from 'lucide-react';
import { bodyTopo, fieldOfView } from '../lib/astro';
import { fmtCoord, fmtIn, fmtNum, fmtTime, mapsUrl } from '../lib/format';
import DiscDiagram from '../components/DiscDiagram';

export default function Aircraft() {
  const { settings, target } = useApp();
  const discName = target === 'Sol' ? 'ao disco solar' : 'ao disco lunar';
  const { watching, setWatching, predictions, lastUpdate, error, source, planes, paused, remaining, resetAt, outOfBudget } = useAircraft();
  const [open, setOpen] = useState<PlanePrediction | null>(null);
  const [now, setNow] = useState(Date.now());
  useEffect(() => { setWatching(true); }, [setWatching]);
  useEffect(() => { const id = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(id); }, []);
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Aviões · {RADAR_KM} km</h1>
          <p className="text-sm text-muted-foreground">
            {paused && watching ? 'Radar em pausa: o separador está em segundo plano (retoma ao voltar)' : lastUpdate ? `Atualizado há ${Math.round((now - lastUpdate) / 1000)} s · ${planes.length} aviões` : watching ? 'A obter dados…' : 'Vigia em pausa'}
            {source ? ` · fonte: ${source}` : ''}{remaining !== null ? ` · saldo adsb.lol: ${fmtNum(remaining, 0)}` : ''}
          </p>
        </div>
        <Button variant="outline" onClick={() => setWatching(!watching)}>{watching ? <><Pause className="mr-2 h-4 w-4" />Pausar vigia</> : <><Play className="mr-2 h-4 w-4" />Vigiar</>}</Button>
      </div>
      <p className="text-[11px] text-muted-foreground">
        Dados: <a className="underline" href="https://flyitalyadsb.com" target="_blank" rel="noreferrer">flyitalyadsb.com</a>, licença{' '}
        <a className="underline" href="https://creativecommons.org/licenses/by-sa/4.0/" target="_blank" rel="noreferrer">CC BY-SA 4.0</a>
        {' '}(reserva: adsb.lol, adsb.fi).
      </p>
      {outOfBudget && (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/60 p-3 text-sm text-destructive">
          <AlertTriangle className="h-4 w-4" />
          Sem saldo diário no adsb.lol.
          {resetAt ? ` Renova por volta das ${new Date(resetAt).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Lisbon' })}.` : ' A renovar ao longo do dia.'}
        </div>
      )}
      {watching && !paused && lastUpdate !== null && now - lastUpdate > STALE_MS && (
        <div className="flex items-center gap-2 rounded-lg border border-border bg-muted p-3 text-sm text-muted-foreground">
          <AlertTriangle className="h-4 w-4" />Dados com mais de {Math.round(STALE_MS / 60000)} min: previsões suspensas até haver nova atualização.
        </div>
      )}
      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/60 p-3 text-sm text-destructive">
          <AlertTriangle className="h-4 w-4" />{error}
        </div>
      )}
      <div className="grid gap-5 lg:grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-3 lg:col-span-2">
          <RadarView predictions={predictions} />
        </div>
        <div className="space-y-3">
          <div className="text-sm font-medium">Vão passar frente {discName} (próx. 10 min, visto daqui ou de um local até {settings.maxTravelKm} km)</div>
          {predictions.length === 0 && <div className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">Nenhum avião previsto para passar frente {discName} ou à orla.</div>}
          {predictions.map((p) => (
            <button key={p.plane.icao24} onClick={() => setOpen(p)} className="w-full rounded-lg border border-border bg-card p-3 text-left transition-colors hover:border-primary/60">
              <div className="flex justify-between"><span className="font-semibold">{p.plane.callsign}</span><span className="text-sm tabular-nums">{fmtIn((p.entry ?? p.closest) - now)}</span></div>
              <div className="text-xs text-muted-foreground">{fmtNum(p.plane.altM, 0)} m · {fmtNum(p.rangeKm, 0)} km · ± {fmtNum(p.errDeg, 2)}° / ± {fmtNum(p.errS, 0)} s</div>
              <div className={cn('mt-1 text-xs', p.confidence === 'baixa' ? 'text-muted-foreground' : 'text-primary')}>
                {p.entry ? `No seu local: passa a ${fmtNum(p.minSep, 2)}° do centro · ${fmtNum(p.inDiscS, 1)} s no disco · confiança ${p.confidence}` : `No seu local, fica a ${fmtNum(p.minSep, 1)}° do centro — não passa aqui; só num dos locais abaixo.`}
              </div>
              {p.alternatives[0] && (
                <div className="mt-1 text-xs">Centro do disco: {fmtNum(p.alternatives[0].distKm, 1)} km para {compass(p.alternatives[0].brg)} às {fmtTime(p.alternatives[0].t)}{p.alternatives.length > 1 ? ` · +${p.alternatives.length - 1} locais` : ''}</div>
              )}
            </button>
          ))}
        </div>
      </div>
      <PlaneDetail p={open} onClose={() => setOpen(null)} />
    </div>
  );
}

function RadarView({ predictions }: { predictions: PlanePrediction[] }) {
  const { home, target } = useApp();
  const { planes } = useAircraft();
  const { settings } = useApp();
  const body = bodyTopo(target, new Date(), home);
  const hotHere = new Set(predictions.filter((p) => p.entry !== null).map((p) => p.plane.icao24));
  const hotElsewhere = new Set(predictions.filter((p) => p.entry === null).map((p) => p.plane.icao24));
  const xy = (dist: number, brg: number) => [(dist / RADAR_KM) * Math.sin((brg * Math.PI) / 180) * 100, -(dist / RADAR_KM) * Math.cos((brg * Math.PI) / 180) * 100];
  const [bx, by] = xy(RADAR_KM, body.az);
  return (
    <div>
    <svg viewBox="-110 -110 220 220" className="mx-auto aspect-square max-h-[520px] w-full">
      {[20,40,60,80].map((r) => <circle key={r} r={(r/RADAR_KM)*100} fill="none" stroke="hsl(var(--border))" strokeWidth={0.4} />)}
      {[20,40,60,80].map((r) => <text key={r} x={1.5} y={-(r/RADAR_KM)*100+4} fontSize={3.5} fill="hsl(var(--muted-foreground))">{r} km</text>)}
      {['N','E','S','O'].map((d,i) => { const [x,y] = xy(RADAR_KM*1.07,i*90); return <text key={d} x={x} y={y+1.5} fontSize={5} textAnchor="middle" fill="hsl(var(--muted-foreground))">{d}</text>; })}
      {body.el > 0 && <line x1={0} y1={0} x2={bx} y2={by} stroke="hsl(var(--primary))" strokeWidth={0.8} strokeDasharray="2 1.5" />}
      {body.el > 0 && <g><circle cx={bx} cy={by} r={7} fill="hsl(var(--primary))" fillOpacity={0.25} /><circle cx={bx} cy={by} r={4.5} fill={target==='Lua'?'hsl(var(--foreground))':'hsl(var(--primary))'} stroke="hsl(var(--primary))" strokeWidth={0.8} /><text x={bx} y={by+(by>0?-9:12)} fontSize={4} textAnchor="middle" fill="hsl(var(--primary))">{target} · {body.el.toFixed(0)}° alt.</text></g>}
      <line x1={-3.5} y1={0} x2={3.5} y2={0} stroke="hsl(var(--foreground))" strokeWidth={0.7} />
      <line x1={0} y1={-3.5} x2={0} y2={3.5} stroke="hsl(var(--foreground))" strokeWidth={0.7} />
      <circle r={(settings.maxTravelKm/RADAR_KM)*100} fill="hsl(var(--primary))" fillOpacity={0.05} stroke="hsl(var(--primary))" strokeOpacity={0.4} strokeWidth={0.4} strokeDasharray="1.5 1.5" />
      {planes.map((p) => { const {dist,brg} = planePolar(p,home); if(dist>RADAR_KM) return null; const [x,y] = xy(dist,brg); const h=(p.track*Math.PI)/180; const isHere=hotHere.has(p.icao24); const isElsewhere=hotElsewhere.has(p.icao24); const color=isHere?'hsl(var(--primary))':isElsewhere?'hsl(var(--chart-4))':'hsl(var(--muted-foreground))'; return (<g key={p.icao24}><line x1={x} y1={y} x2={x+Math.sin(h)*6} y2={y-Math.cos(h)*6} stroke={color} strokeWidth={0.6} /><circle cx={x} cy={y} r={isHere||isElsewhere?2:1.2} fill={isHere||isElsewhere?color:'hsl(var(--foreground))'} />{(isHere||isElsewhere)&&<text x={x+2.5} y={y-2} fontSize={3.5} fill={color}>{p.callsign}</text>}</g>); })}
    </svg>
    <ul className="mt-3 flex flex-wrap justify-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
      <li className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-full bg-primary" />Vai cruzar o {target} a partir daqui</li>
      <li className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: 'hsl(var(--chart-4))' }} />Vai cruzar o {target} noutro local (deslocar-se)</li>
      <li className="flex items-center gap-1.5"><span className="inline-block h-1.5 w-1.5 rounded-full bg-foreground" />Outro avião</li>
      <li className="flex items-center gap-1.5"><span className="inline-block h-0.5 w-3 bg-muted-foreground" />Rumo do avião</li>
      <li className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-full border border-dashed border-primary/60" />Distância máx. de deslocação ({settings.maxTravelKm} km)</li>
      <li className="flex items-center gap-1.5"><span className="inline-block h-0 w-3 border-t border-dashed border-primary" />Direção do {target}</li>
      <li className="flex items-center gap-1.5"><span className="font-semibold text-foreground">+</span>A sua posição</li>
    </ul>
    </div>
  );
}

function PlaneDetail({ p, onClose }: { p: PlanePrediction | null; onClose: () => void }) {
  const { home, target, settings } = useApp();
  const frame = fieldOfView(settings.focalLengthMm, settings.sensor);
  const track = useMemo(() => (p ? planeTrack(p.plane, home, target, p.closest, Math.max(frame.w, frame.h)) : []), [p, home, target, frame.w, frame.h]);
  return (
    <Dialog open={!!p} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] max-w-2xl overflow-y-auto">
        {p && (<>
          <DialogHeader><DialogTitle className="text-left">{p.plane.callsign} frente {target === 'Sol' ? 'ao Sol' : 'à Lua'}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
            <Kv k="Entrada no disco" v={fmtTime(p.entry, true)} />
            <Kv k="Margem de erro" v={`± ${fmtNum(p.errS, 0)} s · ± ${fmtNum(p.errDeg, 2)}°`} />
            <Kv k="Distância · altitude" v={`${fmtNum(p.rangeKm, 1)} km · ${fmtNum(p.plane.altM, 0)} m`} />
            <Kv k="Velocidade · rumo" v={`${fmtNum(p.plane.velocity * 3.6, 0)} km/h · ${fmtNum(p.plane.track, 0)}°`} />
          </div>
          <DiscDiagram target={target} radiusDeg={p.radiusDeg} marginDeg={settings.marginDegrees} frame={frame} track={track} entry={p.entry} errDeg={p.errDeg} />
          <div className="space-y-2">
            {p.alternatives.map((a, i) => (
              <div key={i} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-card p-3 text-sm">
                <div>
                  <div className="font-semibold">{fmtNum(a.distKm, 1)} km para {compass(a.brg)}</div>
                  <div className="text-xs text-muted-foreground">{fmtCoord(a.lat, a.lon)} · às {fmtTime(a.t)} (± {fmtNum(p.errS, 0)} s)</div>
                </div>
                <Button size="sm" variant="outline" asChild><a href={mapsUrl(a.lat, a.lon)} target="_blank" rel="noreferrer"><Navigation className="mr-1 h-4 w-4" />Mapa</a></Button>
              </div>
            ))}
          </div>
        </>)}
      </DialogContent>
    </Dialog>
  );
}
const Kv = ({ k, v }: { k: string; v: string }) => (
  <div className="rounded-lg border border-border bg-card p-2"><div className="text-xs text-muted-foreground">{k}</div><div className="font-medium">{v}</div></div>
);
