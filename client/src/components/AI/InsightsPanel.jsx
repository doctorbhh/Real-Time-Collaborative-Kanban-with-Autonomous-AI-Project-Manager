import { useState, useEffect, useRef } from 'react';
import api from '../../utils/api';
import { useSocket } from '../../context/SocketContext';

export default function InsightsPanel({ boardId }) {
  const [insights, setInsights] = useState([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [currentPhase, setCurrentPhase] = useState(null);
  const [streamingText, setStreamingText] = useState({
    bottleneck: '',
    sprint_risk: '',
    auto_assign: ''
  });
  const [autoAssignProgress, setAutoAssignProgress] = useState({ current: 0, total: 0, cardTitle: '' });
  const { on, off } = useSocket();
  const endOfStreamRef = useRef(null);

  useEffect(() => {
    if (!boardId) return;
    loadInsights();
  }, [boardId]);

  useEffect(() => {
    if (!boardId) return;

    const handleInsight = ({ insight }) => {
      setInsights(prev => {
        const isDuplicate = prev.some(i => i.id === insight.id);
        if (isDuplicate) {
          return prev.map(i => i.id === insight.id ? insight : i);
        }
        if (insight.type === 'auto_assign') {
          return [insight, ...prev];
        }
        return [insight, ...prev.filter(i => !(i.type === insight.type && i.status === 'pending'))];
      });
      
      setStreamingText(prev => ({ ...prev, [insight.type]: '' }));
    };

    const handleAnalyzing = ({ phase }) => {
      setCurrentPhase(phase);
      if (phase === 'complete') {
        setRunning(false);
        setAutoAssignProgress({ current: 0, total: 0, cardTitle: '' });
        setTimeout(() => setCurrentPhase(null), 3000);
      } else {
        setRunning(true);
      }
    };

    const handleStream = ({ type, chunk }) => {
      if (type === 'auto_assign') {
        // Don't display raw JSON chunks for auto_assign
        return;
      }
      setStreamingText(prev => ({
        ...prev,
        [type]: prev[type] + chunk
      }));
      if (endOfStreamRef.current) {
        endOfStreamRef.current.scrollIntoView({ behavior: 'smooth' });
      }
    };

    const handleAutoAssignProgress = (data) => {
      setAutoAssignProgress(data);
    };

    on('ai:insight', handleInsight);
    on('ai:analyzing', handleAnalyzing);
    on('ai:stream', handleStream);
    on('ai:auto-assign-progress', handleAutoAssignProgress);

    return () => {
      off('ai:insight', handleInsight);
      off('ai:analyzing', handleAnalyzing);
      off('ai:stream', handleStream);
      off('ai:auto-assign-progress', handleAutoAssignProgress);
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
    setStreamingText({ bottleneck: '', sprint_risk: '', auto_assign: '' });
    setCurrentPhase('starting');
    try {
      await api.runAI(boardId);
    } catch (err) {
      console.error('Failed to run AI:', err);
      setRunning(false);
      setCurrentPhase(null);
    }
  };

  const handleRunAutoAssign = async () => {
    setRunning(true);
    setStreamingText(prev => ({ ...prev, auto_assign: '' }));
    setAutoAssignProgress({ current: 0, total: 0, cardTitle: '' });
    setCurrentPhase('auto_assign');
    try {
      await api.runAutoAssign(boardId);
    } catch (err) {
      console.error('Failed to run Auto-Assign:', err);
      setRunning(false);
      setCurrentPhase(null);
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

  const renderAutoAssignStreamingBox = () => {
    if (currentPhase !== 'auto_assign') return null;
    const { current, total, cardTitle } = autoAssignProgress;
    return (
      <div className="ai-glass-section ai-streaming-box" style={{ borderColor: 'var(--primary)' }}>
        <div className="ai-section-header" style={{ marginBottom: 'var(--space-sm)' }}>
          <span className="material-symbols-outlined" style={{ fontSize: 20, color: 'var(--primary)' }}>smart_toy</span>
          <h4 className="ai-section-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            Suggesting Assignees...
            <span className="pulsing-dot" style={{ background: 'var(--primary)' }} />
          </h4>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
          {total > 0 && (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--on-surface-variant)', marginBottom: 4 }}>
                <span>Analyzing task {current} of {total}</span>
                <span>{Math.round((current / total) * 100)}%</span>
              </div>
              <div style={{ height: 4, background: 'var(--surface-container-highest)', borderRadius: 'var(--radius-full)', overflow: 'hidden' }}>
                <div style={{
                  height: '100%',
                  width: `${(current / total) * 100}%`,
                  background: 'linear-gradient(90deg, var(--primary), var(--secondary))',
                  borderRadius: 'var(--radius-full)',
                  transition: 'width 0.4s ease',
                }} />
              </div>
            </>
          )}
          {cardTitle && (
            <div style={{ fontSize: 13, color: 'var(--on-surface)', display: 'flex', alignItems: 'center', gap: 'var(--space-xs)' }}>
              <span className="material-symbols-outlined" style={{ fontSize: 14, color: 'var(--primary)' }}>task_alt</span>
              Finding best match for: <strong style={{ marginLeft: 4 }}>{cardTitle.length > 40 ? cardTitle.slice(0, 40) + '...' : cardTitle}</strong>
            </div>
          )}
          {!total && (
            <div style={{ fontSize: 13, color: 'var(--on-surface-variant)' }}>
              Scanning unassigned tasks...
            </div>
          )}
        </div>
        <div ref={endOfStreamRef} />
      </div>
    );
  };

  const renderStreamingBox = (type, title, icon, colorVar) => {
    if (type === 'auto_assign') return renderAutoAssignStreamingBox();
    if (currentPhase !== type && !streamingText[type]) return null;
    return (
      <div className="ai-glass-section ai-streaming-box" style={{ borderColor: `var(${colorVar})` }}>
        <div className="ai-section-header" style={{ marginBottom: 'var(--space-sm)' }}>
          <span className="material-symbols-outlined" style={{ fontSize: 20, color: `var(${colorVar})` }}>{icon}</span>
          <h4 className="ai-section-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {title}
            {currentPhase === type && (
              <span className="pulsing-dot" style={{ background: `var(${colorVar})` }} />
            )}
          </h4>
        </div>
        <div className="typewriter-text">
          {streamingText[type] || 'Analyzing...'}
          {currentPhase === type && <span className="cursor-blink">|</span>}
        </div>
        <div ref={endOfStreamRef} />
      </div>
    );
  };

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
        <div style={{ display: 'flex', gap: 'var(--space-xs)' }}>
          <button
            className="btn btn-secondary btn-sm"
            onClick={handleRunAutoAssign}
            disabled={running}
            style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 8px' }}
            title="Run Auto-Assign Only"
          >
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>smart_toy</span> 
            {!running && 'Auto-Assign'}
          </button>
          <button
            className="btn btn-primary btn-sm"
            onClick={handleRun}
            disabled={running}
            style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 8px' }}
            title="Run Full Pipeline"
          >
            {running ? (
              <><div className="loading-spinner" style={{ width: 14, height: 14, borderWidth: 2 }} /> Running...</>
            ) : (
              <><span className="material-symbols-outlined" style={{ fontSize: 16 }}>play_arrow</span> Analyze All</>
            )}
          </button>
        </div>
      </div>

      {loading ? (
        <div className="empty-state" style={{ padding: 'var(--space-xl)' }}>
          <div className="loading-spinner" />
        </div>
      ) : (
        <>
          {renderStreamingBox('bottleneck', 'Analyzing Flow...', 'flowsheet', '--tertiary')}
          
          {bottlenecks.length > 0 && !streamingText.bottleneck && (
            <div className="ai-glass-section">
              <div className="ai-section-header">
                <span className="material-symbols-outlined" style={{ fontSize: 20, color: 'var(--tertiary)' }}>warning</span>
                <h4 className="ai-section-title">Bottleneck Analysis</h4>
              </div>
              {bottlenecks.map(insight => {
                const data = insight.data;
                const aiAnalysis = data.aiAnalysis || {};
                return (
                  <div key={insight.id} style={{ marginBottom: 'var(--space-lg)' }}>
                    <p style={{ fontSize: 14, color: 'var(--on-surface)', lineHeight: '20px', marginBottom: 'var(--space-md)' }}>
                      <strong>{data.columnName}</strong>: {aiAnalysis.summary || `Column has ${data.cardCount} cards with only ${data.exitsThisWeek} exits this week.`}
                    </p>
                    
                    {aiAnalysis.recommendedActions && aiAnalysis.recommendedActions.length > 0 && (
                      <ul style={{ paddingLeft: 20, fontSize: 13, color: 'var(--on-surface-variant)', marginBottom: 'var(--space-sm)' }}>
                        {aiAnalysis.recommendedActions.map((action, idx) => (
                          <li key={idx} style={{ marginBottom: 4 }}>{action}</li>
                        ))}
                      </ul>
                    )}

                    <div style={{ display: 'flex', gap: 'var(--space-xs)', marginTop: 'var(--space-sm)' }}>
                      <button className="btn btn-primary btn-sm" onClick={() => handleAction(insight.id, 'accepted')}>
                        <span className="material-symbols-outlined" style={{ fontSize: 14 }}>check</span> Resolve
                      </button>
                      <button className="btn btn-ghost btn-sm" onClick={() => handleAction(insight.id, 'dismissed')}>Dismiss</button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {renderStreamingBox('sprint_risk', 'Assessing Sprint Risk...', 'speed', '--error')}

          {sprintRisks.length > 0 && !streamingText.sprint_risk && (
            <div className="ai-glass-section">
              <div className="ai-section-header">
                <span className="material-symbols-outlined" style={{ fontSize: 20, color: 'var(--error)' }}>error</span>
                <h4 className="ai-section-title">Sprint Risk Summary</h4>
              </div>
              {sprintRisks.map(insight => {
                const data = insight.data;
                const aiAnalysis = data.aiAnalysis || {};
                const badgeColor = data.risk === 'CRITICAL' ? 'var(--error)' : data.risk === 'HIGH' ? 'var(--tertiary)' : 'var(--primary)';
                
                return (
                  <div key={insight.id}>
                    <div className="ai-risk-banner" style={{ borderLeftColor: badgeColor }}>
                      <span className="material-symbols-outlined" style={{ color: badgeColor, marginTop: 2, fontSize: 18 }}>
                        {data.risk === 'ON_TRACK' ? 'check_circle' : 'flag'}
                      </span>
                      <div>
                        <div className="ai-risk-banner-title" style={{ color: badgeColor }}>
                          {data.risk?.replace('_', ' ')} — {data.remainingCards || '?'} tasks remaining
                        </div>
                        <div className="ai-risk-banner-subtitle">
                          {aiAnalysis.summary || data.message}
                        </div>
                      </div>
                    </div>

                    {aiAnalysis.recommendation && (
                      <div style={{ fontSize: 13, color: 'var(--on-surface-variant)', marginTop: 'var(--space-sm)', padding: 'var(--space-sm)', background: 'var(--surface-container)', borderRadius: 'var(--radius)' }}>
                        <strong>Recommendation:</strong> {aiAnalysis.recommendation}
                      </div>
                    )}

                    <div style={{ display: 'flex', gap: 'var(--space-md)', fontSize: 13, color: 'var(--secondary)', marginTop: 'var(--space-sm)', padding: '0 var(--space-xs)' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontFamily: 'monospace' }}>
                        <span className="material-symbols-outlined" style={{ fontSize: 16 }}>trending_up</span>
                        {data.velocityPerDay}/day
                      </span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontFamily: 'monospace' }}>
                        <span className="material-symbols-outlined" style={{ fontSize: 16 }}>timer</span>
                        {data.daysRemaining}d left
                      </span>
                      {data.totalComplexityRemaining > 0 && (
                        <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontFamily: 'monospace' }}>
                          <span className="material-symbols-outlined" style={{ fontSize: 16 }}>psychology</span>
                          {data.totalComplexityRemaining} pts
                        </span>
                      )}
                    </div>

                    <div style={{ display: 'flex', gap: 'var(--space-xs)', marginTop: 'var(--space-sm)' }}>
                      <button className="btn btn-ghost btn-sm" onClick={() => handleAction(insight.id, 'dismissed')}>Acknowledge</button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {renderStreamingBox('auto_assign', 'Suggesting Assignees...', 'smart_toy', '--primary')}

          {autoAssigns.length > 0 && !streamingText.auto_assign && (
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
                AI suggests reassigning tasks to available team members with matching skills.
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
                            </div>
                          </div>
                        )}
                        
                        {data.reason && (
                           <div style={{ fontSize: 12, color: 'var(--on-surface-variant)', marginBottom: 'var(--space-sm)', fontStyle: 'italic' }}>
                             "{data.reason}"
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

          {insights.length === 0 && !running && (
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
