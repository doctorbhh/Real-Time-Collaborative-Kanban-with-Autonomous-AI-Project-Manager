import { useState } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import KanbanCard from './KanbanCard';
import InlineCardCreate from './InlineCardCreate';

const columnColors = {
  'backlog': { dot: 'var(--outline-variant)', countBg: 'var(--surface-container)', countColor: 'var(--on-surface-variant)' },
  'to do': { dot: 'var(--outline-variant)', countBg: 'var(--surface-container)', countColor: 'var(--on-surface-variant)' },
  'in progress': { dot: 'var(--tertiary)', countBg: 'rgba(163, 103, 0, 0.1)', countColor: 'var(--tertiary)' },
  'review': { dot: 'var(--primary)', countBg: 'rgba(96, 99, 238, 0.1)', countColor: 'var(--primary)' },
  'in review': { dot: 'var(--primary)', countBg: 'rgba(96, 99, 238, 0.1)', countColor: 'var(--primary)' },
  'done': { dot: 'var(--secondary)', countBg: 'rgba(0, 108, 73, 0.1)', countColor: 'var(--secondary)' },
};

export default function Column({ column, onCardCreate, onCardClick, isOverlay }) {
  const [isCreating, setIsCreating] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
    isOver
  } = useSortable({
    id: column.id,
    data: { type: 'column', column },
  });

  const cardIds = column.cards?.map(c => c.id) || [];
  const colKey = column.name?.toLowerCase() || 'backlog';
  const colors = columnColors[colKey] || columnColors['backlog'];
  const showDot = colKey !== 'backlog' && colKey !== 'to do';

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    zIndex: isDragging ? 100 : 1,
  };

  if (isMinimized) {
    return (
      <div 
        ref={setNodeRef} 
        style={style} 
        className={`board-column minimized ${isOverlay ? 'overlay' : ''}`}
      >
        <div className="board-column-header" {...attributes} {...listeners} style={{ cursor: 'grab', flexDirection: 'column', padding: '16px 8px', height: '100%', justifyContent: 'flex-start' }}>
          <button className="btn-icon-sm" onClick={() => setIsMinimized(false)} style={{ marginBottom: 16 }}>
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>unfold_more</span>
          </button>
          <div style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)', fontWeight: 600, color: 'var(--on-surface-variant)', display: 'flex', alignItems: 'center', gap: 8 }}>
            {column.name}
            <span style={{ transform: 'rotate(90deg)', background: colors.countBg, color: colors.countColor, padding: '2px 6px', borderRadius: 12, fontSize: 11 }}>
              {column.cards?.length || 0}
            </span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div 
      ref={setNodeRef}
      style={style}
      className={`board-column ${isOverlay ? 'overlay' : ''}`}
    >
      <div className="board-column-header" {...attributes} {...listeners} style={{ cursor: 'grab' }}>
        <div className="board-column-title">
          {showDot && (
            <span style={{
              width: 8, height: 8, borderRadius: '50%',
              background: colors.dot, display: 'inline-block',
            }} />
          )}
          {column.name}
          <span className="board-column-count" style={{
            background: colors.countBg,
            color: colors.countColor,
          }}>
            {column.cards?.length || 0}
          </span>
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          <button className="btn btn-ghost btn-icon-sm" onClick={() => setIsCreating(true)} title="Add card">
            +
          </button>
          <button className="btn btn-ghost btn-icon-sm" onClick={() => setIsMinimized(true)} title="Minimize column">
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>unfold_less</span>
          </button>
        </div>
      </div>

      <div className={`board-column-body ${isOver ? 'drag-over' : ''}`}>
        <SortableContext items={cardIds} strategy={verticalListSortingStrategy}>
          {column.cards?.map(card => (
            <KanbanCard
              key={card.id}
              card={{ ...card, columnName: column.name }}
              onClick={onCardClick}
            />
          ))}
        </SortableContext>

        {isCreating && (
          <InlineCardCreate
            onSubmit={(title) => {
              onCardCreate(column.id, title);
              setIsCreating(false);
            }}
            onCancel={() => setIsCreating(false)}
          />
        )}
      </div>

      {!isCreating && (
        <div className="board-column-footer">
          <button className="board-column-add-btn" onPointerDown={() => setIsCreating(true)}>
            <span>+</span>
            <span>Add a card</span>
          </button>
        </div>
      )}
    </div>
  );
}
