interface Env {
  RAILRADAR_API_KEY: string;
  RAILGAADI_CACHE?: KVNamespace;
}

const LOOKUP_CACHE_KEY = 'lookup:all-stations';
const LOOKUP_CACHE_TTL_SECONDS = 24 * 60 * 60; // stations list barely ever changes

async function getStationLookupMap(env: Env): Promise<Record<string, string>> {
  if (env.RAILGAADI_CACHE) {
    const cached = await env.RAILGAADI_CACHE.get<Record<string, string>>(
      LOOKUP_CACHE_KEY,
      'json',
    );
    if (cached) return cached;
  }

  const upstream = await fetch('https://api.railradar.in/v1/lookup/stations', {
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
    lookupMap = await getStationLookupMap(context.env);
  } catch (err) {
    return Response.json({ results: [], debug: { error: String(err) } }, { status: 200 });
  }

  const results = Object.entries(lookupMap)
    .filter(([code, name]) => code.toLowerCase().includes(q) || name.toLowerCase().includes(q))
    .slice(0, 20)
    .map(([code, name]) => ({ code, name }));

  return Response.json({ results });
};
