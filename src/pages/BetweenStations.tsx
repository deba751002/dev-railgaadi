import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  searchStations,
  fetchTrainsBetween,
  type StationSearchResult,
} from '../services/trainService';

function StationInput({
  label,
  value,
  onSelect,
}: {
  label: string;
  value: StationSearchResult | null;
  onSelect: (station: StationSearchResult | null) => void;
}) {
  const [query, setQuery] = useState('');

  const { data: results } = useQuery({
    queryKey: ['stationSearch', query],
    queryFn: () => searchStations(query),
    enabled: query.trim().length >= 2 && !value,
  });

  if (value) {
    return (
      <div className="card" style={{ display: 'flex', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{label}</div>
          <strong>
            {value.name} ({value.code})
          </strong>
        </div>
        <button
          onClick={() => onSelect(null)}
          style={{ border: 'none', background: 'none', color: 'var(--accent-primary)', cursor: 'pointer' }}
        >
          Change
        </button>
      </div>
    );
  }

  return (
    <div>
      <input
        className="search-bar"
        placeholder={label}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      {results && results.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
          {results.map((s) => (
            <div key={s.code} className="card" onClick={() => onSelect(s)}>
              {s.name} ({s.code})
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function BetweenStations() {
  const [from, setFrom] = useState<StationSearchResult | null>(null);
  const [to, setTo] = useState<StationSearchResult | null>(null);
  const navigate = useNavigate();

  const {
    data,
    isFetching,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['trainsBetween', from?.code, to?.code],
    queryFn: () => fetchTrainsBetween(from!.code, to!.code),
    enabled: false,
  });

  return (
    <div style={{ maxWidth: 560, margin: '0 auto', padding: '32px 20px' }}>
      <h2>Find Trains Between Stations</h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <StationInput label="From station" value={from} onSelect={setFrom} />
        <StationInput label="To station" value={to} onSelect={setTo} />
        <button
          disabled={!from || !to || isFetching}
          onClick={() => refetch()}
          style={{
            padding: '12px 20px',
            borderRadius: 999,
            border: 'none',
            background: 'var(--accent-primary)',
            color: '#fff',
            fontWeight: 600,
            cursor: !from || !to ? 'default' : 'pointer',
            opacity: !from || !to ? 0.5 : 1,
          }}
        >
          {isFetching ? 'Searching…' : 'Find Trains'}
        </button>
      </div>

      {isError && (
        <p style={{ color: 'var(--status-major)', marginTop: 16 }}>
          Could not load trains for this route. Try again.
        </p>
      )}

      {data && (
        <div style={{ marginTop: 24, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>
            {data.trains.length} train{data.trains.length !== 1 ? 's' : ''} from {data.from.name} to{' '}
            {data.to.name}
          </p>
          {data.trains.map((t) => (
            <div key={t.number} className="card" onClick={() => navigate(`/journey/${t.number}`)}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <strong>
                  {t.number} — {t.name}
                </strong>
                {t.delayMinutes !== null && (
                  <span
                    className={`pill ${t.delayMinutes <= 0 ? 'pill--onTime' : t.delayMinutes < 30 ? 'pill--minor' : 'pill--major'}`}
                  >
                    {t.delayMinutes <= 0 ? 'On Time' : `+${t.delayMinutes} min`}
                  </span>
                )}
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>
                {t.departure ?? '—'} → {t.arrival ?? '—'} · {t.haltsBetween} stops between ·{' '}
                {t.distanceKm ?? '—'} km
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
