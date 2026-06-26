import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';

export default function Sidebar({ activeView, onViewChange, boards, activeBoard, onBoardChange, pendingInsights, onOpenProfile, onDeleteBoard }) {
  const { user, logout } = useAuth();
  const { connected } = useSocket();

  const navItems = [
    { id: 'board', icon: 'dashboard', label: 'Board' },
    { id: 'team', icon: 'group', label: 'Team' },
    { id: 'insights', icon: 'lightbulb', label: 'Insights', badge: pendingInsights },
    { id: 'digest', icon: 'assessment', label: 'Reports' },
    { id: 'github', icon: 'integration_instructions', label: 'GitHub Import' },
  ];

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <div className="sidebar-brand-icon">
          <span className="material-symbols-outlined" style={{ fontSize: 20 }}>diamond</span>
        </div>
        <div>
          <div className="sidebar-brand-text">Alfaleus</div>
        </div>
      </div>

      <button className="sidebar-new-project-btn" onClick={() => onViewChange('new-board')}>
        <span className="material-symbols-outlined" style={{ fontSize: 18 }}>add</span>
        <span>New Project</span>
      </button>

      <nav className="sidebar-nav">
        {navItems.map(item => (
          <button
            key={item.id}
            className={`sidebar-nav-item ${activeView === item.id ? 'active' : ''}`}
            onClick={() => onViewChange(item.id)}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 20 }}>{item.icon}</span>
            <span>{item.label}</span>
            {item.badge > 0 && <span className="sidebar-nav-badge">{item.badge}</span>}
          </button>
        ))}
      </nav>

      {boards.length > 0 && (
        <>
          <div className="sidebar-section-title">Boards</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginBottom: 'auto' }}>
            {boards.map(board => (
              <button
                key={board.id}
                className={`sidebar-nav-item ${activeBoard?.id === board.id ? 'active' : ''}`}
                onClick={() => onBoardChange(board)}
              >
                <span style={{
                  width: 20, height: 20, borderRadius: 'var(--radius-sm)',
                  background: 'var(--primary-fixed)', display: 'flex', alignItems: 'center',
                  justifyContent: 'center', fontSize: 10, fontWeight: 700, color: 'var(--primary)',
                }}>
                  {board.name.charAt(0).toUpperCase()}
                </span>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {board.name}
                </span>
              </button>
            ))}
          </div>
        </>
      )}

      <div className="sidebar-footer">
        <button className="sidebar-nav-item" onClick={onOpenProfile}>
          <span className="material-symbols-outlined" style={{ fontSize: 20 }}>settings</span>
          <span>Settings</span>
        </button>
        <button className="sidebar-nav-item" onClick={() => {}}>
          <span className="material-symbols-outlined" style={{ fontSize: 20 }}>help</span>
          <span>Help</span>
        </button>
        <button className="sidebar-nav-item" onClick={logout}>
          <span className="material-symbols-outlined" style={{ fontSize: 20 }}>logout</span>
          <span>Logout</span>
        </button>
      </div>
    </aside>
  );
}
