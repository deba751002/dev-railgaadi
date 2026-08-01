interface Env {
  RAILRADAR_API_KEY: string;
  RAILGAADI_CACHE?: KVNamespace;
}

// NOTE: RailRadar's actual endpoint path/response shape needs to be confirmed
// against their real API docs — this assumes a generic REST search endpoint.
// Adjust the URL/parsing below once you have their docs open.
export const onRequestGet: PagesFunction<Env> = async (context) => {
  const url = new URL(context.request.url);
  const q = url.searchParams.get('q')?.trim();

  if (!q || q.length < 2) {
    return Response.json({ results: [] });
  }

  const cacheKey = `search:${q.toLowerCase()}`;
  if (context.env.RAILGAADI_CACHE) {
    const cached = await context.env.RAILGAADI_CACHE.get(cacheKey, 'json');
    if (cached) return Response.json(cached);
  }

  const upstreamUrl = `https://api.railradar.in/v1/trains/search?query=${encodeURIComponent(q)}`;
  const upstream = await fetch(upstreamUrl, {
    headers: { Authorization: `Bearer ${context.env.RAILRADAR_API_KEY}` },
  });

  if (!upstream.ok) {
    const errorBody = await upstream.text();
    const errorPayload = {
      results: [],
      // TEMPORARY DEBUG — remove once RailRadar integration is confirmed working.
      debug: {
        upstreamUrl,
        upstreamStatus: upstream.status,
        upstreamStatusText: upstream.statusText,
        upstreamBody: errorBody.slice(0, 500),
        keyPresent: !!context.env.RAILRADAR_API_KEY,
      },
    };
    // Cache the error briefly too (see journey/[trainNumber].ts for why) so
    // repeated searches for the same query during a quota/outage window
    // don't keep burning RailRadar's 50/day free quota.
    if (context.env.RAILGAADI_CACHE) {
      await context.env.RAILGAADI_CACHE.put(cacheKey, JSON.stringify(errorPayload), {
        expirationTtl: 60,
      });
    }
    return Response.json(errorPayload, { status: 200 });
  }

  const data = await upstream.json();

  // TODO: map RailRadar's real response fields once confirmed.
  const payload = {
    results: (data.trains ?? data.results ?? []).map((t: any) => ({
      trainNumber: t.trainNumber ?? t.number,
      name: t.name ?? t.trainName,
      origin: t.origin ?? t.source,
      destination: t.destination ?? t.dest,
    })),
  };

  if (context.env.RAILGAADI_CACHE) {
    // 10-minute cache — same reasoning as journey/[trainNumber].ts, shares
    // one upstream call across everyone searching the same query.
    await context.env.RAILGAADI_CACHE.put(cacheKey, JSON.stringify(payload), {
      expirationTtl: 600,
    });
  }

  return Response.json(payload);
};
