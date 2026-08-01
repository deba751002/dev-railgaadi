interface Env {
  RAILRADAR_API_KEY: string;
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

  const upstreamUrl = `https://api.railradar.in/v1/trains/search?query=${encodeURIComponent(q)}`;
  const upstream = await fetch(upstreamUrl, {
    headers: { Authorization: `Bearer ${context.env.RAILRADAR_API_KEY}` },
  });

  if (!upstream.ok) {
    const errorBody = await upstream.text();
    // TEMPORARY DEBUG — remove once RailRadar integration is confirmed working.
    return Response.json(
      {
        results: [],
        debug: {
          upstreamUrl,
          upstreamStatus: upstream.status,
          upstreamStatusText: upstream.statusText,
          upstreamBody: errorBody.slice(0, 500),
          keyPresent: !!context.env.RAILRADAR_API_KEY,
        },
      },
      { status: 200 },
    );
  }

  const data = await upstream.json();

  // TODO: map RailRadar's real response fields once confirmed.
  const results = (data.trains ?? data.results ?? []).map((t: any) => ({
    trainNumber: t.trainNumber ?? t.number,
    name: t.name ?? t.trainName,
    origin: t.origin ?? t.source,
    destination: t.destination ?? t.dest,
  }));

  return Response.json({ results });
};
