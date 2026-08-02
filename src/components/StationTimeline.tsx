import type { JourneyResponse } from '../services/trainService';

interface StationTimelineProps {
  timeline: JourneyResponse['timeline'];
  currentStation: string | null;
  distanceCoveredKm: number;
}

function formatTime(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function delayLabel(minutes: number | null) {
  if (minutes === null) return null;
  if (minutes <= 0) return { text: `${Math.abs(minutes)} min early`, color: 'var(--status-onTime)' };
  if (minutes < 30) return { text: `${minutes} min late`, color: 'var(--status-minor)' };
  return { text: `${minutes} min late`, color: 'var(--status-major)' };
}

export default function StationTimeline({
  timeline,
  currentStation,
  distanceCoveredKm,
}: StationTimelineProps) {
  if (!timeline.length) {
    return (
      <div style={{ padding: 24, color: 'var(--text-secondary)' }}>
        Station schedule unavailable for this train.
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {timeline.map((stop, i) => {
        const isPassed = stop.distanceKm < distanceCoveredKm - 0.1;
        const isCurrent = stop.stationName === currentStation;
        const delay = delayLabel(stop.delayArrivalMinutes ?? stop.delayDepartureMinutes);

        return (
          <div
            key={stop.stationCode + i}
            style={{
              display: 'flex',
              gap: 12,
              padding: '10px 4px',
              borderBottom: i < timeline.length - 1 ? '1px solid var(--border-subtle)' : 'none',
              opacity: isPassed || isCurrent ? 1 : 0.55,
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 20 }}>
              <div
                style={{
                  width: 12,
                  height: 12,
                  borderRadius: '50%',
                  background: isCurrent
                    ? 'var(--accent-primary)'
                    : isPassed
                      ? 'var(--status-onTime)'
                      : 'var(--border-subtle)',
                  border: isCurrent ? '2px solid var(--accent-primary)' : 'none',
                  boxShadow: isCurrent ? '0 0 0 4px rgba(10,132,255,0.2)' : 'none',
                  flexShrink: 0,
                }}
              />
              {i < timeline.length - 1 && (
                <div
                  style={{
                    width: 2,
                    flex: 1,
                    background: isPassed ? 'var(--status-onTime)' : 'var(--border-subtle)',
                    marginTop: 2,
                  }}
                />
              )}
            </div>

            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                <strong style={{ fontSize: 14 }}>{stop.stationName}</strong>
                <span style={{ fontSize: 12, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                  {stop.distanceKm} km
                </span>
              </div>
              <div
                style={{
                  display: 'flex',
                  gap: 16,
                  fontSize: 12,
                  color: 'var(--text-secondary)',
                  marginTop: 2,
                }}
              >
                <span>Arr: {formatTime(stop.scheduledArrival)}</span>
                <span>Dep: {formatTime(stop.scheduledDeparture)}</span>
                {stop.haltMinutes && <span>Halt: {stop.haltMinutes}m</span>}
              </div>
              {delay && (isPassed || isCurrent) && (
                <div style={{ fontSize: 12, color: delay.color, marginTop: 2, fontWeight: 600 }}>
                  {delay.text}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
