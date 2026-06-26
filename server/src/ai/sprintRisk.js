const prisma = require('../db');
const llm = require('./llmClient');

async function assessSprintRisk(boardId, io) {
  const board = await prisma.board.findUnique({
    where: { id: boardId },
    select: { sprintEndDate: true, name: true },
  });

  if (!board || !board.sprintEndDate) {
    return null; 
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
    orderBy: { order: 'asc' },
  });

  const doneColumn = columns.find(c => c.name.toLowerCase().includes('done'));
  const doneColumnId = doneColumn?.id;

  const remainingCardsData = await prisma.card.findMany({
    where: {
      column: {
        boardId,
        ...(doneColumnId ? { id: { not: doneColumnId } } : {}),
      },
    },
    select: { complexity: true },
  });
  
  const remainingCards = remainingCardsData.length;
  const totalComplexityRemaining = remainingCardsData.reduce((sum, card) => sum + (card.complexity || 0), 0);

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

  const velocity = completedThisWeek / 7; 
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

  let aiAnalysis = null;
  if (io) {
    const prompt = `You are an agile project manager assessing sprint risk.
Data:
- Days remaining: ${daysRemaining}
- Cards remaining: ${remainingCards}
- Total estimated complexity points remaining: ${totalComplexityRemaining}
- Current velocity: ${velocity.toFixed(1)} cards/day
- Required velocity: ${requiredVelocity.toFixed(1)} cards/day
- Risk level calculated: ${risk}

Format your response exactly as a JSON object with this shape:
{
  "riskLevel": "on_track | at_risk | critical",
  "summary": "1-2 sentence risk summary.",
  "recommendation": "1-2 sentence actionable recommendation."
}
Respond ONLY with the JSON object, no markdown formatting like \`\`\`json.`;

    let aiResponse = '';
    try {
      for await (const chunk of llm.stream(prompt, { temperature: 0.2 })) {
        aiResponse += chunk;
        io.to(`board:${boardId}`).emit('ai:stream', { type: 'sprint_risk', chunk });
      }
      aiAnalysis = JSON.parse(aiResponse.replace(/```json\n?|\n?```/g, '').trim());
    } catch (e) {
      console.error('LLM sprint risk analysis failed:', e);
    }
  }

  return {
    risk,
    message,
    daysRemaining,
    remainingCards,
    totalComplexityRemaining,
    velocityPerDay: Math.round(velocity * 10) / 10,
    requiredVelocityPerDay: Math.round(requiredVelocity * 10) / 10,
    completedThisWeek,
    sprintEndDate: board.sprintEndDate,
    aiAnalysis
  };
}

module.exports = { assessSprintRisk };
