import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { searchTrains } from '../services/trainService';

export default function Home() {
  const [query, setQuery] = useState('');
  const navigate = useNavigate();

  const { data: results, isFetching } = useQuery({
    queryKey: ['search', query],
    queryFn: () => searchTrains(query),
    enabled: query.trim().length >= 2,
  });

  return (
    <div style={{ maxWidth: 560, margin: '0 auto', padding: '48px 20px' }}>
      <h1 style={{ textAlign: 'center', fontSize: 28, marginBottom: 8 }}>Dev RailGaadi</h1>
      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        <span
          onClick={() => navigate('/between')}
          style={{ color: 'var(--accent-primary)', cursor: 'pointer', fontSize: 14, fontWeight: 600 }}
        >
          Find trains between two stations →
        </span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'center' }}>
        <input
          className="search-bar"
          placeholder="Search train number or name…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      <div style={{ marginTop: 24, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {isFetching && <p style={{ color: 'var(--text-secondary)' }}>Searching…</p>}
        {results?.map((train) => (
          <div
            key={train.trainNumber}
            className="card"
            onClick={() => navigate(`/journey/${train.trainNumber}`)}
          >
            <strong>{train.trainNumber}</strong> — {train.name}
          </div>
        ))}
        {query.trim().length >= 2 && !isFetching && results?.length === 0 && (
          <p style={{ color: 'var(--text-secondary)' }}>
            No trains matched "{query}". Check the number or try the train name.
          </p>
        )}
      </div>
    </div>
  );
}
