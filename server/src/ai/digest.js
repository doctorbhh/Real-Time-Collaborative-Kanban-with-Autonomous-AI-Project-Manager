const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function generateDigest(boardId) {
  const now = new Date();
  const weekStart = new Date(now);
  weekStart.setDate(weekStart.getDate() - 7);

  const board = await prisma.board.findUnique({
    where: { id: boardId },
    include: {
      columns: {
        orderBy: { position: 'asc' },
        include: { _count: { select: { cards: true } } },
      },
    },
  });

  if (!board) return null;

  const cardsCreated = await prisma.card.count({
    where: {
      column: { boardId },
      createdAt: { gte: weekStart },
    },
  });

  const doneColumn = board.columns.find(c => c.name.toLowerCase().includes('done'));
  let cardsCompleted = 0;
  if (doneColumn) {
    cardsCompleted = await prisma.activity.count({
      where: {
        action: 'moved',
        details: { path: ['toColumnId'], equals: doneColumn.id },
        createdAt: { gte: weekStart },
      },
    });
  }

  const totalMoves = await prisma.activity.count({
    where: {
      action: 'moved',
      card: { column: { boardId } },
      createdAt: { gte: weekStart },
    },
  });

  const columnStats = board.columns.map(c => ({
    name: c.name,
    cardCount: c._count.cards,
  }));

  const memberActivities = await prisma.activity.groupBy({
    by: ['userId'],
    where: {
      card: { column: { boardId } },
      createdAt: { gte: weekStart },
      userId: { not: null },
    },
    _count: true,
    orderBy: { _count: { userId: 'desc' } },
    take: 5,
  });

  const activeMembers = await Promise.all(
    memberActivities.map(async (ma) => {
      const user = await prisma.user.findUnique({
        where: { id: ma.userId },
        select: { name: true },
      });
      return { name: user?.name || 'Unknown', actions: ma._count };
    })
  );

  const velocityTrend = [];
  for (let i = 0; i < 4; i++) {
    const weekEnd = new Date(now);
    weekEnd.setDate(weekEnd.getDate() - i * 7);
    const weekBegin = new Date(weekEnd);
    weekBegin.setDate(weekBegin.getDate() - 7);

    let completed = 0;
    if (doneColumn) {
      completed = await prisma.activity.count({
        where: {
          action: 'moved',
          details: { path: ['toColumnId'], equals: doneColumn.id },
          createdAt: { gte: weekBegin, lte: weekEnd },
        },
      });
    }
    velocityTrend.unshift({ week: `Week -${i}`, completed });
  }

  const digestData = {
    boardName: board.name,
    period: { start: weekStart.toISOString(), end: now.toISOString() },
    summary: {
      cardsCreated,
      cardsCompleted,
      totalMoves,
      netChange: cardsCreated - cardsCompleted,
    },
    columnDistribution: columnStats,
    velocityTrend,
    activeMembers,
    generatedAt: now.toISOString(),
  };

  const report = await prisma.digestReport.create({
    data: {
      data: digestData,
      weekStart,
      weekEnd: now,
      boardId,
    },
  });

  return { report, data: digestData };
}

module.exports = { generateDigest };
