// Substitui o cliente RPC gerado automaticamente pela Zite (zitejs/api). Mesmos nomes de função e
// mesma assinatura de chamada do código já existente — a única mudança necessária no resto do
// frontend é trocar `from 'zitejs/api'` por `from '../lib/apiClient'` (ou caminho equivalente).
async function call<TOut>(name: string, input?: unknown): Promise<TOut> {
  const res = await fetch(`/api/${name}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input ?? {}),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}) as any);
    throw new Error(body?.error ?? `${name} respondeu ${res.status}`);
  }
  return res.json();
}

// --- Aviões ---
export interface RawPlane {
  icao24: string; callsign: string; country: string; posTime: number;
  lat: number; lon: number; altM: number; velocity: number; track: number; vrate: number;
}
export interface AircraftResult { planes: RawPlane[]; time: number; source: string; remaining?: number; resetAt?: number }
export const getAircraft = (input: { lat: number; lon: number; radiusKm: number }) => call<AircraftResult>('getAircraft', input);

export interface LogSightingInput {
  callsign: string; icao24: string; airline: string; seenAt: string; weekday: number; minuteOfDay: number;
  latitude: number; longitude: number; altitudeM: number; track: number; speed: number;
}
export const logSightings = (input: { sightings: LogSightingInput[] }) => call<{ saved: number }>('logSightings', input);

export interface SightingStatsRow {
  callsign: string; airline: string; weekday: number; minuteOfDay: number; day: string;
  latitude: number; longitude: number; altitudeM: number; track: number; speed: number;
}
export interface SightingStatsOutput { totalSightings: number; daysObserved: number; firstDay: string | null; truncated: boolean; rows: SightingStatsRow[] }
// Alias com o nome gerado pela Zite, para que Routes.tsx precise de mudar só a linha do import.
export type GetSightingStatsOutputType = SightingStatsOutput;
export const getSightingStats = (input: { minFrom: number; minTo: number; weekday: number | null }) => call<SightingStatsOutput>('getSightingStats', input);

// --- ISS ---
export interface IssTleOutput { line1: string; line2: string; fetchedAt: number }
export const getIssTle = (input: Record<string, never> = {}) => call<IssTleOutput>('getIssTle', input);

// --- Definições do observador ---
export interface SettingsOutput { settings: import('../context/AppContext').Settings | null }
export const getSettings = (input: Record<string, never> = {}) => call<SettingsOutput>('getSettings', input);
export const saveSettings = (input: import('../context/AppContext').Settings) => call<{ success: boolean }>('saveSettings', input);

// --- Passagens planeadas ---
export interface PlannedPassItem {
  id: string; title: string; object: 'ISS' | 'Avião'; target: 'Sol' | 'Lua'; discEntryTime: string;
  secondsInDisc: number; siteLatitude: number; siteLongitude: number; quality: string; alarmEnabled: boolean;
}
export interface ListPlannedPassesOutputType { passes: PlannedPassItem[] }
export const listPlannedPasses = (input: Record<string, never> = {}) => call<ListPlannedPassesOutputType>('listPlannedPasses', input);

export interface CreatePlannedPassInput {
  title: string; object: 'ISS' | 'Avião'; target: 'Sol' | 'Lua'; discEntryTime: string;
  secondsInDisc: number; siteLatitude: number; siteLongitude: number; quality: string;
}
export const createPlannedPass = (input: CreatePlannedPassInput) => call<{ id: string }>('createPlannedPass', input);
export const deletePlannedPass = (input: { id: string }) => call<{ success: boolean }>('deletePlannedPass', input);
