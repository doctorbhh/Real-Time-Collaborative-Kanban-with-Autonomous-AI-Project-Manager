import { useEffect, useState, useRef } from 'react';
import { useSocket } from '../../context/SocketContext';

function hashColor(str) {
  if (!str) return 'var(--primary)';
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 70%, 50%)`;
}

export default function CursorOverlay({ boardId }) {
  const [cursors, setCursors] = useState({});
  const { on, off } = useSocket();
  const cleanupTimeouts = useRef({});

  useEffect(() => {
    const handleCursorMove = ({ userId, userName, x, y }) => {
      setCursors(prev => ({
        ...prev,
        [userId]: { x, y, userName }
      }));

      if (cleanupTimeouts.current[userId]) {
        clearTimeout(cleanupTimeouts.current[userId]);
      }

      cleanupTimeouts.current[userId] = setTimeout(() => {
        setCursors(prev => {
          const newCursors = { ...prev };
          delete newCursors[userId];
          return newCursors;
        });
      }, 3000);
    };

    on('cursor:move', handleCursorMove);
    
    return () => {
      off('cursor:move', handleCursorMove);
      Object.values(cleanupTimeouts.current).forEach(clearTimeout);
    };
  }, [on, off]);

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', pointerEvents: 'none', zIndex: 9999, overflow: 'hidden' }}>
      {Object.entries(cursors).map(([userId, cursor]) => {
        const color = hashColor(userId);
        return (
          <div
            key={userId}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              transform: `translate(${cursor.x}px, ${cursor.y}px)`,
              transition: 'transform 50ms linear',
              pointerEvents: 'none',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'flex-start'
            }}
          >
            <svg 
              width="24" 
              height="24" 
              viewBox="0 0 24 24" 
              fill={color}
              stroke="white" 
              strokeWidth="2" 
              strokeLinejoin="round" 
              style={{ filter: 'drop-shadow(0px 2px 4px rgba(0,0,0,0.2))' }}
            >
              <path d="M5.5 3.21V20.8c0 .45.54.67.85.35l4.86-4.86a.5.5 0 0 1 .35-.15h6.42c.45 0 .67-.54.35-.85L6.35 3.35a.5.5 0 0 0-.85.35Z" />
            </svg>
            
            <div style={{
              background: color,
              color: 'white',
              padding: '4px 8px',
              borderRadius: '12px',
              borderTopLeftRadius: '2px',
              fontSize: '12px',
              fontWeight: 600,
              whiteSpace: 'nowrap',
              boxShadow: '0 2px 4px rgba(0,0,0,0.15)',
              marginTop: '-4px',
              marginLeft: '12px'
            }}>
              {cursor.userName}
            </div>
          </div>
        );
      })}
    </div>
  );
}
