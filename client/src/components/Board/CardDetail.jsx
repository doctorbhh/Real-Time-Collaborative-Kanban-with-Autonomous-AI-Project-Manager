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
  const [complexityInput, setComplexityInput] = useState('');
  const [showAssigneeMenu, setShowAssigneeMenu] = useState(false);
  const [showLabelMenu, setShowLabelMenu] = useState(false);
  const [newLabelName, setNewLabelName] = useState('');
  const [newLabelColor, setNewLabelColor] = useState('#6063ee');

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
      setComplexityInput(data.card.complexity || '');
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
        changes.baseVersion = card.version;
        const data = await api.updateCard(boardId, card.id, changes);
        if (data.conflictDetected) {
          alert('Conflict detected! Another user modified this card. Please refresh.');
        }
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
      const data = await api.updateCard(boardId, card.id, { assigneeId: assigneeId || null });
      setCard(data.card);
      onUpdate?.(data.card);
      setShowAssigneeMenu(false);
    } catch (err) {
      console.error('Failed to assign:', err);
    }
  };

  const handleComplexityAccept = async () => {
    try {
      const data = await api.updateCard(boardId, card.id, {
        complexity: card.complexitySuggested,
        baseVersion: card.version,
      });
      if (data.conflictDetected) {
        alert('Conflict detected! Another user modified this card.');
      }
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

  const handleComplexityChange = async () => {
    const val = parseInt(complexityInput, 10);
    if (isNaN(val) || val === card.complexity) return;
    try {
      const data = await api.updateCard(boardId, card.id, {
        complexity: val,
        baseVersion: card.version,
      });
      if (data.conflictDetected) {
        alert('Conflict detected! Another user modified this card.');
      }
      setCard(data.card);
      onUpdate?.(data.card);
    } catch (err) {
      console.error('Failed to update complexity:', err);
    }
  };

  const handleAddLabel = async (labelId) => {
    const isApplied = card.labels?.some(cl => cl.labelId === labelId || cl.label?.id === labelId);
    let newLabelIds = [];
    let optimisticLabels;

    if (isApplied) {
      // Remove label
      optimisticLabels = (card.labels || []).filter(cl => cl.labelId !== labelId && cl.label?.id !== labelId);
      newLabelIds = optimisticLabels.map(cl => cl.labelId || cl.label?.id);
    } else {
      // Add label — build optimistic entry from the board labels list
      const matchedLabel = labels?.find(l => l.id === labelId);
      const newEntry = { labelId, label: matchedLabel || { id: labelId, name: '...', color: '#999' } };
      optimisticLabels = [...(card.labels || []), newEntry];
      newLabelIds = optimisticLabels.map(cl => cl.labelId || cl.label?.id);
    }

    setCard(prev => ({ ...prev, labels: optimisticLabels }));
    
    try {
      const data = await api.updateCard(boardId, card.id, {
        labelIds: newLabelIds,
        baseVersion: card.version
      });
      setCard(data.card);
      onUpdate?.(data.card);
    } catch (err) {
      
      setCard(prev => ({ ...prev, labels: card.labels }));
      console.error('Failed to update labels:', err);
    }
  };

  const handleCreateLabel = async () => {
    if (!newLabelName.trim()) return;
    try {
      
      const data = await api.createLabel(boardId, {
        name: newLabelName.trim(),
        color: newLabelColor
      });

      await handleAddLabel(data.label.id);
      
      setNewLabelName('');
      setShowLabelMenu(false);
    } catch (err) {
      console.error('Failed to create label:', err);
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

                <div className="input-group" style={{ marginBottom: 16, position: 'relative' }}>
                  <label className="input-label">Assignee</label>
                  <div
                    onClick={() => setShowAssigneeMenu(!showAssigneeMenu)}
                    style={{ 
                      width: '100%', 
                      marginTop: 4,
                      padding: '8px 10px', 
                      border: '1px solid var(--outline-variant)', 
                      borderRadius: 'var(--radius)',
                      backgroundColor: 'var(--surface-container-lowest)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      cursor: 'pointer'
                    }}
                  >
                    {card.assignee ? (
                      <>
                        <div className="presence-avatar" style={{ width: 20, height: 20, fontSize: 10 }}>
                          {card.assignee.name?.charAt(0).toUpperCase()}
                        </div>
                        <span style={{ fontSize: 13, color: 'var(--on-surface)', flex: 1 }}>{card.assignee.name}</span>
                      </>
                    ) : (
                      <>
                        <span className="material-symbols-outlined" style={{ fontSize: 18, color: 'var(--outline)' }}>person_off</span>
                        <span style={{ fontSize: 13, color: 'var(--on-surface)', flex: 1 }}>Unassigned</span>
                      </>
                    )}
                    <span className="material-symbols-outlined" style={{ fontSize: 16, color: 'var(--outline)' }}>expand_more</span>
                  </div>

                  {showAssigneeMenu && (
                    <div className="dropdown-menu" style={{ 
                      position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4, 
                      zIndex: 100, background: 'var(--surface-container-lowest)', 
                      border: '1px solid var(--outline-variant)', borderRadius: 'var(--radius)', 
                      boxShadow: 'var(--shadow-lg)', padding: '4px 0',
                      maxHeight: 200, overflowY: 'auto'
                    }}>
                      <div
                        onClick={() => handleAssign('')}
                        style={{ padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13 }}
                        onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--surface-container-high)'}
                        onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: 18, color: 'var(--outline)' }}>person_off</span>
                        Unassigned
                      </div>
                      {members?.map(m => (
                        <div
                          key={m.user.id}
                          onClick={() => handleAssign(m.user.id)}
                          style={{ padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, backgroundColor: card.assignee?.id === m.user.id ? 'var(--primary-fixed)' : 'transparent' }}
                          onMouseEnter={e => card.assignee?.id !== m.user.id && (e.currentTarget.style.backgroundColor = 'var(--surface-container-high)')}
                          onMouseLeave={e => card.assignee?.id !== m.user.id && (e.currentTarget.style.backgroundColor = 'transparent')}
                        >
                          <div className="presence-avatar" style={{ width: 20, height: 20, fontSize: 10 }}>
                            {m.user.name?.charAt(0).toUpperCase()}
                          </div>
                          {m.user.name}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="input-group" style={{ marginBottom: 16 }}>
                  <label className="input-label">Complexity (SP)</label>
                  <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                    <input
                      type="number"
                      className="input"
                      value={complexityInput}
                      onChange={e => setComplexityInput(e.target.value)}
                      onBlur={handleComplexityChange}
                      onKeyDown={e => e.key === 'Enter' && handleComplexityChange()}
                      placeholder="SP"
                      style={{ width: 60, padding: '4px 8px' }}
                    />
                    {card.complexitySuggested && card.complexitySuggested !== card.complexity && (
                      <div className="kanban-card-complexity suggested" onClick={handleComplexityAccept} style={{ cursor: 'pointer', flex: 1, justifyContent: 'center', fontSize: 11 }} title="Accept AI Suggestion">
                        AI: {card.complexitySuggested} SP
                      </div>
                    )}
                  </div>
                </div>

                <div className="input-group" style={{ marginBottom: 16, position: 'relative' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <label className="input-label">Labels</label>
                    <button className="btn-icon-sm" onClick={() => setShowLabelMenu(!showLabelMenu)} title="Manage Labels">
                      <span className="material-symbols-outlined" style={{ fontSize: 16 }}>{showLabelMenu ? 'close' : 'add'}</span>
                    </button>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
                    {card.labels?.map(cl => (
                      <span key={cl.labelId || cl.label?.id} className="label-chip" style={{
                        backgroundColor: `${cl.label?.color}18`,
                        color: cl.label?.color,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 2,
                      }}>
                        {cl.label?.name}
                        <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: cl.label?.color, opacity: 0.8, display: 'flex', alignItems: 'center', padding: 0 }} onClick={() => handleAddLabel(cl.labelId || cl.label?.id)}>
                          <span className="material-symbols-outlined" style={{ fontSize: 12 }}>close</span>
                        </button>
                      </span>
                    ))}
                    {(!card.labels || card.labels.length === 0) && (
                      <span style={{ fontSize: 12, color: 'var(--outline)' }}>None</span>
                    )}
                  </div>

                  {showLabelMenu && (
                    <div className="glass-panel" style={{
                      marginTop: 8,
                      padding: 12,
                      borderRadius: 'var(--radius-md)',
                      boxShadow: 'var(--shadow-lg)',
                      width: '100%',
                    }}>
                      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--on-surface-variant)', marginBottom: 8 }}>Existing Labels</div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
                        {labels?.map(l => {
                          const isApplied = card.labels?.some(cl => cl.labelId === l.id || cl.label?.id === l.id);
                          return (
                            <span 
                              key={l.id} 
                              className="label-chip" 
                              onClick={() => handleAddLabel(l.id)}
                              style={{
                                backgroundColor: isApplied ? `${l.color}30` : `${l.color}12`,
                                color: l.color,
                                cursor: 'pointer',
                                border: isApplied ? `2px solid ${l.color}` : '2px solid transparent',
                                fontWeight: isApplied ? 700 : 500,
                                transition: 'all 0.15s ease',
                              }}
                            >
                              {isApplied && <span className="material-symbols-outlined" style={{ fontSize: 12, marginRight: 2 }}>check</span>}
                              {l.name}
                            </span>
                          );
                        })}
                      </div>
                      
                      <div style={{ borderTop: '1px solid var(--outline-variant)', paddingTop: 8 }}>
                        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--on-surface-variant)', marginBottom: 8 }}>Create New</div>
                        <div style={{ display: 'flex', gap: 6, marginBottom: 8, alignItems: 'center' }}>
                          <input type="color" value={newLabelColor} onChange={e => setNewLabelColor(e.target.value)} style={{ flexShrink: 0, width: 28, height: 28, padding: 0, border: '1px solid var(--outline-variant)', borderRadius: '4px', cursor: 'pointer' }} />
                          <input className="input" value={newLabelName} onChange={e => setNewLabelName(e.target.value)} placeholder="Label name" style={{ flex: 1, padding: '4px 8px', border: '1px solid var(--outline-variant)', borderRadius: 'var(--radius)', minWidth: 0, boxSizing: 'border-box' }} />
                        </div>
                        <button className="btn btn-primary btn-sm" style={{ width: '100%' }} onClick={handleCreateLabel} disabled={!newLabelName.trim()}>Create & Apply</button>
                      </div>
                    </div>
                  )}
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
