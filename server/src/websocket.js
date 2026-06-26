const { Server } = require('socket.io');

const prisma = require('./db');

function setupWebSocket(server) {
  const io = new Server(server, {
    cors: {
      origin: process.env.CLIENT_URL || 'http://localhost:5173',
      credentials: true,
    },
    transports: ['websocket', 'polling'],
  });

  io.use(async (socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) {
      return next(new Error('Authentication error: Token missing'));
    }
    try {
      const user = await prisma.user.findUnique({ where: { apiKey: token } });
      if (!user) {
        return next(new Error('Authentication error: Invalid token'));
      }
      socket.userId = user.id;
      next();
    } catch (err) {
      next(new Error('Authentication error: Database error'));
    }
  });

  const boardPresence = new Map();

  io.on('connection', (socket) => {
    console.log(`Client connected: ${socket.id} (User: ${socket.userId})`);

    socket.on('board:join', async ({ boardId, userName, avatar }) => {
      try {
        const isMember = await prisma.boardMember.findFirst({
          where: { userId: socket.userId, boardId }
        });
        
        if (!isMember) {
          return socket.emit('error', { message: 'Not authorized for this board' });
        }

        const room = `board:${boardId}`;
        socket.join(room);

        if (!socket.boards) socket.boards = new Set();
        socket.boards.add(boardId);
        socket.userName = userName;

        if (!boardPresence.has(boardId)) {
          boardPresence.set(boardId, new Map());
        }
        
        const presenceMap = boardPresence.get(boardId);
        if (!presenceMap.has(socket.userId)) {
          presenceMap.set(socket.userId, {
            name: userName,
            avatar: avatar || null,
            socketIds: new Set([socket.id])
          });
        } else {
          const userPresence = presenceMap.get(socket.userId);
          userPresence.socketIds.add(socket.id);
          userPresence.name = userName;
          userPresence.avatar = avatar || null;
        }

        const users = Array.from(presenceMap.entries()).map(([userId, data]) => ({
          userId,
          name: data.name,
          avatar: data.avatar
        }));

        io.to(room).emit('board:presence', users);
        console.log(`${userName} joined board ${boardId}`);
      } catch (err) {
        console.error('Error in board:join:', err);
      }
    });

    socket.on('board:leave', ({ boardId }) => {
      handleLeave(socket, boardId);
    });

    socket.on('card:typing', ({ boardId, cardId }) => {
      socket.to(`board:${boardId}`).emit('card:typing', {
        cardId,
        userId: socket.userId,
        userName: socket.userName
      });
    });

    socket.on('card:typing:stop', ({ boardId, cardId }) => {
      socket.to(`board:${boardId}`).emit('card:typing:stop', {
        cardId,
        userId: socket.userId
      });
    });

    socket.on('cursor:move', ({ x, y, boardId }) => {
      socket.volatile.to(`board:${boardId}`).emit('cursor:move', {
        userId: socket.userId,
        userName: socket.userName,
        x,
        y
      });
    });

    socket.on('disconnect', () => {
      console.log(`Client disconnected: ${socket.id}`);
      if (socket.boards) {
        for (const boardId of socket.boards) {
          handleLeave(socket, boardId);
        }
      }
    });
  });

  function handleLeave(socket, boardId) {
    socket.leave(`board:${boardId}`);
    if (socket.boards) socket.boards.delete(boardId);

    if (boardPresence.has(boardId)) {
      const presenceMap = boardPresence.get(boardId);
      if (presenceMap.has(socket.userId)) {
        const userPresence = presenceMap.get(socket.userId);
        userPresence.socketIds.delete(socket.id);
        
        if (userPresence.socketIds.size === 0) {
          presenceMap.delete(socket.userId);
          
          const users = Array.from(presenceMap.entries()).map(([userId, data]) => ({
            userId,
            name: data.name,
            avatar: data.avatar
          }));
          
          io.to(`board:${boardId}`).emit('board:presence', users);
        }
      }
      if (presenceMap.size === 0) {
        boardPresence.delete(boardId);
      }
    }
  }

  return io;
}

module.exports = { setupWebSocket };
