import { useState, useEffect } from 'react';
import api from '../../utils/api';
import { useSocket } from '../../context/SocketContext';

export default function InsightsPanel({ boardId }) {
  const [insights, setInsights] = useState([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(null);
  const { on, off } = useSocket();

  useEffect(() => {
    if (!boardId) return;
    loadInsights();
  }, [boardId]);

  useEffect(() => {
    if (!boardId) return;

    const handleInsight = ({ insight }) => {
      setInsights(prev => [insight, ...prev]);
    };

    const handleProgress = (data) => {
      setProgress(data);
      if (data.status === 'done' || data.status === 'error' || data.status === 'skipped') {
        setTimeout(() => setProgress(null), 3000);
      }
    };

    on('ai:insight', handleInsight);
    on('ai:progress', handleProgress);

    return () => {
      off('ai:insight', handleInsight);
      off('ai:progress', handleProgress);
    };
  }, [boardId, on, off]);

  const loadInsights = async () => {
    try {
      const data = await api.getInsights(boardId);
      setInsights(data.insights);
    } catch (err) {
      console.error('Failed to load insights:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleRun = async () => {
    setRunning(true);
    try {
      await api.runAI(boardId);
    } catch (err) {
      console.error('Failed to run AI:', err);
    } finally {
      setTimeout(() => setRunning(false), 2000);
    }
  };

  const handleAction = async (insightId, status) => {
    try {
      await api.updateInsight(boardId, insightId, { status });
      setInsights(prev => prev.map(i => i.id === insightId ? { ...i, status } : i));
    } catch (err) {
      console.error('Failed to update insight:', err);
    }
  };

  const bottlenecks = insights.filter(i => i.type === 'bottleneck' && i.status === 'pending');
  const sprintRisks = insights.filter(i => i.type === 'sprint_risk' && i.status === 'pending');
  const autoAssigns = insights.filter(i => i.type === 'auto_assign' && i.status === 'pending');
  const pendingOthers = insights.filter(i => !['bottleneck', 'sprint_risk', 'auto_assign'].includes(i.type) && i.status === 'pending');

  return (
    <div className="ai-side-panel">
      <div className="ai-header-card">
        <div className="ai-header-icon">
          <span className="material-symbols-outlined" style={{ fontSize: 24 }}>auto_awesome</span>
        </div>
        <div style={{ flex: 1 }}>
          <div className="ai-header-title">AI Insights</div>
          <div className="ai-header-subtitle">Real-time sprint analysis</div>
        </div>
        <button
          className="btn btn-primary btn-sm"
          onClick={handleRun}
          disabled={running}
          style={{ display: 'flex', alignItems: 'center', gap: 4 }}
        >
          {running ? (
            <><div className="loading-spinner" style={{ width: 14, height: 14, borderWidth: 2 }} /> Running...</>
          ) : (
            <><span className="material-symbols-outlined" style={{ fontSize: 16 }}>play_arrow</span> Analyze</>
          )}
        </button>
      </div>

      {progress && (
        <div className="ai-progress" style={{ borderRadius: 'var(--radius-xl)' }}>
          <div className="loading-spinner" style={{ width: 14, height: 14, borderWidth: 2 }} />
          <span>{progress.message || `${progress.type}: ${progress.status}`}</span>
        </div>
      )}

      {loading ? (
        <div className="empty-state" style={{ padding: 'var(--space-xl)' }}>
          <div className="loading-spinner" />
        </div>
      ) : (
        <>
          {bottlenecks.length > 0 && (
            <div className="ai-glass-section">
              <div className="ai-section-header">
                <span className="material-symbols-outlined" style={{ fontSize: 20, color: 'var(--tertiary)' }}>warning</span>
                <h4 className="ai-section-title">Bottleneck Analysis</h4>
              </div>
              {bottlenecks.map(insight => {
                const data = insight.data;
                return (
                  <div key={insight.id} style={{ marginBottom: 'var(--space-sm)' }}>
                    <p style={{ fontSize: 14, color: 'var(--on-surface-variant)', lineHeight: '20px', marginBottom: 'var(--space-md)' }}>
                      The <strong>{data.columnName}</strong> column has {data.cardCount} cards with only {data.exitsThisWeek} exits this week. Consider reallocating resources.
                    </p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-xs)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, fontWeight: 600 }}>
                        <span style={{ color: 'var(--on-surface-variant)' }}>{data.columnName} Load</span>
                        <span style={{ color: 'var(--tertiary)', fontWeight: 700 }}>
                          {data.cardCount > 3 ? `${Math.round((data.cardCount / 3) * 100)}%` : `${data.cardCount * 30}%`} Capacity
                        </span>
                      </div>
                      <div className="ai-progress-bar">
                        <div
                          className="ai-progress-bar-fill"
                          style={{
                            width: `${Math.min(100, data.cardCount > 3 ? 85 : data.cardCount * 25)}%`,
                            background: 'var(--tertiary)',
                          }}
                        />
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 'var(--space-xs)', marginTop: 'var(--space-sm)' }}>
                      <button className="btn btn-primary btn-sm" onClick={() => handleAction(insight.id, 'accepted')}>
                        <span className="material-symbols-outlined" style={{ fontSize: 14 }}>check</span> Accept
                      </button>
                      <button className="btn btn-ghost btn-sm" onClick={() => handleAction(insight.id, 'dismissed')}>Dismiss</button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {sprintRisks.length > 0 && (
            <div className="ai-glass-section">
              <div className="ai-section-header">
                <span className="material-symbols-outlined" style={{ fontSize: 20, color: 'var(--error)' }}>error</span>
                <h4 className="ai-section-title">Sprint Risk Summary</h4>
              </div>
              {sprintRisks.map(insight => {
                const data = insight.data;
                return (
                  <div key={insight.id}>
                    <div className="ai-risk-banner">
                      <span className="material-symbols-outlined" style={{ color: 'var(--error)', marginTop: 2, fontSize: 18 }}>flag</span>
                      <div>
                        <div className="ai-risk-banner-title">
                          {data.risk?.replace('_', ' ')} risk — {data.remainingCards || '?'} tasks remaining
                        </div>
                        <div className="ai-risk-banner-subtitle">{data.message}</div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: 'var(--space-md)', fontSize: 13, color: 'var(--secondary)', marginTop: 'var(--space-xs)' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <span className="material-symbols-outlined" style={{ fontSize: 16 }}>trending_up</span>
                        Velocity: {data.velocityPerDay}/day
                      </span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <span className="material-symbols-outlined" style={{ fontSize: 16 }}>timer</span>
                        {data.daysRemaining}d left
                      </span>
                    </div>

                    <div style={{ display: 'flex', gap: 'var(--space-xs)', marginTop: 'var(--space-sm)' }}>
                      <button className="btn btn-primary btn-sm" onClick={() => handleAction(insight.id, 'accepted')}>
                        <span className="material-symbols-outlined" style={{ fontSize: 14 }}>check</span> Accept
                      </button>
                      <button className="btn btn-ghost btn-sm" onClick={() => handleAction(insight.id, 'dismissed')}>Dismiss</button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {autoAssigns.length > 0 && (
            <div className="ai-auto-section">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-sm)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-xs)' }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 20, color: 'var(--primary)' }}>smart_toy</span>
                  <h4 className="ai-section-title">Auto-Assignment</h4>
                </div>
                <span style={{
                  background: 'var(--primary)', color: 'var(--on-primary)',
                  fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 'var(--radius-full)',
                }}>
                  {autoAssigns.length} Pending
                </span>
              </div>
              <p style={{ fontSize: 12, fontWeight: 500, color: 'var(--on-surface-variant)', marginBottom: 'var(--space-md)', letterSpacing: '0.01em' }}>
                AI suggests reassigning blocked tasks to available team members with matching skills.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
                {autoAssigns.map(insight => {
                  const data = insight.data;
                  return (
                    <div key={insight.id} className="ai-suggestion-card">
                      <div style={{ paddingLeft: 'var(--space-sm)' }}>
                        <div style={{ marginBottom: 'var(--space-xs)' }}>
                          <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--on-surface-variant)' }}>Task:</span>
                          <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--on-surface)' }}>
                            {data.cardTitle || 'Task'}
                          </div>
                        </div>

                        {data.suggestedAssignee && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)', marginBottom: 'var(--space-sm)' }}>
                            <span className="material-symbols-outlined" style={{ fontSize: 16, color: 'var(--outline-variant)' }}>arrow_forward</span>
                            <div style={{
                              display: 'flex', alignItems: 'center', gap: 'var(--space-xs)',
                              background: 'var(--surface-container)', padding: '4px 8px', borderRadius: 'var(--radius)',
                            }}>
                              <div style={{
                                width: 16, height: 16, borderRadius: '50%',
                                background: 'linear-gradient(135deg, var(--primary-fixed-dim), var(--secondary-fixed-dim))',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: 8, fontWeight: 700, color: 'var(--on-primary-fixed)',
                              }}>
                                {data.suggestedAssignee?.charAt(0).toUpperCase()}
                              </div>
                              <span style={{ fontSize: 11, fontWeight: 500 }}>{data.suggestedAssignee}</span>
                              <span style={{
                                fontSize: 10, color: 'var(--secondary)', marginLeft: 4,
                                background: 'var(--secondary-container)', padding: '1px 4px', borderRadius: 'var(--radius-sm)',
                              }}>Available</span>
                            </div>
                          </div>
                        )}

                        <div className="ai-suggestion-actions">
                          <button className="ai-suggestion-approve" onClick={() => handleAction(insight.id, 'accepted')}>
                            <span className="material-symbols-outlined" style={{ fontSize: 14 }}>check</span> Approve
                          </button>
                          <button className="ai-suggestion-reject" onClick={() => handleAction(insight.id, 'dismissed')}>
                            <span className="material-symbols-outlined" style={{ fontSize: 14 }}>close</span> Reject
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {pendingOthers.length > 0 && (
            <div className="ai-glass-section">
              <div className="ai-section-header">
                <span className="material-symbols-outlined" style={{ fontSize: 20, color: 'var(--primary)' }}>lightbulb</span>
                <h4 className="ai-section-title">Other Insights</h4>
              </div>
              {pendingOthers.map(insight => (
                <div key={insight.id} className="insight-card" style={{ marginBottom: 'var(--space-sm)' }}>
                  <div className="ai-insight-body">{JSON.stringify(insight.data)}</div>
                  <div style={{ display: 'flex', gap: 'var(--space-xs)', marginTop: 'var(--space-sm)' }}>
                    <button className="btn btn-primary btn-sm" onClick={() => handleAction(insight.id, 'accepted')}>Accept</button>
                    <button className="btn btn-ghost btn-sm" onClick={() => handleAction(insight.id, 'dismissed')}>Dismiss</button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {insights.length === 0 && (
            <div className="ai-glass-section" style={{ textAlign: 'center', padding: 'var(--space-xl)' }}>
              <span className="material-symbols-outlined" style={{ fontSize: 32, color: 'var(--outline)', opacity: 0.5 }}>auto_awesome</span>
              <p style={{ fontSize: 14, color: 'var(--outline)', marginTop: 'var(--space-sm)' }}>
                No insights yet. Run analysis to get AI suggestions.
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
