import { useState, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';
import { 
  DashboardIcon, UsersIcon, SparklesIcon, ChartBarIcon, GithubIcon, 
  SettingsIcon, InfoIcon, LogoutIcon, PlusIcon, MenuIcon, ChevronLeftIcon,
  Trash2Icon
} from "@animateicons/react/lucide";

const HoverNavItem = ({ id, label, badge, activeView, onClick, collapsed, IconComponent }) => {
  const iconRef = useRef(null);
  
  return (
    <button
      className={`sidebar-nav-item ${activeView === id ? 'active' : ''}`}
      onClick={onClick}
      title={collapsed ? label : ""}
      onMouseEnter={() => iconRef.current?.startAnimation?.()}
      onMouseLeave={() => iconRef.current?.stopAnimation?.()}
    >
      <IconComponent ref={iconRef} size="20" />
      <span className="sidebar-item-label">{label}</span>
      {badge > 0 && <span className="sidebar-nav-badge">{badge}</span>}
    </button>
  );
};

const HoverActionItem = ({ label, onClick, collapsed, IconComponent, danger = false }) => {
  const iconRef = useRef(null);
  
  return (
    <button
      className="sidebar-nav-item"
      onClick={onClick}
      title={collapsed ? label : ""}
      onMouseEnter={() => iconRef.current?.startAnimation?.()}
      onMouseLeave={() => iconRef.current?.stopAnimation?.()}
      style={danger ? { color: 'var(--danger)' } : {}}
    >
      <IconComponent ref={iconRef} size="20" />
      <span className="sidebar-item-label">{label}</span>
    </button>
  );
};

export default function Sidebar({ activeView, onViewChange, boards, activeBoard, onBoardChange, pendingInsights, onOpenProfile, onDeleteBoard, collapsed, onToggle }) {
  const { user, logout } = useAuth();
  const { connected } = useSocket();

  const navItems = [
    { id: 'board', icon: DashboardIcon, label: 'Board' },
    { id: 'team', icon: UsersIcon, label: 'Team' },
    { id: 'insights', icon: SparklesIcon, label: 'Insights', badge: pendingInsights },
    { id: 'digest', icon: ChartBarIcon, label: 'Reports' },
    { id: 'github', icon: GithubIcon, label: 'GitHub Import' },
  ];

  return (
    <aside className="sidebar">
      <div className="sidebar-brand" style={{ position: 'relative' }}>
        <div className="sidebar-brand-icon">
          <SparklesIcon size="20" />
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
          {collapsed ? <MenuIcon size="16" /> : <ChevronLeftIcon size="16" />}
        </button>
      </div>

      <button 
        className="sidebar-new-project-btn" 
        onClick={() => onViewChange('new-board')} 
        title={collapsed ? "New Project" : ""}
      >
        <PlusIcon size="18" />
        <span className="sidebar-item-label">New Project</span>
      </button>

      <nav className="sidebar-nav">
        {navItems.map(item => (
          <HoverNavItem
            key={item.id}
            id={item.id}
            label={item.label}
            badge={item.badge}
            activeView={activeView}
            onClick={() => onViewChange(item.id)}
            collapsed={collapsed}
            IconComponent={item.icon}
          />
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
                <span className="sidebar-item-label" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                  {board.name}
                </span>
                {!collapsed && (
                  <span
                    className="material-symbols-outlined"
                    style={{ fontSize: 16, color: 'var(--on-surface-variant)', opacity: activeBoard?.id === board.id ? 1 : 0.5, marginLeft: 'auto' }}
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteBoard(board.id);
                    }}
                    title="Delete Board"
                  >
                    <Trash2Icon size="16" />
                  </span>
                )}
              </button>
            ))}
          </div>
        </>
      )}

      <div className="sidebar-footer">
        <HoverActionItem
          label="Settings"
          onClick={onOpenProfile}
          collapsed={collapsed}
          IconComponent={SettingsIcon}
        />
        <HoverActionItem
          label="Help"
          onClick={() => {}}
          collapsed={collapsed}
          IconComponent={InfoIcon}
        />
        <HoverActionItem
          label="Logout"
          onClick={logout}
          collapsed={collapsed}
          IconComponent={LogoutIcon}
        />
      </div>
    </aside>
  );
}
