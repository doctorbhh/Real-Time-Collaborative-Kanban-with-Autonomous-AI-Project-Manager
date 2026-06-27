import { useState, useEffect, useCallback, useRef } from 'react';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
} from '@dnd-kit/core';
import { arrayMove } from '@dnd-kit/sortable';
import Column from './Column';
import { SortableContext, horizontalListSortingStrategy } from '@dnd-kit/sortable';
import KanbanCard from './KanbanCard';
import CursorOverlay from './CursorOverlay';
import CardDetail from './CardDetail';
import CustomSelect from './CustomSelect';
import InsightsPanel from '../AI/InsightsPanel';
import api from '../../utils/api';
import { useSocket } from '../../context/SocketContext';
import { useToast } from '../../context/ToastContext';

export default function BoardView({ board, setBoard, searchQuery = '' }) {
  const [selectedCard, setSelectedCard] = useState(null);
  const [activeCard, setActiveCard] = useState(null);
  const [activeColumn, setActiveColumn] = useState(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [columnPositions, setColumnPositions] = useState({});
  const [showFilter, setShowFilter] = useState(false);
  const [filterAssignee, setFilterAssignee] = useState('');
  const [filterLabel, setFilterLabel] = useState('');
  const lastPanPosition = useRef({ x: 0, y: 0 });
  const canvasRef = useRef(null);
  const { on, off, joinBoard, leaveBoard, onlineUsers, emit } = useSocket();
  const { addToast } = useToast();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  useEffect(() => {
    if (board?.columns) {
      setColumnPositions(prev => {
        const newPos = { ...prev };
        board.columns.forEach((col, index) => {
          if (!newPos[col.id]) {
            newPos[col.id] = { x: index * 360, y: 0 };
          }
        });
        return newPos;
      });
    }
  }, [board?.columns]);

  const handlePointerDown = (e) => {
    if (e.button !== 0 && e.button !== 1) return; 
    if (e.target.closest('.kanban-card') || e.target.closest('.board-column-header')) return;
    
    setIsPanning(true);
    lastPanPosition.current = { x: e.clientX, y: e.clientY };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e) => {
    if (!isPanning) return;
    const dx = e.clientX - lastPanPosition.current.x;
    const dy = e.clientY - lastPanPosition.current.y;
    setPan(p => ({ x: p.x + dx, y: p.y + dy }));
    lastPanPosition.current = { x: e.clientX, y: e.clientY };
  };

  const handlePointerUp = (e) => {
    if (!isPanning) return;
    setIsPanning(false);
    e.currentTarget.releasePointerCapture(e.pointerId);
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleNativeWheel = (e) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const zoomDelta = e.deltaY > 0 ? -0.1 : 0.1;
        setZoom(z => Math.max(0.2, Math.min(3, z + zoomDelta)));
      } else {
        const isScrollingColumn = e.target.closest('.board-column-body');
        if (!isScrollingColumn) {
          e.preventDefault();
          setPan(p => ({ x: p.x - e.deltaX, y: p.y - e.deltaY }));
        }
      }
    };

    canvas.addEventListener('wheel', handleNativeWheel, { passive: false });

    return () => {
      canvas.removeEventListener('wheel', handleNativeWheel);
    };
  }, []);

  const lastCursorEmit = useRef(0);
  useEffect(() => {
    if (!board?.id || !emit) return;
    
    const handleGlobalMouseMove = (e) => {
      const now = Date.now();
      if (now - lastCursorEmit.current > 50) {
        lastCursorEmit.current = now;
        emit('cursor:move', { x: e.clientX, y: e.clientY, boardId: board.id });
      }
    };
    
    window.addEventListener('mousemove', handleGlobalMouseMove);
    return () => window.removeEventListener('mousemove', handleGlobalMouseMove);
  }, [board?.id, emit]);

  useEffect(() => {
    if (!board?.id) return;

    // Fetch the latest board data immediately on mount to ensure we have fresh data
    // (e.g., after returning from the GitHub Import view where background updates happened)
    api.getBoard(board.id)
      .then(data => setBoard(data.board))
      .catch(err => console.error('Failed to fetch initial board state:', err));

    const handleCardCreated = ({ card }) => {
      setBoard(prev => {
        if (!prev) return prev;
        const columns = prev.columns.map(col => {
          if (col.id === card.columnId) {
            const exists = col.cards.some(c => c.id === card.id);
            if (exists) return col;
            return { ...col, cards: [...col.cards, card] };
          }
          return col;
        });
        return { ...prev, columns };
      });
      addToast('New card added', 'info');
    };

    const handleCardMoved = ({ cardId, fromColumnId, toColumnId, newPosition }) => {
      setBoard(prev => {
        if (!prev) return prev;
        let movedCard = null;
        const columns = prev.columns.map(col => {
          if (col.id === fromColumnId) {
            const card = col.cards.find(c => c.id === cardId);
            if (card) movedCard = { ...card, columnId: toColumnId, position: newPosition };
            return { ...col, cards: col.cards.filter(c => c.id !== cardId) };
          }
          return col;
        }).map(col => {
          if (col.id === toColumnId && movedCard) {
            const cards = [...col.cards.filter(c => c.id !== cardId)];
            cards.splice(newPosition, 0, movedCard);
            return { ...col, cards };
          }
          return col;
        });
        return { ...prev, columns };
      });
    };

    const handleCardUpdated = ({ card }) => {
      setBoard(prev => {
        if (!prev) return prev;
        const columns = prev.columns.map(col => ({
          ...col,
          cards: col.cards.map(c => c.id === card.id ? { ...c, ...card } : c),
        }));
        return { ...prev, columns };
      });
    };

    const handleCardDeleted = ({ cardId }) => {
      setBoard(prev => {
        if (!prev) return prev;
        const columns = prev.columns.map(col => ({
          ...col,
          cards: col.cards.filter(c => c.id !== cardId),
        }));
        return { ...prev, columns };
      });
    };

    const handleColumnCreated = ({ column }) => {
      setBoard(prev => {
        if (!prev) return prev;
        return { ...prev, columns: [...prev.columns, { ...column, cards: column.cards || [] }] };
      });
    };

    const handleBoardRefresh = async () => {
      try {
        const data = await api.getBoard(board.id);
        setBoard(data.board);
        addToast('Board refreshed', 'info');
      } catch (err) {
        console.error('Refresh failed:', err);
      }
    };

    on('card:created', handleCardCreated);
    on('card:moved', handleCardMoved);
    on('card:updated', handleCardUpdated);
    on('card:deleted', handleCardDeleted);
    on('column:created', handleColumnCreated);
    on('board:refresh', handleBoardRefresh);

    return () => {
      off('card:created', handleCardCreated);
      off('card:moved', handleCardMoved);
      off('card:updated', handleCardUpdated);
      off('card:deleted', handleCardDeleted);
      off('column:created', handleColumnCreated);
      off('board:refresh', handleBoardRefresh);
    };
  }, [board?.id, on, off, setBoard, addToast]);

  const handleCardCreate = async (columnId, title) => {
    try {
      const data = await api.createCard(board.id, { title, columnId });
      setBoard(prev => {
        const columns = prev.columns.map(col => {
          if (col.id === columnId) {
            const exists = col.cards.some(c => c.id === data.card.id);
            if (exists) return col;
            return { ...col, cards: [...col.cards, data.card] };
          }
          return col;
        });
        return { ...prev, columns };
      });
    } catch (err) {
      addToast('Failed to create card', 'error');
    }
  };

  const handleDragStart = (event) => {
    const { active } = event;
    const type = active.data.current?.type;
    if (type === 'card') {
      setActiveCard(active.data.current?.card);
    } else if (type === 'column') {
      setActiveColumn(active.data.current?.column);
    }
  };

  const handleDragEnd = async (event) => {
    const { active, over } = event;
    const activeType = active.data.current?.type;
    
    setActiveCard(null);
    setActiveColumn(null);

    if (!over) return;

    if (activeType === 'column') {
      const delta = event.delta;
      setColumnPositions(prev => {
        const oldPos = prev[active.id] || { x: 0, y: 0 };
        return {
          ...prev,
          [active.id]: {
            x: oldPos.x + delta.x / zoom,
            y: oldPos.y + delta.y / zoom
          }
        };
      });
      return;
    }

    const activeCard = active.data.current?.card;
    if (!activeCard) return;

    const overData = over.data.current;
    let toColumnId;
    let newPosition;

    if (overData?.type === 'column') {
      toColumnId = over.id;
      const targetCol = board.columns.find(c => c.id === toColumnId);
      newPosition = targetCol?.cards?.length || 0;
    } else if (overData?.type === 'card') {
      const overCard = overData.card;
      toColumnId = overCard.columnId;
      const targetCol = board.columns.find(c => c.id === toColumnId);
      const overIndex = targetCol?.cards?.findIndex(c => c.id === overCard.id) ?? 0;
      newPosition = overIndex;
    } else {
      toColumnId = over.id;
      const targetCol = board.columns.find(c => c.id === toColumnId);
      newPosition = targetCol?.cards?.length || 0;
    }

    const fromColumnId = activeCard.columnId;

    if (fromColumnId === toColumnId) {
      const col = board.columns.find(c => c.id === fromColumnId);
      const oldIndex = col.cards.findIndex(c => c.id === activeCard.id);
      if (oldIndex === newPosition) return;
    }

    setBoard(prev => {
      const columns = prev.columns.map(col => {
        if (col.id === fromColumnId && fromColumnId !== toColumnId) {
          return { ...col, cards: col.cards.filter(c => c.id !== activeCard.id) };
        }
        return col;
      }).map(col => {
        if (col.id === toColumnId) {
          const cards = col.cards.filter(c => c.id !== activeCard.id);
          const updatedCard = { ...activeCard, columnId: toColumnId };
          cards.splice(Math.min(newPosition, cards.length), 0, updatedCard);
          return { ...col, cards };
        }
        return col;
      });
      return { ...prev, columns };
    });

    try {
      await api.moveCard(board.id, activeCard.id, { toColumnId, newPosition });
    } catch (err) {
      addToast('Failed to move card. Refreshing...', 'error');
      const data = await api.getBoard(board.id);
      setBoard(data.board);
    }
  };

  const handleCardUpdate = (updatedCard) => {
    setBoard(prev => {
      const columns = prev.columns.map(col => ({
        ...col,
        cards: col.cards.map(c => c.id === updatedCard.id ? { ...c, ...updatedCard } : c),
      }));
      return { ...prev, columns };
    });
  };

  if (!board) {
    return (
      <div className="empty-state" style={{ height: '100%' }}>
        <div className="empty-state-icon">
          <span className="material-symbols-outlined" style={{ fontSize: 48 }}>dashboard</span>
        </div>
        <div className="empty-state-text">Select or create a board to get started</div>
      </div>
    );
  }

  const query = searchQuery?.toLowerCase() || '';
  const filteredColumns = board.columns.map(col => {
    let cards = col.cards || [];
    

    if (query) {
      cards = cards.filter(c => c.title?.toLowerCase().includes(query) || c.description?.toLowerCase().includes(query));
    }
    
  
    if (filterAssignee) {
      cards = cards.filter(c => c.assignee?.id === filterAssignee);
    }
    
    if (filterLabel) {
      cards = cards.filter(c => c.labels?.some(l => l.labelId === filterLabel || l.label?.id === filterLabel));
    }
    
    return { ...col, cards };
  });

  return (
    <>
      <div className="board-page-header">
        <div>
          <div className="breadcrumb">
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>folder</span>
            <span>Alfaleus Apps</span>
            <span className="material-symbols-outlined" style={{ fontSize: 14 }}>chevron_right</span>
            <span>{board.sprintEndDate ? `Sprint ${new Date(board.sprintEndDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}` : 'Active'}</span>
          </div>
          <h2 className="board-page-title">{board.name}</h2>
        </div>
        <div style={{ display: 'flex', gap: 'var(--space-sm)', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: 4, alignItems: 'center', background: 'var(--surface-container-high)', padding: '4px', borderRadius: 'var(--radius-full)', marginRight: 'var(--space-sm)' }}>
            <button className="btn-icon-sm" onClick={() => setZoom(z => Math.max(0.5, z - 0.1))} title="Zoom out">
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>zoom_out</span>
            </button>
            <span style={{ fontSize: 12, fontWeight: 600, width: 44, textAlign: 'center', color: 'var(--on-surface)' }}>{Math.round(zoom * 100)}%</span>
            <button className="btn-icon-sm" onClick={() => setZoom(z => Math.min(1.5, z + 0.1))} title="Zoom in">
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>zoom_in</span>
            </button>
          </div>
          
          {onlineUsers.length > 0 && (
            <div className="presence-indicator">
              {onlineUsers.slice(0, 5).map((u, i) => (
                <div key={u.userId || i} className="presence-avatar" title={u.name}>
                  {u.avatar ? (
                    <img src={u.avatar} alt={u.name} style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
                  ) : (
                    u.name?.charAt(0).toUpperCase()
                  )}
                </div>
              ))}
              {onlineUsers.length > 5 && (
                <div className="presence-avatar" style={{ background: 'var(--outline)', fontSize: 9 }}>
                  +{onlineUsers.length - 5}
                </div>
              )}
            </div>
          )}
          <div style={{ position: 'relative' }}>
            <button className="btn-filter" onClick={() => setShowFilter(!showFilter)}>
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>filter_list</span>
              Filter
              {(filterAssignee || filterLabel) && (
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--primary)', position: 'absolute', top: -2, right: -2 }} />
              )}
            </button>
            {showFilter && (
              <div className="dropdown-menu">
                <h4 style={{ fontSize: 13, fontWeight: 600, color: 'var(--on-surface)', marginBottom: 12 }}>Filter Cards</h4>
                
                <div style={{ marginBottom: 16 }}>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--on-surface-variant)', marginBottom: 4 }}>Assignee</label>
                  <CustomSelect
                    value={filterAssignee}
                    onChange={setFilterAssignee}
                    options={[
                      { value: '', label: 'Anyone' },
                      ...(board.members?.map(m => ({ value: m.user.id, label: m.user.name })) || [])
                    ]}
                    placeholder="Anyone"
                  />
                </div>

                <div style={{ marginBottom: 16 }}>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--on-surface-variant)', marginBottom: 4 }}>Label</label>
                  <CustomSelect
                    value={filterLabel}
                    onChange={setFilterLabel}
                    options={[
                      { value: '', label: 'Any Label' },
                      ...(board.labels?.map(l => ({ value: l.id, label: l.name, color: l.color })) || [])
                    ]}
                    placeholder="Any Label"
                  />
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <button className="btn btn-ghost btn-sm" onClick={() => { setFilterAssignee(''); setFilterLabel(''); }}>Clear Filters</button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div 
        style={{ 
          flex: 1, 
          overflow: 'hidden', 
          width: '100%', 
          position: 'relative',
          cursor: isPanning ? 'grabbing' : 'grab',
          userSelect: isPanning ? 'none' : 'auto'
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        ref={canvasRef}
      >
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div 
            className="board-container" 
            style={{ 
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`, 
              transformOrigin: '0 0', 
              transition: isPanning ? 'none' : 'transform 0.1s ease-out',
              padding: 'var(--space-xl)',
              minHeight: '100%',
              minWidth: '100%',
            }}
          >
            {filteredColumns.map(column => (
              <div 
                key={column.id} 
                style={{
                  position: 'absolute',
                  left: columnPositions[column.id]?.x || 0,
                  top: columnPositions[column.id]?.y || 0,
                  zIndex: 1
                }}
              >
                <Column
                  column={column}
                  onCardCreate={handleCardCreate}
                  onCardClick={setSelectedCard}
                />
              </div>
            ))}
          </div>

          <DragOverlay>
            {activeCard ? (
              <div style={{ width: 300, transform: 'rotate(3deg)' }}>
                <KanbanCard card={activeCard} onClick={() => {}} />
              </div>
            ) : null}
            {activeColumn ? (
              <div style={{ transform: 'rotate(2deg)', opacity: 0.8 }}>
                <Column column={activeColumn} onCardCreate={() => {}} onCardClick={() => {}} isOverlay />
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      </div>

      {selectedCard && (
        <CardDetail
          card={selectedCard}
          boardId={board.id}
          labels={board.labels}
          members={board.members}
          onClose={() => setSelectedCard(null)}
          onUpdate={handleCardUpdate}
        />
      )}

      <CursorOverlay boardId={board.id} />
    </>
  );
}
