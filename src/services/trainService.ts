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
