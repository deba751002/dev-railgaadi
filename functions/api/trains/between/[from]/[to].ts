interface Env {
  RAILRADAR_API_KEY: string;
  RAILGAADI_CACHE?: KVNamespace;
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const from = (context.params.from as string).toUpperCase();
  const to = (context.params.to as string).toUpperCase();
  const url = new URL(context.request.url);
  const date = url.searchParams.get('date') ?? new Date().toISOString().slice(0, 10);

  const cacheKey = `between:${from}:${to}:${date}`;
  if (context.env.RAILGAADI_CACHE) {
    const cached = await context.env.RAILGAADI_CACHE.get<any>(cacheKey, 'json');
    if (cached) return Response.json(cached, { status: cached.error ? 502 : 200 });
  }

  const upstreamUrl = `https://api.railradar.in/v1/trains/between/${encodeURIComponent(from)}/${encodeURIComponent(to)}?date=${date}`;
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
    if (context.env.RAILGAADI_CACHE) {
      await context.env.RAILGAADI_CACHE.put(cacheKey, JSON.stringify(errorPayload), {
        expirationTtl: 60,
      });
    }
    return Response.json(errorPayload, { status: 502 });
  }

  const body: any = await upstream.json();
  const raw = body.data ?? body;

  const payload = {
    from: raw.from ?? { code: from, name: from },
    to: raw.to ?? { code: to, name: to },
    trains: (raw.trains ?? []).map((t: any) => ({
      number: t.train?.number,
      name: t.train?.name,
      type: t.train?.type,
      runDays: t.train?.runDays ?? [],
      departure: t.from?.departure ?? null,
      arrival: t.to?.arrival ?? null,
      distanceKm: t.distance ?? null,
      durationMinutes: t.duration ?? null,
      haltsBetween: t.totalHaltsBetween ?? 0,
      delayMinutes: t.live?.delayMinutes ?? null,
    })),
  };

  if (context.env.RAILGAADI_CACHE) {
    // 10-minute cache — this response mixes static schedule with live delay
    // info, so keep it in step with the same freshness window as the
    // journey endpoint rather than caching it long-term.
    await context.env.RAILGAADI_CACHE.put(cacheKey, JSON.stringify(payload), {
      expirationTtl: 600,
    });
  }

  return Response.json(payload);
};
