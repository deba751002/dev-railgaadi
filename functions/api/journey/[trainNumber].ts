interface Env {
  RAILRADAR_API_KEY: string;
  RAILGAADI_CACHE?: KVNamespace;
}

interface RailRadarLiveRouteStop {
  sequence: number;
  stationCode: string;
  stationName: string;
  distance: number;
  isHalt?: boolean;
  scheduledArrival?: string;
  scheduledDeparture?: string;
  delayArrival?: number;
  delayDeparture?: number;
  status?: string;
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
  isLive?: boolean;
  currentLocation?: {
    stationCode?: string;
    segmentProgress?: number;
    speedKmh?: number;
    bearingDegrees?: number;
  };
  previousHalt?: RailRadarHalt;
  nextHalt?: RailRadarHalt;
  route?: RailRadarLiveRouteStop[];
}

interface RailRadarGeometryStop {
  sequence: number;
  code: string;
  name: string;
  lat: number;
  lng: number;
}

type TrainRunState = 'SCHEDULED' | 'RUNNING' | 'COMPLETED' | 'CANCELLED' | 'NO_DATA';

function mapState(status: string | undefined): TrainRunState {
  const v = (status ?? '').toLowerCase();
  if (v.includes('run')) return 'RUNNING';
  if (v.includes('complet') || v.includes('arriv')) return 'COMPLETED';
  if (v.includes('cancel')) return 'CANCELLED';
  if (v.includes('sched') || v.includes('not start') || v === 'no_data') return 'SCHEDULED';
  return 'NO_DATA';
}

function round(n: number, decimals = 1) {
  const f = 10 ** decimals;
  return Math.round(n * f) / f;
}

const GEOMETRY_CACHE_TTL_SECONDS = 30 * 24 * 60 * 60; // 30 days — route geometry never changes

async function getRouteGeometry(
  trainNumber: string,
  env: Env,
): Promise<RailRadarGeometryStop[]> {
  const cacheKey = `routeGeometry:${trainNumber}`;

  if (env.RAILGAADI_CACHE) {
    const cached = await env.RAILGAADI_CACHE.get<RailRadarGeometryStop[]>(cacheKey, 'json');
    if (cached) return cached;
  }

  const upstream = await fetch(
    `https://api.railradar.in/v1/trains/${encodeURIComponent(trainNumber)}/route?format=geojson&stops=true`,
    { headers: { Authorization: `Bearer ${env.RAILRADAR_API_KEY}` } },
  );

  if (!upstream.ok) {
    // Degrade gracefully: no coordinates, map hides itself client-side.
    return [];
  }

  const body: any = await upstream.json();
  const stops: RailRadarGeometryStop[] = body.data?.stops ?? [];

  if (env.RAILGAADI_CACHE && stops.length) {
    await env.RAILGAADI_CACHE.put(cacheKey, JSON.stringify(stops), {
      expirationTtl: GEOMETRY_CACHE_TTL_SECONDS,
    });
  }

  return stops;
}

