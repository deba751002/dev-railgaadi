import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { fetchJourney } from '../services/trainService';
import JourneyMap from '../components/JourneyMap';
import StationTimeline from '../components/StationTimeline';

function delayPillClass(delayMinutes: number) {
  if (delayMinutes <= 0) return 'pill--onTime';
  if (delayMinutes < 30) return 'pill--minor';
  return 'pill--major';
}

export default function Journey() {
  const { trainNumber } = useParams<{ trainNumber: string }>();

  const { data, isLoading, isFetching, isError, dataUpdatedAt, refetch } = useQuery({
    queryKey: ['journey', trainNumber],
    queryFn: () => fetchJourney(trainNumber!),
    enabled: !!trainNumber,
    // No auto-refresh: RailRadar's free tier caps at 50 requests/day, so
    // refreshing is user-initiated instead of polling every 30s. The
    // response is also cached 10 min server-side, so a manual refresh
    // within that window won't cost an extra upstream call either.
  });

  if (isLoading) {
    return <div style={{ padding: 40 }}>Loading journey…</div>;
  }

  if (isError || !data) {
    return (
      <div style={{ padding: 40 }}>
        Live data temporarily unavailable for train {trainNumber}.
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 640, margin: '0 auto', padding: '32px 20px' }}>
      <div className="card" style={{ padding: 0, overflow: 'hidden', marginBottom: 16 }}>
        <JourneyMap
          route={data.route ?? []}
          position={data.position ?? null}
          distanceCoveredKm={data.progress?.distanceCoveredKm ?? 0}
        />
      </div>
      <div className="card">
        <h2 style={{ margin: 0 }}>
          {data.train.number} — {data.train.name}
        </h2>
        <div style={{ marginTop: 8 }}>
          <span className={`pill ${delayPillClass(data.status.delayMinutes)}`}>
            {data.status.delayMinutes <= 0
              ? 'On Time'
              : `+${data.status.delayMinutes} min`}
          </span>
        </div>
        <p style={{ color: 'var(--text-secondary)' }}>
          Current: {data.status.currentStation ?? '—'} &nbsp;|&nbsp; Next:{' '}
          {data.status.nextStation ?? '—'}
        </p>
        <p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>
          {data.progress.percentComplete.toFixed(1)}% complete (
          {data.progress.distanceCoveredKm}km / {data.progress.distanceTotalKm}km covered ·{' '}
          {Math.max(0, data.progress.distanceTotalKm - data.progress.distanceCoveredKm)}km remaining)
        </p>
        {(() => {
          const last = data.timeline?.[data.timeline.length - 1];
          if (!last?.scheduledArrival) return null;
          const delay = last.delayArrivalMinutes ?? data.status.delayMinutes ?? 0;
          const eta = new Date(new Date(last.scheduledArrival).getTime() + delay * 60_000);
          return (
            <p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>
              Expected at {last.stationName}: {eta.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              {last.scheduledArrival && ` (sch. ${new Date(last.scheduledArrival).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})`}
            </p>
          );
        })()}
        <p style={{ color: 'var(--text-secondary)', fontSize: 12 }}>
          Last updated: {new Date(data.status.lastUpdated).toLocaleTimeString()} · refreshed{' '}
          {new Date(dataUpdatedAt).toLocaleTimeString()}
        </p>
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          style={{
            marginTop: 8,
            padding: '10px 20px',
            borderRadius: 999,
            border: 'none',
            background: 'var(--accent-primary)',
            color: '#fff',
            fontWeight: 600,
            cursor: isFetching ? 'default' : 'pointer',
            opacity: isFetching ? 0.6 : 1,
          }}
        >
          {isFetching ? 'Refreshing…' : 'Refresh status'}
        </button>
      </div>
      {data.coachPositions && data.coachPositions.length > 0 && (
        <div className="card" style={{ marginTop: 16 }}>
          <h3 style={{ margin: '0 0 8px' }}>Coach Position (Engine → Last)</h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {data.coachPositions.map((coach, i) => (
              <span
                key={coach + i}
                style={{
                  padding: '4px 10px',
                  borderRadius: 8,
                  background: coach.toLowerCase().includes('engine') ? '#1C1C1E' : 'var(--bg-base)',
                  color: coach.toLowerCase().includes('engine') ? '#fff' : 'var(--text-primary)',
                  fontSize: 12,
                  fontWeight: 600,
                  border: '1px solid var(--border-subtle)',
                }}
              >
                {coach}
              </span>
            ))}
          </div>
        </div>
      )}
      <div className="card" style={{ marginTop: 16 }}>
        <h3 style={{ margin: '0 0 8px' }}>Station Schedule</h3>
        <StationTimeline
          timeline={data.timeline ?? []}
          currentStation={data.status.currentStation}
          distanceCoveredKm={data.progress?.distanceCoveredKm ?? 0}
        />
      </div>
    </div>
  );
}
