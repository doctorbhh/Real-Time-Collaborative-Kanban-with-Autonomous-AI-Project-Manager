import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';

export default function Sidebar({ activeView, onViewChange, boards, activeBoard, onBoardChange, pendingInsights, onOpenProfile, onDeleteBoard, collapsed, onToggle }) {
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
      <div className="sidebar-brand" style={{ position: 'relative' }}>
        <div className="sidebar-brand-icon">
          <span className="material-symbols-outlined" style={{ fontSize: 20 }}>diamond</span>
        </div>
        <div>
          <div className="sidebar-brand-text">Alfaleus</div>
        </div>
        <button onClick={onToggle} style={{ 
          position: 'absolute', right: -28, top: '50%', transform: 'translateY(-50%)', 
          background: 'var(--surface-container-lowest)', border: '1px solid var(--outline-variant)', 
          borderRadius: '50%', width: 24, height: 24, display: 'flex', alignItems: 'center', 
          justifyContent: 'center', cursor: 'pointer', zIndex: 10, color: 'var(--on-surface-variant)'
        }}>
          <span className="material-symbols-outlined" style={{ fontSize: 16 }}>{collapsed ? 'chevron_right' : 'chevron_left'}</span>
        </button>
      </div>

      <button className="sidebar-new-project-btn" onClick={() => onViewChange('new-board')} title={collapsed ? "New Project" : ""}>
        <span className="material-symbols-outlined" style={{ fontSize: 18 }}>add</span>
        <span className="sidebar-item-label">New Project</span>
      </button>

      <nav className="sidebar-nav">
        {navItems.map(item => (
          <button
            key={item.id}
            className={`sidebar-nav-item ${activeView === item.id ? 'active' : ''}`}
            onClick={() => onViewChange(item.id)}
            title={collapsed ? item.label : ""}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 20 }}>{item.icon}</span>
            <span className="sidebar-item-label">{item.label}</span>
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
                <span className="sidebar-item-label" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {board.name}
                </span>
              </button>
            ))}
          </div>
        </>
      )}

      <div className="sidebar-footer">
        <button className="sidebar-nav-item" onClick={onOpenProfile} title={collapsed ? "Settings" : ""}>
          <span className="material-symbols-outlined" style={{ fontSize: 20 }}>settings</span>
          <span className="sidebar-item-label">Settings</span>
        </button>
        <button className="sidebar-nav-item" onClick={() => {}} title={collapsed ? "Help" : ""}>
          <span className="material-symbols-outlined" style={{ fontSize: 20 }}>help</span>
          <span className="sidebar-item-label">Help</span>
        </button>
        <button className="sidebar-nav-item" onClick={logout} title={collapsed ? "Logout" : ""}>
          <span className="material-symbols-outlined" style={{ fontSize: 20 }}>logout</span>
          <span className="sidebar-item-label">Logout</span>
        </button>
      </div>
    </aside>
  );
}
