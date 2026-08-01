interface Env {
  RAILRADAR_API_KEY: string;
  RAILGAADI_CACHE?: KVNamespace;
}

const LOOKUP_CACHE_KEY = 'lookup:all-trains';
// RailRadar's /v1/lookup/trains has no query params — it returns every active
// train as a flat { number: name } map, meant to be fetched once and searched
// client/server-side. Caching it long-term means the ENTIRE search feature
// costs at most a couple of RailRadar calls per day, not one per keystroke.
const LOOKUP_CACHE_TTL_SECONDS = 12 * 60 * 60; // 12 hours

async function getTrainLookupMap(env: Env): Promise<Record<string, string>> {
  if (env.RAILGAADI_CACHE) {
    const cached = await env.RAILGAADI_CACHE.get<Record<string, string>>(
      LOOKUP_CACHE_KEY,
      'json',
    );
    if (cached) return cached;
  }

  const upstream = await fetch('https://api.railradar.in/v1/lookup/trains', {
    headers: { Authorization: `Bearer ${env.RAILRADAR_API_KEY}` },
  });

  if (!upstream.ok) {
    throw new Error(`lookup_failed_${upstream.status}`);
  }

  const raw = await upstream.json();
  const map: Record<string, string> = raw.data ?? {};

  if (env.RAILGAADI_CACHE) {
    await env.RAILGAADI_CACHE.put(LOOKUP_CACHE_KEY, JSON.stringify(map), {
      expirationTtl: LOOKUP_CACHE_TTL_SECONDS,
    });
  }

  return map;
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const url = new URL(context.request.url);
  const q = url.searchParams.get('q')?.trim().toLowerCase();

  if (!q || q.length < 2) {
    return Response.json({ results: [] });
  }

  let lookupMap: Record<string, string>;
  try {
    lookupMap = await getTrainLookupMap(context.env);
  } catch (err) {
    return Response.json(
      { results: [], debug: { error: String(err) } },
      { status: 200 },
    );
  }

  const results = Object.entries(lookupMap)
    .filter(
      ([number, name]) =>
        number.includes(q) || name.toLowerCase().includes(q),
    )
    .slice(0, 20)
    .map(([trainNumber, name]) => ({ trainNumber, name }));

  return Response.json({ results });
};
