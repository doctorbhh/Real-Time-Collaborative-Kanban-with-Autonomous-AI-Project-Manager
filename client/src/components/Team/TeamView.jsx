import { useState, useEffect } from 'react';
import { UsersIcon, UserPlusIcon, Trash2Icon } from "@animateicons/react/lucide";
import api from '../../utils/api';
import { useToast } from '../../context/ToastContext';
import ConfirmModal from '../common/ConfirmModal';

export default function TeamView({ boardId }) {
  const [stats, setStats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newMemberEmail, setNewMemberEmail] = useState('');
  const [addingMember, setAddingMember] = useState(false);
  const [memberToRemove, setMemberToRemove] = useState(null);
  const { addToast } = useToast();

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

  const handleAddMember = async (e) => {
    e.preventDefault();
    if (!newMemberEmail.trim()) return;
    setAddingMember(true);
    try {
      await api.addMember(boardId, { email: newMemberEmail.trim() });
      addToast('Member added successfully', 'success');
      setNewMemberEmail('');
      loadStats();
    } catch (err) {
      addToast(err.error || 'Failed to add member', 'error');
    } finally {
      setAddingMember(false);
    }
  };

  const handleRemoveMember = async (userId, memberRole) => {
    if (memberRole === 'owner') {
      addToast('Cannot remove the board owner', 'error');
      return;
    }
    setMemberToRemove({ userId, role: memberRole });
  };

  const executeRemoveMember = async () => {
    if (!memberToRemove) return;
    try {
      await api.removeMember(boardId, memberToRemove.userId);
      addToast('Member removed successfully', 'success');
      loadStats();
    } catch (err) {
      addToast(err.error || 'Failed to remove member', 'error');
    } finally {
      setMemberToRemove(null);
    }
  };

  if (loading) {
    return <div className="empty-state"><div className="loading-spinner" /></div>;
  }

  return (
    <div className="team-view">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <h2 className="headline-md" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <UsersIcon size="24" /> Team Overview
        </h2>
        <form onSubmit={handleAddMember} style={{ display: 'flex', gap: 8 }}>
          <input
            className="input"
            type="email"
            placeholder="User's email..."
            value={newMemberEmail}
            onChange={e => setNewMemberEmail(e.target.value)}
            style={{ width: 220, padding: '8px 12px', border: '1px solid var(--outline-variant)' }}
            disabled={addingMember}
            required
          />
          <button type="submit" className="btn btn-primary" disabled={addingMember || !newMemberEmail.trim()}>
            <UserPlusIcon size="18" style={{ marginRight: 4 }} />
            Add Member
          </button>
        </form>
      </div>

      {stats.length === 0 ? (
        <div className="empty-state" style={{ marginTop: 40 }}>
          <div className="empty-state-icon"><UsersIcon size="32" /></div>
          <div className="empty-state-text">No team stats available. Add members to this board.</div>
        </div>
      ) : (
      <div className="team-grid">
        {stats.map(member => (
          <div key={member.user.id} className="team-member-card">
            <div className="team-member-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={{ display: 'flex', gap: 12 }}>
                <div className="team-member-avatar">
                  {member.user.name?.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div className="team-member-name">{member.user.name}</div>
                  <div className="team-member-role">{member.role}</div>
                </div>
              </div>
              {member.role !== 'owner' && (
                <button 
                  className="btn btn-ghost btn-sm btn-icon" 
                  onClick={() => handleRemoveMember(member.user.id, member.role)}
                  style={{ color: 'var(--danger)', padding: 4 }}
                  title="Remove Member"
                >
                  <Trash2Icon size="16" />
                </button>
              )}
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
      )}

      {memberToRemove && (
        <ConfirmModal
          title="Remove Member"
          message="Are you sure you want to remove this member from the board? They will lose access to all tasks and board data."
          confirmText="Remove Member"
          onConfirm={executeRemoveMember}
          onCancel={() => setMemberToRemove(null)}
        />
      )}
    </div>
  );
}
