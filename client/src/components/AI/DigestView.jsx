import { useState, useEffect } from 'react';
import { ChartBarIcon, TrendingUpIcon, CircleCheckIcon, StarIcon } from "@animateicons/react/lucide";
import api from '../../utils/api';

export default function DigestView({ boardId }) {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!boardId) return;
    loadReports();
  }, [boardId]);

  const loadReports = async () => {
    try {
      const data = await api.getDigests(boardId);
      setReports(data.reports);
    } catch (err) {
      console.error('Failed to load digests:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="empty-state"><div className="loading-spinner" /></div>;
  }

  if (reports.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon"><ChartBarIcon size="32" /></div>
        <div className="empty-state-text">No weekly digests generated yet.</div>
      </div>
    );
  }

  const latest = reports[0];
  const data = latest.data;

  const maxVelocity = Math.max(...(data.velocityTrend?.map(v => v.completed) || [1]), 1);

  return (
    <div className="digest-container">
      <div className="digest-header">
        <h2 className="headline-md" style={{ marginBottom: 4, display: 'flex', alignItems: 'center', gap: 8 }}>
          <ChartBarIcon size="24" /> Weekly Digest
        </h2>
        <p className="body-md" style={{ color: 'var(--outline)' }}>
          {new Date(data.period?.start).toLocaleDateString()} — {new Date(data.period?.end).toLocaleDateString()}
        </p>
      </div>

      <div className="digest-stats-grid">
        <div className="digest-stat-card">
          <div className="digest-stat-value">{data.summary?.cardsCreated || 0}</div>
          <div className="digest-stat-label">Cards Created</div>
        </div>
        <div className="digest-stat-card">
          <div className="digest-stat-value" style={{ color: 'var(--secondary)' }}>
            {data.summary?.cardsCompleted || 0}
          </div>
          <div className="digest-stat-label">Completed</div>
        </div>
        <div className="digest-stat-card">
          <div className="digest-stat-value" style={{ color: 'var(--tertiary)' }}>
            {data.summary?.totalMoves || 0}
          </div>
          <div className="digest-stat-label">Total Moves</div>
        </div>
        <div className="digest-stat-card">
          <div className="digest-stat-value" style={{
            color: (data.summary?.netChange || 0) > 0 ? 'var(--error)' : 'var(--secondary)',
          }}>
            {(data.summary?.netChange || 0) > 0 ? '+' : ''}{data.summary?.netChange || 0}
          </div>
          <div className="digest-stat-label">Net Change</div>
        </div>
      </div>

      {data.velocityTrend && (
        <div className="digest-section">
          <h3 style={{ display: 'flex', alignItems: 'center', gap: 8 }}><TrendingUpIcon size="20" /> Velocity Trend</h3>
          <div className="digest-stat-row">
            {data.velocityTrend.map((week, i) => (
              <div key={i} className="velocity-bar">
                <div className="velocity-bar-value">{week.completed}</div>
                <div
                  className="velocity-bar-fill"
                  style={{ height: `${(week.completed / maxVelocity) * 100}%` }}
                />
                <div className="velocity-bar-label">{week.week}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {data.columnDistribution && (
        <div className="digest-section">
          <h3 style={{ display: 'flex', alignItems: 'center', gap: 8 }}><CircleCheckIcon size="20" /> Column Distribution</h3>
          <div className="digest-column-bars">
            {data.columnDistribution.map(col => {
              const total = data.columnDistribution.reduce((s, c) => s + c.cardCount, 0) || 1;
              const pct = Math.round((col.cardCount / total) * 100);
              return (
                <div key={col.name} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ width: 100, fontSize: 13, fontWeight: 500 }}>{col.name}</span>
                  <div className="progress-bar" style={{ flex: 1 }}>
                    <div className="progress-bar-fill primary" style={{ width: `${pct}%` }} />
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 600, minWidth: 30, textAlign: 'right' }}>
                    {col.cardCount}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {data.activeMembers?.length > 0 && (
        <div className="digest-section">
          <h3 style={{ display: 'flex', alignItems: 'center', gap: 8 }}><StarIcon size="20" /> Most Active Members</h3>
          <div className="digest-members">
            {data.activeMembers.map((m, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '8px 12px', background: 'var(--surface-container-low)', borderRadius: 'var(--radius)',
              }}>
                <span style={{
                  width: 24, height: 24, borderRadius: '50%',
                  background: i === 0 ? 'var(--tertiary-fixed-dim)' : 'var(--surface-container-high)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 12, fontWeight: 700,
                }}>
                  {i + 1}
                </span>
                <span style={{ flex: 1, fontSize: 14, fontWeight: 500 }}>{m.name}</span>
                <span style={{ fontSize: 13, color: 'var(--outline)' }}>{m.actions} actions</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ textAlign: 'center', fontSize: 12, color: 'var(--outline)', marginTop: 24 }}>
        Generated {new Date(data.generatedAt).toLocaleString()}
      </div>
    </div>
  );
}
