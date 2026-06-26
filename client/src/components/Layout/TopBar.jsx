import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';

export default function TopBar({ activeView, onViewChange }) {
  const { user } = useAuth();
  const { connected } = useSocket();

  const viewTabs = [
    { id: 'board', label: 'Kanban' },
    { id: 'team', label: 'Calendar' },
    { id: 'insights', label: 'Gantt' },
    { id: 'digest', label: 'List' },
    { id: 'github', label: 'Timeline' },
  ];

  return (
    <header className="top-bar">
      <div className="top-bar-left">
        <h2 className="top-bar-title">Alfaleus Apps</h2>
        <div className="top-bar-tabs">
          {viewTabs.map(tab => (
            <button
              key={tab.id}
              className={`top-bar-tab ${activeView === tab.id ? 'active' : ''}`}
              onClick={() => onViewChange(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="top-bar-right">
        <div className="top-bar-search">
          <span className="material-symbols-outlined top-bar-search-icon">search</span>
          <input
            className="top-bar-search-input"
            type="text"
            placeholder="Search..."
          />
        </div>

        <div className="top-bar-actions">
          <button className="top-bar-icon-btn" title="Notifications">
            <span className="material-symbols-outlined" style={{ fontSize: 20 }}>notifications</span>
          </button>
          <button className="top-bar-icon-btn" title="Messages">
            <span className="material-symbols-outlined" style={{ fontSize: 20 }}>chat_bubble</span>
          </button>

          <div className="top-bar-user">
            <div className="top-bar-user-avatar">
              {user?.name?.charAt(0).toUpperCase() || 'U'}
            </div>
            <span className="top-bar-user-name">{user?.name || 'User'}</span>
            <span className="material-symbols-outlined" style={{ fontSize: 16, color: 'var(--on-surface-variant)' }}>expand_more</span>
          </div>
        </div>
      </div>
    </header>
  );
}
