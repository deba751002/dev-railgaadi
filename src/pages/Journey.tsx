import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { fetchJourney } from '../services/trainService';

function delayPillClass(delayMinutes: number) {
  if (delayMinutes <= 0) return 'pill--onTime';
  if (delayMinutes < 30) return 'pill--minor';
  return 'pill--major';
}

export default function Journey() {
  const { trainNumber } = useParams<{ trainNumber: string }>();

  const { data, isLoading, isError, dataUpdatedAt } = useQuery({
    queryKey: ['journey', trainNumber],
    queryFn: () => fetchJourney(trainNumber!),
    enabled: !!trainNumber,
    refetchInterval: 30_000,
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
          {data.progress.distanceCoveredKm}km / {data.progress.distanceTotalKm}km)
        </p>
        <p style={{ color: 'var(--text-secondary)', fontSize: 12 }}>
          Last updated: {new Date(data.status.lastUpdated).toLocaleTimeString()} · refreshed{' '}
          {new Date(dataUpdatedAt).toLocaleTimeString()}
        </p>
      </div>
    </div>
  );
}
