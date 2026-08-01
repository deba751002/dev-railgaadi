interface Env {
  RAILRADAR_API_KEY: string;
  RAILGAADI_CACHE?: KVNamespace;
}

// NOTE: RailRadar's actual live-status endpoint/response shape needs to be
// confirmed against their real API docs — adjust the URL/parsing below.
export const onRequestGet: PagesFunction<Env> = async (context) => {
  const trainNumber = context.params.trainNumber as string;
  const cacheKey = `journey:${trainNumber}`;

  if (context.env.RAILGAADI_CACHE) {
    const cached = await context.env.RAILGAADI_CACHE.get(cacheKey, 'json');
    if (cached) return Response.json(cached);
  }

  const upstream = await fetch(
    `https://api.railradar.in/v1/trains/${encodeURIComponent(trainNumber)}/live`,
    { headers: { Authorization: `Bearer ${context.env.RAILRADAR_API_KEY}` } },
  );

  if (!upstream.ok) {
    return Response.json({ error: 'upstream_error' }, { status: 502 });
  }

  const raw = await upstream.json();

  // TODO: map RailRadar's real response fields once confirmed.
  const payload = {
    train: { number: trainNumber, name: raw.trainName ?? '', date: raw.journeyDate ?? '' },
    status: {
      state: raw.state ?? 'NO_DATA',
      delayMinutes: raw.delayMinutes ?? 0,
      currentStation: raw.currentStation ?? null,
      nextStation: raw.nextStation ?? null,
      etaNextStation: raw.etaNextStation ?? null,
      lastUpdated: raw.lastUpdated ?? new Date().toISOString(),
    },
    position: raw.position ?? null,
    progress: {
      distanceCoveredKm: raw.distanceCoveredKm ?? 0,
      distanceTotalKm: raw.distanceTotalKm ?? 0,
      percentComplete: raw.percentComplete ?? 0,
    },
  };

  if (context.env.RAILGAADI_CACHE) {
    await context.env.RAILGAADI_CACHE.put(cacheKey, JSON.stringify(payload), {
      expirationTtl: 25,
    });
  }

  return Response.json(payload);
};
