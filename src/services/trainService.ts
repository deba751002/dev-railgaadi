export interface TrainSearchResult {
  trainNumber: string;
  name: string;
}

export type TrainRunState = 'SCHEDULED' | 'RUNNING' | 'COMPLETED' | 'CANCELLED' | 'NO_DATA';

export interface JourneyResponse {
  train: { number: string; name: string; date: string };
  status: {
    state: TrainRunState;
    delayMinutes: number;
    currentStation: string | null;
    nextStation: string | null;
    etaNextStation: string | null;
    lastUpdated: string;
  };
  position: { lat: number; lng: number; bearing: number } | null;
  progress: { distanceCoveredKm: number; distanceTotalKm: number; percentComplete: number };
  route: Array<{
    stationCode: string;
    stationName: string;
    lat: number;
    lng: number;
    distanceKm: number;
    isHalt: boolean;
    arrivalTime: string | null;
    departureTime: string | null;
    haltMinutes: number | null;
  }>;
  timeline: Array<{
    stationCode: string;
    stationName: string;
    distanceKm: number;
    isHalt: boolean;
    status: string | null;
    scheduledArrival: string | null;
    scheduledDeparture: string | null;
    delayArrivalMinutes: number | null;
    delayDepartureMinutes: number | null;
    haltMinutes: number | null;
  }>;
  coachPositions: string[];
}

export async function searchTrains(query: string): Promise<TrainSearchResult[]> {
  if (query.trim().length < 2) return [];
  const res = await fetch(`/api/trains/search?q=${encodeURIComponent(query)}`);
  if (!res.ok) throw new Error('search_failed');
  const data = await res.json();
  return data.results ?? [];
}

export async function fetchJourney(trainNumber: string): Promise<JourneyResponse> {
  const res = await fetch(`/api/journey/${encodeURIComponent(trainNumber)}`);
  if (!res.ok) throw new Error('journey_fetch_failed');
  return res.json();
}

export interface StationSearchResult {
  code: string;
  name: string;
}

export async function searchStations(query: string): Promise<StationSearchResult[]> {
  if (query.trim().length < 2) return [];
  const res = await fetch(`/api/stations/search?q=${encodeURIComponent(query)}`);
  if (!res.ok) throw new Error('station_search_failed');
  const data = await res.json();
  return data.results ?? [];
}

export interface TrainBetweenStations {
  number: string;
  name: string;
  type: string | null;
  runDays: string[];
  departure: string | null;
  arrival: string | null;
  distanceKm: number | null;
  durationMinutes: number | null;
  haltsBetween: number;
  delayMinutes: number | null;
}

export interface TrainsBetweenResponse {
  from: { code: string; name: string };
  to: { code: string; name: string };
  trains: TrainBetweenStations[];
}

export async function fetchTrainsBetween(
  fromCode: string,
  toCode: string,
  date?: string,
): Promise<TrainsBetweenResponse> {
  const qs = date ? `?date=${encodeURIComponent(date)}` : '';
  const res = await fetch(
    `/api/trains/between/${encodeURIComponent(fromCode)}/${encodeURIComponent(toCode)}${qs}`,
  );
  if (!res.ok) throw new Error('trains_between_failed');
  return res.json();
}
