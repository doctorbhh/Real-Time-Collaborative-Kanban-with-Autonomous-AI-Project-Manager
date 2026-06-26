const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function assessSprintRisk(boardId) {
  const board = await prisma.board.findUnique({
    where: { id: boardId },
    select: { sprintEndDate: true, name: true },
  });

  if (!board || !board.sprintEndDate) {
    return null; // No sprint configured
  }

  const now = new Date();
  const sprintEnd = new Date(board.sprintEndDate);
  const daysRemaining = Math.max(0, Math.ceil((sprintEnd - now) / (1000 * 60 * 60 * 24)));

  if (daysRemaining === 0) {
    return {
      risk: 'SPRINT_ENDED',
      message: 'The sprint has ended.',
      daysRemaining: 0,
    };
  }

  const columns = await prisma.column.findMany({
    where: { boardId },
    include: { _count: { select: { cards: true } } },
    orderBy: { position: 'asc' },
  });

  const doneColumn = columns.find(c => c.name.toLowerCase().includes('done'));
  const doneColumnId = doneColumn?.id;

  const remainingCards = await prisma.card.count({
    where: {
      column: {
        boardId,
        ...(doneColumnId ? { id: { not: doneColumnId } } : {}),
      },
    },
  });

  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  let completedThisWeek = 0;

  if (doneColumnId) {
    const recentDoneMoves = await prisma.activity.findMany({
      where: {
        action: 'moved',
        createdAt: { gte: weekAgo },
      },
    });
    
    completedThisWeek = recentDoneMoves.filter(
      (a) => a.details && a.details.toColumnId === doneColumnId
    ).length;
  }

  const velocity = completedThisWeek / 7; // cards per day
  const requiredVelocity = remainingCards / Math.max(daysRemaining, 1);
  const riskRatio = requiredVelocity / Math.max(velocity, 0.1);

  let risk, message;
  if (riskRatio > 2.5) {
    risk = 'CRITICAL';
    message = `Critical risk: ${remainingCards} cards remain with ${daysRemaining} days left. Current pace (${velocity.toFixed(1)} cards/day) is far below the required ${requiredVelocity.toFixed(1)} cards/day. The team needs to more than double their output or reduce scope immediately.`;
  } else if (riskRatio > 1.5) {
    risk = 'HIGH';
    message = `High risk: ${remainingCards} cards remain with ${daysRemaining} days left. Current velocity of ${velocity.toFixed(1)} cards/day needs to increase to ${requiredVelocity.toFixed(1)} cards/day. Consider deprioritising lower-priority items.`;
  } else if (riskRatio > 1.1) {
    risk = 'MEDIUM';
    message = `Medium risk: ${remainingCards} cards remain with ${daysRemaining} days left. The team is close but needs to maintain or slightly increase their pace of ${velocity.toFixed(1)} cards/day.`;
  } else {
    risk = 'ON_TRACK';
    message = `On track: ${remainingCards} cards remain with ${daysRemaining} days left. Current velocity of ${velocity.toFixed(1)} cards/day is sufficient to complete the sprint on time.`;
  }

  return {
    risk,
    message,
    daysRemaining,
    remainingCards,
    velocityPerDay: Math.round(velocity * 10) / 10,
    requiredVelocityPerDay: Math.round(requiredVelocity * 10) / 10,
    completedThisWeek,
    sprintEndDate: board.sprintEndDate,
  };
}

module.exports = { assessSprintRisk };
