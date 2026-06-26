import { useState, useEffect } from 'react';
import { UsersIcon } from "@animateicons/react/lucide";
import api from '../../utils/api';

export default function TeamView({ boardId }) {
  const [stats, setStats] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!boardId) return;
    loadStats();
  }, [boardId]);

  const loadStats = async () => {
    try {
      const data = await api.getTeamStats(boardId);
      setStats(data.stats);
    } catch (err) {
      console.error('Failed to load team stats:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="empty-state"><div className="loading-spinner" /></div>;
  }

  if (stats.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon"><UsersIcon size="32" /></div>
        <div className="empty-state-text">No team stats available. Add members to this board.</div>
      </div>
    );
  }

  return (
    <div className="team-view">
      <h2 className="headline-md" style={{ marginBottom: 24, display: 'flex', alignItems: 'center', gap: 8 }}>
        <UsersIcon size="24" /> Team Overview
      </h2>
      <div className="team-grid">
        {stats.map(member => (
          <div key={member.user.id} className="team-member-card">
            <div className="team-member-header">
              <div className="team-member-avatar">
                {member.user.name?.charAt(0).toUpperCase()}
              </div>
              <div>
                <div className="team-member-name">{member.user.name}</div>
                <div className="team-member-role">{member.role}</div>
              </div>
            </div>

            <div className="team-member-stats">
              <div className="team-stat">
                <div className="team-stat-value">{member.inProgressCount}</div>
                <div className="team-stat-label">In Progress</div>
              </div>
              <div className="team-stat">
                <div className="team-stat-value">{member.completedCount}</div>
                <div className="team-stat-label">Completed</div>
              </div>
              <div className="team-stat">
                <div className="team-stat-value">{member.completionRate}%</div>
                <div className="team-stat-label">Completion</div>
              </div>
              <div className="team-stat">
                <div className="team-stat-value">{member.recentActivityCount}</div>
                <div className="team-stat-label">Actions (7d)</div>
              </div>
            </div>

            {member.topLabels.length > 0 && (
              <div className="team-member-labels">
                <div className="label-md" style={{ width: '100%', marginTop: 8, marginBottom: 4, color: 'var(--outline)' }}>
                  Specialisation
                </div>
                {member.topLabels.map(lbl => (
                  <span key={lbl.name} className="chip chip-primary">
                    {lbl.name} ({lbl.count})
                  </span>
                ))}
              </div>
            )}

            <div style={{ marginTop: 12 }}>
              <div className="progress-bar">
                <div
                  className={`progress-bar-fill ${member.completionRate > 70 ? 'success' : member.completionRate > 40 ? 'warning' : 'danger'}`}
                  style={{ width: `${member.completionRate}%` }}
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
