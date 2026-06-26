const { Server } = require('socket.io');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

function setupWebSocket(server) {
  const io = new Server(server, {
    cors: {
      origin: process.env.CLIENT_URL || 'http://localhost:5173',
      credentials: true,
    },
    transports: ['websocket', 'polling'],
  });

  const boardUsers = new Map(); // boardId -> Map<socketId, { userId, userName }>

  io.on('connection', (socket) => {
    console.log(`Client connected: ${socket.id}`);

    socket.on('board:join', ({ boardId, userId, userName }) => {
      socket.join(boardId);
      socket.boardId = boardId;
      socket.userId = userId;
      socket.userName = userName;

      if (!boardUsers.has(boardId)) {
        boardUsers.set(boardId, new Map());
      }
      boardUsers.get(boardId).set(socket.id, { userId, userName });

      io.to(boardId).emit('user:presence', {
        users: Array.from(boardUsers.get(boardId).values()),
        event: 'joined',
        user: { userId, userName },
      });

      console.log(`${userName} joined board ${boardId}`);
    });

    socket.on('board:leave', ({ boardId }) => {
      socket.leave(boardId);
      if (boardUsers.has(boardId)) {
        boardUsers.get(boardId).delete(socket.id);
        io.to(boardId).emit('user:presence', {
          users: Array.from(boardUsers.get(boardId).values()),
          event: 'left',
          user: { userId: socket.userId, userName: socket.userName },
        });
      }
    });

    socket.on('card:created', async ({ card, boardId }) => {
      socket.to(boardId).emit('card:created', { card });
    });

    socket.on('card:moved', async ({ cardId, fromColumnId, toColumnId, newPosition, boardId }) => {
      try {
        const card = await prisma.card.findUnique({ where: { id: cardId } });
        if (!card) return;

        await prisma.$transaction(async (tx) => {
          if (fromColumnId !== toColumnId) {
            await tx.card.updateMany({
              where: {
                columnId: fromColumnId,
                position: { gt: card.position },
              },
              data: { position: { decrement: 1 } },
            });

            await tx.card.updateMany({
              where: {
                columnId: toColumnId,
                position: { gte: newPosition },
              },
              data: { position: { increment: 1 } },
            });
          } else {
            if (newPosition > card.position) {
              await tx.card.updateMany({
                where: {
                  columnId: toColumnId,
                  position: { gt: card.position, lte: newPosition },
                },
                data: { position: { decrement: 1 } },
              });
            } else if (newPosition < card.position) {
              await tx.card.updateMany({
                where: {
                  columnId: toColumnId,
                  position: { gte: newPosition, lt: card.position },
                },
                data: { position: { increment: 1 } },
              });
            }
          }

          await tx.card.update({
            where: { id: cardId },
            data: {
              columnId: toColumnId,
              position: newPosition,
              version: { increment: 1 },
            },
          });

          await tx.activity.create({
            data: {
              action: 'moved',
              details: { fromColumnId, toColumnId },
              cardId,
              userId: socket.userId || null,
            },
          });
        });

        socket.to(boardId).emit('card:moved', {
          cardId,
          fromColumnId,
          toColumnId,
          newPosition,
          movedBy: socket.userName,
        });
      } catch (err) {
        console.error('Error moving card:', err);
        socket.emit('error', { message: 'Failed to move card' });
      }
    });

    socket.on('card:updated', async ({ cardId, changes, version, boardId }) => {
      try {
        const card = await prisma.card.findUnique({ where: { id: cardId } });
        if (!card) return;

        if (card.version !== version) {
          socket.emit('conflict:detected', {
            cardId,
            serverVersion: card.version,
            yourVersion: version,
            serverData: card,
            yourChanges: changes,
          });
          return;
        }

        const updated = await prisma.card.update({
          where: { id: cardId },
          data: {
            ...changes,
            version: { increment: 1 },
          },
          include: {
            labels: { include: { label: true } },
            assignee: true,
          },
        });

        await prisma.activity.create({
          data: {
            action: 'edited',
            details: { changes: Object.keys(changes) },
            cardId,
            userId: socket.userId || null,
          },
        });

        socket.to(boardId).emit('card:updated', { card: updated });
      } catch (err) {
        console.error('Error updating card:', err);
        socket.emit('error', { message: 'Failed to update card' });
      }
    });

    socket.on('card:deleted', async ({ cardId, boardId }) => {
      socket.to(boardId).emit('card:deleted', { cardId });
    });

    socket.on('column:created', ({ column, boardId }) => {
      socket.to(boardId).emit('column:created', { column });
    });

    socket.on('column:updated', ({ columnId, changes, boardId }) => {
      socket.to(boardId).emit('column:updated', { columnId, changes });
    });

    socket.on('column:deleted', ({ columnId, boardId }) => {
      socket.to(boardId).emit('column:deleted', { columnId });
    });

    socket.on('column:reordered', ({ columns, boardId }) => {
      socket.to(boardId).emit('column:reordered', { columns });
    });

    socket.on('user:typing', ({ cardId, field, boardId }) => {
      socket.to(boardId).emit('user:typing', {
        cardId,
        field,
        userId: socket.userId,
        userName: socket.userName,
      });
    });

    socket.on('cursor:move', ({ x, y, boardId }) => {
      socket.volatile.to(boardId).emit('cursor:move', {
        userId: socket.userId,
        userName: socket.userName,
        x,
        y
      });
    });

    socket.on('disconnect', () => {
      console.log(`Client disconnected: ${socket.id}`);
      if (socket.boardId && boardUsers.has(socket.boardId)) {
        boardUsers.get(socket.boardId).delete(socket.id);
        io.to(socket.boardId).emit('user:presence', {
          users: Array.from(boardUsers.get(socket.boardId).values()),
          event: 'left',
          user: { userId: socket.userId, userName: socket.userName },
        });
      }
    });
  });

  return io;
}

module.exports = { setupWebSocket };
