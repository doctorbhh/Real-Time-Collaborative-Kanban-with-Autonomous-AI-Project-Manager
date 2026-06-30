import { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';

const SocketContext = createContext(null);

const SOCKET_URL = import.meta.env.VITE_API_URL || (import.meta.env.PROD ? window.location.origin : 'http://localhost:3000');

export function SocketProvider({ children }) {
  const { user } = useAuth();
  const socketRef = useRef(null);
  const [connected, setConnected] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState([]);

  useEffect(() => {
    if (!user) return;

    const socket = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      withCredentials: true,
      auth: { token: user.apiKey },
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    socket.on('connect', () => {
      console.log('WebSocket connected');
      setConnected(true);
      
      if (socket.boardIdToRejoin) {
        socket.emit('board:join', {
          boardId: socket.boardIdToRejoin,
          userName: user.name,
          avatar: user.avatarUrl
        });
      }
    });

    socket.on('disconnect', () => {
      console.log('WebSocket disconnected');
      setConnected(false);
    });

    socket.on('board:presence', (users) => {
      setOnlineUsers(users);
    });

    socketRef.current = socket;

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [user]);

  const joinBoard = useCallback((boardId) => {
    if (socketRef.current && user) {
      socketRef.current.boardIdToRejoin = boardId;
      socketRef.current.emit('board:join', {
        boardId,
        userName: user.name,
        avatar: user.avatarUrl
      });
    }
  }, [user]);

  const leaveBoard = useCallback((boardId) => {
    if (socketRef.current) {
      socketRef.current.boardIdToRejoin = null;
      socketRef.current.emit('board:leave', { boardId });
    }
  }, []);

  const emit = useCallback((event, data) => {
    if (socketRef.current) {
      socketRef.current.emit(event, data);
    }
  }, []);

  const on = useCallback((event, handler) => {
    if (socketRef.current) {
      socketRef.current.on(event, handler);
    }
  }, []);

  const off = useCallback((event, handler) => {
    if (socketRef.current) {
      socketRef.current.off(event, handler);
    }
  }, []);

  return (
    <SocketContext.Provider value={{
      socket: socketRef.current,
      connected,
      onlineUsers,
      joinBoard,
      leaveBoard,
      emit,
      on,
      off,
    }}>
      {children}
    </SocketContext.Provider>
  );
}

export function useSocket() {
  const ctx = useContext(SocketContext);
  if (!ctx) throw new Error('useSocket must be used within SocketProvider');
  return ctx;
}