function buildPayload(
  trainNumber: string,
  raw: RailRadarLiveData,
  geometryStops: RailRadarGeometryStop[],
) {
  const liveRoute = raw.route ?? [];
  const geometryByCode = new Map(geometryStops.map((s) => [s.code, s]));

  // The live endpoint doesn't always include "previousHalt" (e.g. before a
  // train departs its origin) — fall back to matching currentLocation's
  // station, then to previousHalt if RailRadar does send it.
  const currentEntry =
    liveRoute.find((r) => r.stationCode === raw.currentLocation?.stationCode) ??
    (raw.previousHalt
      ? liveRoute.find((r) => r.stationCode === raw.previousHalt!.stationCode)
      : undefined);

  const nextHalt = raw.nextHalt;
  const segmentProgress = raw.currentLocation?.segmentProgress ?? 0;

  const prevDistance = currentEntry?.distance ?? raw.previousHalt?.distance ?? 0;
  const nextDistance = nextHalt?.distance ?? prevDistance;
  const distanceTotalKm = liveRoute.length
    ? liveRoute[liveRoute.length - 1].distance
    : nextDistance;
  const distanceCoveredKm = prevDistance + segmentProgress * (nextDistance - prevDistance);
  const percentComplete = distanceTotalKm > 0 ? (distanceCoveredKm / distanceTotalKm) * 100 : 0;

  const prevGeo = currentEntry ? geometryByCode.get(currentEntry.stationCode) : undefined;
  const nextGeo = nextHalt ? geometryByCode.get(nextHalt.stationCode) : undefined;

  let position: { lat: number; lng: number; bearing: number } | null = null;
  if (prevGeo && nextGeo) {
    position = {
      lat: prevGeo.lat + segmentProgress * (nextGeo.lat - prevGeo.lat),
      lng: prevGeo.lng + segmentProgress * (nextGeo.lng - prevGeo.lng),
      bearing: raw.currentLocation?.bearingDegrees ?? 0,
    };
  } else if (prevGeo) {
    position = { lat: prevGeo.lat, lng: prevGeo.lng, bearing: 0 };
  }

  // ETA from RailRadar's own scheduled time + delay for the next stop, rather
  // than a speed-based guess — far more accurate when the data is present.
  let etaNextStation: string | null = null;
  const nextRouteEntry = nextHalt
    ? liveRoute.find((r) => r.stationCode === nextHalt.stationCode)
    : undefined;
  if (nextRouteEntry?.scheduledArrival) {
    const delay = nextRouteEntry.delayArrival ?? nextRouteEntry.delayDeparture ?? raw.delayMinutes ?? 0;
    etaNextStation = new Date(
      new Date(nextRouteEntry.scheduledArrival).getTime() + delay * 60_000,
    ).toISOString();
  } else if (nextRouteEntry?.scheduledDeparture) {
    const delay = nextRouteEntry.delayDeparture ?? raw.delayMinutes ?? 0;
    etaNextStation = new Date(
      new Date(nextRouteEntry.scheduledDeparture).getTime() + delay * 60_000,
    ).toISOString();
  }

  function computeHaltMinutes(r: RailRadarLiveRouteStop): number | null {
    if (!r.scheduledArrival || !r.scheduledDeparture) return null;
    const mins = Math.round(
      (new Date(r.scheduledDeparture).getTime() - new Date(r.scheduledArrival).getTime()) /
        60_000,
    );
    return mins > 0 ? mins : null;
  }

  // Map-specific route: only stations we have coordinates for (needs the
  // separate route-geometry call, so can be empty if that fails/degrades).
  const route = liveRoute
    .map((r) => {
      const geo = geometryByCode.get(r.stationCode);
      if (!geo) return null;
      return {
        stationCode: r.stationCode,
        stationName: r.stationName ?? geo.name,
        lat: geo.lat,
        lng: geo.lng,
        distanceKm: r.distance,
        isHalt: r.isHalt ?? false,
        arrivalTime: r.scheduledArrival ?? null,
        departureTime: r.scheduledDeparture ?? null,
        haltMinutes: computeHaltMinutes(r),
      };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null);

  // Station-list timeline: every station RailRadar's live endpoint knows
  // about, independent of whether coordinates were available — this is what
  // powers the station-by-station list view, and never degrades just
  // because the map's geometry lookup failed.
  const timeline = liveRoute.map((r) => ({
    stationCode: r.stationCode,
    stationName: r.stationName,
    distanceKm: r.distance,
    isHalt: r.isHalt ?? false,
    status: r.status ?? null,
    scheduledArrival: r.scheduledArrival ?? null,
    scheduledDeparture: r.scheduledDeparture ?? null,
    delayArrivalMinutes: r.delayArrival ?? null,
    delayDepartureMinutes: r.delayDeparture ?? null,
    haltMinutes: computeHaltMinutes(r),
  }));

  return {
    train: {
      number: raw.trainNumber ?? trainNumber,
      name: raw.trainName ?? '',
      date: raw.startDate ?? '',
    },
    status: {
      state: mapState(raw.status),
      delayMinutes: raw.delayMinutes ?? 0,
      currentStation: currentEntry?.stationName ?? raw.previousHalt?.stationName ?? null,
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
    route,
    timeline,
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
  const geometryStops = await getRouteGeometry(trainNumber, context.env);
  const payload = buildPayload(trainNumber, raw, geometryStops);

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
