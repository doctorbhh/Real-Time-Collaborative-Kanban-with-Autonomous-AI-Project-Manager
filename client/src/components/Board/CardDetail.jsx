import { useState, useEffect } from 'react';
import { XIcon, LinkIcon } from "@animateicons/react/lucide";
import api from '../../utils/api';

export default function CardDetail({ card: initialCard, boardId, labels, members, onClose, onUpdate }) {
  const [card, setCard] = useState(initialCard);
  const [title, setTitle] = useState(initialCard.title);
  const [description, setDescription] = useState(initialCard.description || '');
  const [commentText, setCommentText] = useState('');
  const [comments, setComments] = useState([]);
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadCardDetail();
  }, []);

  const loadCardDetail = async () => {
    try {
      const data = await api.getCard(boardId, initialCard.id);
      setCard(data.card);
      setTitle(data.card.title);
      setDescription(data.card.description || '');
      setComments(data.card.comments || []);
      setActivities(data.card.activities || []);
    } catch (err) {
      console.error('Failed to load card:', err);
    } finally {
      setLoading(false);
    }
  };

  const saveChanges = async () => {
    setSaving(true);
    try {
      const changes = {};
      if (title !== card.title) changes.title = title;
      if (description !== (card.description || '')) changes.description = description;
      if (Object.keys(changes).length > 0) {
        changes.version = card.version;
        const data = await api.updateCard(boardId, card.id, changes);
        setCard(data.card);
        onUpdate?.(data.card);
      }
    } catch (err) {
      if (err.status === 409) {
        alert('Conflict detected! Another user modified this card. Please refresh.');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleAssign = async (assigneeId) => {
    try {
      const data = await api.updateCard(boardId, card.id, { assigneeId: assigneeId || null, version: card.version });
      setCard(data.card);
      onUpdate?.(data.card);
    } catch (err) {
      console.error('Failed to assign:', err);
    }
  };

  const handleComplexityAccept = async () => {
    try {
      const data = await api.updateCard(boardId, card.id, {
        complexity: card.complexitySuggested,
        version: card.version,
      });
      setCard(data.card);
      onUpdate?.(data.card);
    } catch (err) {
      console.error('Failed to accept complexity:', err);
    }
  };

  const handleAddComment = async () => {
    if (!commentText.trim()) return;
    try {
      const data = await api.addComment(card.id, { text: commentText });
      setComments(prev => [...prev, data.comment]);
      setCommentText('');
    } catch (err) {
      console.error('Failed to add comment:', err);
    }
  };

  return (
    <>
      <div className="modal-backdrop" onClick={onClose} />
      <div className="modal" style={{ maxWidth: 720 }}>
        <div className="modal-header">
          <h2>Card Detail</h2>
          <button className="btn btn-ghost btn-icon-sm" onClick={onClose}><XIcon size="24" /></button>
        </div>

        <div className="modal-body">
          {loading ? (
            <div className="empty-state" style={{ padding: 40 }}>
              <div className="loading-spinner" />
            </div>
          ) : (
            <div style={{ display: 'flex', gap: 24 }}>
              <div style={{ flex: 1 }}>
                <div className="input-group" style={{ marginBottom: 16 }}>
                  <input
                    className="input"
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                    onBlur={saveChanges}
                    style={{ fontSize: 18, fontWeight: 600, border: 'none', padding: '4px 0' }}
                  />
                </div>

                <div className="input-group" style={{ marginBottom: 24 }}>
                  <label className="input-label">Description</label>
                  <textarea
                    className="input textarea"
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    onBlur={saveChanges}
                    placeholder="Add a more detailed description..."
                    rows={4}
                  />
                </div>

                {card.referenceUrl && (
                  <div style={{ marginBottom: 16 }}>
                    <label className="input-label">Reference LinkIcon</label>
                    <a href={card.referenceUrl} target="_blank" rel="noreferrer" style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--primary)', textDecoration: 'none' }}>
                      <LinkIcon size="16" /> {card.referenceUrl}
                    </a>
                  </div>
                )}

                <div style={{ marginTop: 24 }}>
                  <label className="input-label" style={{ marginBottom: 12, display: 'block' }}>
                    Comments ({comments.length})
                  </label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
                    {comments.map(c => (
                      <div key={c.id} style={{
                        padding: '8px 12px', background: 'var(--surface-container-low)',
                        borderRadius: 'var(--radius)', fontSize: 13,
                      }}>
                        <div style={{ fontWeight: 600, fontSize: 12, color: 'var(--on-surface-variant)', marginBottom: 4 }}>
                          {c.user?.name} · {new Date(c.createdAt).toLocaleDateString()}
                        </div>
                        {c.text}
                      </div>
                    ))}
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input
                      className="input"
                      value={commentText}
                      onChange={e => setCommentText(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleAddComment()}
                      placeholder="Write a comment..."
                      style={{ flex: 1 }}
                    />
                    <button className="btn btn-primary btn-sm" onClick={handleAddComment}>Send</button>
                  </div>
                </div>

                {activities.length > 0 && (
                  <div style={{ marginTop: 24 }}>
                    <label className="input-label" style={{ marginBottom: 8, display: 'block' }}>Activity</label>
                    <div style={{ fontSize: 12, color: 'var(--outline)', display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {activities.slice(0, 10).map(a => (
                        <div key={a.id}>
                          <strong>{a.user?.name || 'System'}</strong> {a.action} this card · {new Date(a.createdAt).toLocaleDateString()}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div style={{ width: 180, flexShrink: 0 }}>
                <div className="input-group" style={{ marginBottom: 16 }}>
                  <label className="input-label">Column</label>
                  <div className="chip chip-neutral" style={{ marginTop: 4 }}>{card.column?.name}</div>
                </div>

                <div className="input-group" style={{ marginBottom: 16 }}>
                  <label className="input-label">Assignee</label>
                  <select
                    className="input"
                    value={card.assignee?.id || ''}
                    onChange={e => handleAssign(e.target.value)}
                    style={{ marginTop: 4, padding: '6px 8px', border: '1px solid var(--outline-variant)', borderRadius: 'var(--radius)' }}
                  >
                    <option value="">Unassigned</option>
                    {members?.map(m => (
                      <option key={m.user.id} value={m.user.id}>{m.user.name}</option>
                    ))}
                  </select>
                </div>

                <div className="input-group" style={{ marginBottom: 16 }}>
                  <label className="input-label">Complexity</label>
                  {card.complexity ? (
                    <div className="kanban-card-complexity" style={{ marginTop: 4 }}>
                      {card.complexity} Story Points
                    </div>
                  ) : card.complexitySuggested ? (
                    <div style={{ marginTop: 4 }}>
                      <div className="kanban-card-complexity suggested" style={{ marginBottom: 6 }}>
                        AI suggests: {card.complexitySuggested} SP
                      </div>
                      <button className="btn btn-success btn-sm" onClick={handleComplexityAccept} style={{ width: '100%' }}>
                        Accept
                      </button>
                    </div>
                  ) : (
                    <div style={{ marginTop: 4, fontSize: 12, color: 'var(--outline)' }}>Not estimated</div>
                  )}
                </div>

                <div className="input-group" style={{ marginBottom: 16 }}>
                  <label className="input-label">Labels</label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
                    {card.labels?.map(cl => (
                      <span key={cl.labelId || cl.label?.id} className="label-chip" style={{
                        backgroundColor: `${cl.label?.color}18`,
                        color: cl.label?.color,
                      }}>
                        {cl.label?.name}
                      </span>
                    ))}
                    {(!card.labels || card.labels.length === 0) && (
                      <span style={{ fontSize: 12, color: 'var(--outline)' }}>None</span>
                    )}
                  </div>
                </div>

                {saving && <div className="ai-progress" style={{ marginTop: 8 }}>Saving...</div>}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
