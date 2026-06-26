import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

export default function KanbanCard({ card, onClick }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: card.id, data: { type: 'card', card } });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const statusMap = {
    'backlog': 'backlog',
    'to do': 'todo',
    'in progress': 'in-progress',
    'review': 'review',
    'in review': 'review',
    'done': 'done',
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`kanban-card ${isDragging ? 'dragging' : ''}`}
      data-status={statusMap[card.columnName?.toLowerCase()] || 'backlog'}
      onClick={(e) => { if (!isDragging) onClick(card); }}
    >
      {card.labels?.length > 0 && (
        <div className="kanban-card-labels" style={{ marginBottom: 6 }}>
          {card.labels.map(cl => (
            <span
              key={cl.labelId || cl.label?.id}
              className="label-chip"
              style={{
                backgroundColor: `${cl.label?.color || '#767586'}18`,
                color: cl.label?.color || 'var(--outline)',
              }}
            >
              {cl.label?.name}
            </span>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-xs)' }}>
        <div className="kanban-card-title" style={{ marginBottom: 0, flex: 1 }}>{card.title}</div>
        {card.complexity && (
          <span className="kanban-card-time">
            <span className="material-symbols-outlined" style={{ fontSize: 12 }}>schedule</span>
            {card.complexity}d
          </span>
        )}
        {!card.complexity && card.complexitySuggested && (
          <span className="kanban-card-time" style={{ opacity: 0.7 }}>
            <span className="material-symbols-outlined" style={{ fontSize: 12 }}>schedule</span>
            ~{card.complexitySuggested}d
          </span>
        )}
      </div>

      {card.assignee && (
        <div className="kanban-card-assignee-row">
          <div className="kanban-card-assignee">
            {card.assignee.name?.charAt(0).toUpperCase()}
          </div>
          <span>{card.assignee.name}</span>
        </div>
      )}

      {(card._count?.comments > 0 || card.referenceUrl || card.githubIssueId) && (
        <div className="kanban-card-footer">
          <div className="card-metrics">
            {card._count?.comments > 0 && (
              <span title={`${card._count.comments} comments`} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span className="material-symbols-outlined" style={{ fontSize: 14 }}>chat_bubble</span>
                {card._count.comments}
              </span>
            )}
            {card.referenceUrl && (
              <span title="Has reference link" style={{ display: 'flex', alignItems: 'center' }}>
                <span className="material-symbols-outlined" style={{ fontSize: 14 }}>link</span>
              </span>
            )}
            {card.githubIssueId && (
              <span title="Imported from GitHub" style={{ display: 'flex', alignItems: 'center' }}>
                <span className="material-symbols-outlined" style={{ fontSize: 14 }}>code</span>
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
