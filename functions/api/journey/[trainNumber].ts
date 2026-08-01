interface Env {
  RAILRADAR_API_KEY: string;
  RAILGAADI_CACHE?: KVNamespace;
}

interface RailRadarRouteStop {
  stationCode: string;
  stationName: string;
  lat?: number;
  lng?: number;
  distance: number;
}

interface RailRadarHalt {
  stationCode: string;
  stationName: string;
  sequence: number;
  distance: number;
}

interface RailRadarLiveData {
  trainNumber: string;
  trainName: string;
  startDate: string;
  lastUpdatedAt: string;
  status: string;
  delayMinutes: number;
  currentLocation?: {
    stationCode: string;
    sequence: number;
    status: string;
    segmentProgress: number;
    speedKmh?: number;
    bearingDegrees?: number;
  };
  previousHalt?: RailRadarHalt;
  nextHalt?: RailRadarHalt;
  route?: RailRadarRouteStop[];
}

type TrainRunState = 'SCHEDULED' | 'RUNNING' | 'COMPLETED' | 'CANCELLED' | 'NO_DATA';

function mapState(status: string | undefined): TrainRunState {
  const v = (status ?? '').toLowerCase();
  if (v.includes('run')) return 'RUNNING';
  if (v.includes('complet') || v.includes('arriv')) return 'COMPLETED';
  if (v.includes('cancel')) return 'CANCELLED';
  if (v.includes('sched') || v.includes('not start')) return 'SCHEDULED';
  return 'NO_DATA';
}

function round(n: number, decimals = 1) {
  const f = 10 ** decimals;
  return Math.round(n * f) / f;
}

function buildPayload(trainNumber: string, raw: RailRadarLiveData) {
  const route = raw.route ?? [];
  const previousHalt = raw.previousHalt;
  const nextHalt = raw.nextHalt;
  const segmentProgress = raw.currentLocation?.segmentProgress ?? 0;

  const prevDistance = previousHalt?.distance ?? 0;
  const nextDistance = nextHalt?.distance ?? prevDistance;
  const distanceTotalKm = route.length ? route[route.length - 1].distance : nextDistance;
  const distanceCoveredKm = prevDistance + segmentProgress * (nextDistance - prevDistance);
  const percentComplete = distanceTotalKm > 0 ? (distanceCoveredKm / distanceTotalKm) * 100 : 0;

  const prevStation = route.find((r) => r.stationCode === previousHalt?.stationCode);
  const nextStation = route.find((r) => r.stationCode === nextHalt?.stationCode);

  let position: { lat: number; lng: number; bearing: number } | null = null;
  if (
    prevStation &&
    nextStation &&
    typeof prevStation.lat === 'number' &&
    typeof nextStation.lat === 'number' &&
    typeof prevStation.lng === 'number' &&
    typeof nextStation.lng === 'number'
  ) {
    position = {
      lat: prevStation.lat + segmentProgress * (nextStation.lat - prevStation.lat),
      lng: prevStation.lng + segmentProgress * (nextStation.lng - prevStation.lng),
      bearing: raw.currentLocation?.bearingDegrees ?? 0,
    };
  }

  let etaNextStation: string | null = null;
  const speed = raw.currentLocation?.speedKmh;
  if (speed && speed > 0 && nextDistance > distanceCoveredKm) {
    const remainingKm = nextDistance - distanceCoveredKm;
    const hours = remainingKm / speed;
    etaNextStation = new Date(Date.now() + hours * 3_600_000).toISOString();
  }

  return {
    train: {
      number: raw.trainNumber ?? trainNumber,
      name: raw.trainName ?? '',
      date: raw.startDate ?? '',
    },
    status: {
      state: mapState(raw.status),
      delayMinutes: raw.delayMinutes ?? 0,
      currentStation: previousHalt?.stationName ?? null,
      nextStation: nextHalt?.stationName ?? null,
      etaNextStation,
      lastUpdated: raw.lastUpdatedAt ?? new Date().toISOString(),
    },
    position,
    progress: {
      distanceCoveredKm: round(distanceCoveredKm),
      distanceTotalKm,
      percentComplete: round(percentComplete),
    },
  };
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const trainNumber = context.params.trainNumber as string;
  const cacheKey = `journey:${trainNumber}`;

  if (context.env.RAILGAADI_CACHE) {
    const cached = await context.env.RAILGAADI_CACHE.get<any>(cacheKey, 'json');
    if (cached) {
      return Response.json(cached, { status: cached.error ? 502 : 200 });
    }
  }

  const upstreamUrl = `https://api.railradar.in/v1/trains/${encodeURIComponent(trainNumber)}/live`;
  const upstream = await fetch(upstreamUrl, {
    headers: { Authorization: `Bearer ${context.env.RAILRADAR_API_KEY}` },
  });

  if (!upstream.ok) {
    const errorBody = await upstream.text();
    const errorPayload = {
      error: 'upstream_error',
      debug: {
        upstreamUrl,
        upstreamStatus: upstream.status,
        upstreamStatusText: upstream.statusText,
        upstreamBody: errorBody.slice(0, 500),
      },
    };
    // Cache the error briefly too, so repeated page loads during an outage
    // (or a quota exhaustion like RailRadar's 50/day free limit) don't keep
    // burning requests.
    if (context.env.RAILGAADI_CACHE) {
      await context.env.RAILGAADI_CACHE.put(cacheKey, JSON.stringify(errorPayload), {
        expirationTtl: 60,
      });
    }
    return Response.json(errorPayload, { status: 502 });
  }

  const body: any = await upstream.json();
  const raw: RailRadarLiveData = body.data ?? body;
  const payload = buildPayload(trainNumber, raw);

  if (context.env.RAILGAADI_CACHE) {
    // 10-minute cache — RailRadar's free tier caps at 50 requests/day, so
    // this shares one upstream call across every user looking at this train
    // for the next 10 minutes instead of burning quota per-view.
    await context.env.RAILGAADI_CACHE.put(cacheKey, JSON.stringify(payload), {
      expirationTtl: 600,
    });
  }

  return Response.json(payload);
};
