import { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { SocketProvider } from './context/SocketContext';
import { ToastProvider, useToast } from './context/ToastContext';
import AuthPage from './components/Auth/AuthPage';
import Sidebar from './components/Layout/Sidebar';
import TopBar from './components/Layout/TopBar';
import BoardView from './components/Board/BoardView';
import InsightsPanel from './components/AI/InsightsPanel';
import DigestView from './components/AI/DigestView';
import TeamView from './components/Team/TeamView';
import GitHubImport from './components/GitHub/GitHubImport';
import ProfileModal from './components/Auth/ProfileModal';
import api from './utils/api';
import './index.css';

function AppContent() {
  const { user, loading } = useAuth();
  const { addToast } = useToast();

  const [boards, setBoards] = useState([]);
  const [activeBoard, setActiveBoard] = useState(null);
  const [activeView, setActiveView] = useState('board');
  const [boardLoading, setBoardLoading] = useState(false);

  const [showNewBoard, setShowNewBoard] = useState(false);
  const [newBoardName, setNewBoardName] = useState('');
  const [newBoardSprint, setNewBoardSprint] = useState('');

  const [showProfileModal, setShowProfileModal] = useState(false);

  useEffect(() => {
    if (user) loadBoards();
  }, [user]);

  const loadBoards = async () => {
    try {
      const data = await api.getBoards();
      setBoards(data.boards);
      if (data.boards.length > 0 && !activeBoard) {
        loadBoard(data.boards[0]);
      }
    } catch (err) {
      console.error('Failed to load boards:', err);
    }
  };

  const loadBoard = async (board) => {
    setBoardLoading(true);
    try {
      const data = await api.getBoard(board.id);
      setActiveBoard(data.board);
      setActiveView('board');
    } catch (err) {
      addToast('Failed to load board', 'error');
    } finally {
      setBoardLoading(false);
    }
  };

  const handleCreateBoard = async (e) => {
    e.preventDefault();
    if (!newBoardName.trim()) return;
    try {
      const data = await api.createBoard({
        name: newBoardName.trim(),
        sprintEndDate: newBoardSprint || null,
      });
      setBoards(prev => [data.board, ...prev]);
      setActiveBoard(data.board);
      setActiveView('board');
      setShowNewBoard(false);
      setNewBoardName('');
      setNewBoardSprint('');
      addToast('Board created!', 'success');
    } catch (err) {
      addToast('Failed to create board', 'error');
    }
  };

  const handleDeleteBoard = async (boardId) => {
    if (!window.confirm('Are you sure you want to delete this board? This action cannot be undone.')) return;
    try {
      await api.deleteBoard(boardId);
      setBoards(prev => prev.filter(b => b.id !== boardId));
      if (activeBoard?.id === boardId) {
        setActiveBoard(null);
        setActiveView('new-board');
        setShowNewBoard(true);
      }
      addToast('Board deleted', 'success');
    } catch (err) {
      addToast('Failed to delete board', 'error');
    }
  };

  const handleViewChange = (view) => {
    if (view === 'new-board') {
      setShowNewBoard(true);
      setActiveView('new-board');
    } else {
      setShowNewBoard(false);
      setActiveView(view);
    }
  };

  if (loading) {
    return (
      <div className="auth-page">
        <div className="loading-spinner" style={{ width: 40, height: 40 }} />
      </div>
    );
  }

  if (!user) {
    return <AuthPage />;
  }

  const pendingInsightCount = 0; // TODO: track via socket

  const renderMainContent = () => {
    if (showNewBoard) {
      return (
        <>
          <div className="main-header">
            <div className="main-header-left"><h1>Create New Board</h1></div>
          </div>
          <div className="main-body">
            <div style={{ maxWidth: 480 }}>
              <form onSubmit={handleCreateBoard} className="auth-form">
                <div className="input-group">
                  <label className="input-label">Board Name</label>
                  <input
                    className="input"
                    value={newBoardName}
                    onChange={e => setNewBoardName(e.target.value)}
                    placeholder="My Project Board"
                    required
                    autoFocus
                    style={{ border: '1px solid var(--outline-variant)' }}
                  />
                </div>
                <div className="input-group">
                  <label className="input-label">Sprint End Date (optional)</label>
                  <input
                    className="input"
                    type="date"
                    value={newBoardSprint}
                    onChange={e => setNewBoardSprint(e.target.value)}
                    style={{ border: '1px solid var(--outline-variant)' }}
                  />
                </div>
                <div style={{ display: 'flex', gap: 12 }}>
                  <button className="btn btn-primary btn-lg" type="submit">Create Board</button>
                  <button className="btn btn-secondary btn-lg" type="button" onClick={() => { setShowNewBoard(false); setActiveView('board'); }}>
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        </>
      );
    }

    if (boardLoading) {
      return (
        <div className="empty-state" style={{ height: '100%' }}>
          <div className="loading-spinner" style={{ width: 32, height: 32 }} />
          <div className="empty-state-text" style={{ marginTop: 16 }}>Loading board...</div>
        </div>
      );
    }

    switch (activeView) {
      case 'board':
        return <BoardView board={activeBoard} setBoard={setActiveBoard} />;
      case 'team':
        return (
          <>
            <div className="main-header"><div className="main-header-left"><h1>{activeBoard?.name} — Team</h1></div></div>
            <div className="main-body"><TeamView boardId={activeBoard?.id} /></div>
          </>
        );
      case 'insights':
        return (
          <>
            <div className="main-header"><div className="main-header-left"><h1>{activeBoard?.name} — AI Insights</h1></div></div>
            <div className="main-body"><InsightsPanel boardId={activeBoard?.id} /></div>
          </>
        );
      case 'digest':
        return (
          <>
            <div className="main-header"><div className="main-header-left"><h1>{activeBoard?.name} — Digest</h1></div></div>
            <div className="main-body"><DigestView boardId={activeBoard?.id} /></div>
          </>
        );
      case 'github':
        return (
          <>
            <div className="main-header"><div className="main-header-left"><h1>{activeBoard?.name} — GitHub Import</h1></div></div>
            <div className="main-body"><GitHubImport boardId={activeBoard?.id} columns={activeBoard?.columns} /></div>
          </>
        );
      default:
        return <BoardView board={activeBoard} setBoard={setActiveBoard} />;
    }
  };

  return (
    <div className="app-layout mesh-bg">
      <Sidebar
        activeView={activeView}
        onViewChange={handleViewChange}
        boards={boards}
        activeBoard={activeBoard}
        onBoardChange={loadBoard}
        pendingInsights={pendingInsightCount}
        onOpenProfile={() => setShowProfileModal(true)}
        onDeleteBoard={handleDeleteBoard}
      />
      <TopBar activeView={activeView} onViewChange={handleViewChange} />
      <main className="main-content dot-pattern">
        {renderMainContent()}
      </main>
      {showProfileModal && (
        <ProfileModal onClose={() => setShowProfileModal(false)} />
      )}
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <SocketProvider>
          <AppContent />
        </SocketProvider>
      </ToastProvider>
    </AuthProvider>
  );
}
