import { useState, useRef, useEffect } from 'react';

export default function InlineCardCreate({ onSubmit, onCancel }) {
  const [title, setTitle] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = () => {
    const trimmed = title.trim();
    if (trimmed) {
      onSubmit(trimmed);
      setTitle('');
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
    if (e.key === 'Escape') {
      onCancel();
    }
  };

  return (
    <div className="inline-card-create">
      <textarea
        ref={inputRef}
        className="inline-card-input"
        value={title}
        onChange={e => setTitle(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Enter a title for this card..."
        rows={2}
      />
      <div className="inline-card-actions">
        <button className="btn btn-primary btn-sm" onPointerDown={handleSubmit}>
          Add Card
        </button>
        <button className="btn btn-ghost btn-sm" onPointerDown={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}
