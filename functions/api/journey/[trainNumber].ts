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
    // burning requests — better to show a stale/error state for a minute
    // than to hammer an already-failing or quota-capped upstream.
    if (context.env.RAILGAADI_CACHE) {
      await context.env.RAILGAADI_CACHE.put(cacheKey, JSON.stringify(errorPayload), {
        expirationTtl: 60,
      });
    }
    return Response.json(errorPayload, { status: 502 });
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
    // 10-minute cache (up from the original 25s) — RailRadar's free tier caps
    // at 50 requests/day, so this shares one upstream call across every user
    // looking at this train for the next 10 minutes, instead of burning
    // quota per-poll. Trade-off: "live" position can be up to 10 min stale.
    await context.env.RAILGAADI_CACHE.put(cacheKey, JSON.stringify(payload), {
      expirationTtl: 600,
    });
  }

  return Response.json(payload);
};
