const llm = require('./llmClient');
const prisma = require('../db');

const delay = ms => new Promise(res => setTimeout(res, ms));

async function suggestAssignments(boardId, io) {
  
  const unassignedCards = await prisma.card.findMany({
    where: {
      column: { boardId, name: { not: 'Done' } },
      assigneeId: null,
    },
    include: {
      labels: { include: { label: true } },
    },
    take: 5,
    orderBy: { createdAt: 'desc' },
  });

  if (unassignedCards.length === 0) return [];

  const members = await prisma.boardMember.findMany({
    where: { boardId },
    include: {
      user: { select: { id: true, name: true } },
    },
  });

  if (members.length === 0) return [];

  const memberStats = await Promise.all(members.map(async (member) => {
    const inProgressCount = await prisma.card.count({
      where: {
        assigneeId: member.user.id,
        column: { boardId, name: { not: 'Done' } },
      },
    });

    const recentCompleted = await prisma.card.findMany({
      where: {
        assigneeId: member.user.id,
        column: { boardId, name: 'Done' },
        updatedAt: { gte: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000) },
      },
      include: { labels: { include: { label: true } } },
    });

    const labelCounts = {};
    recentCompleted.forEach(card => {
      card.labels.forEach(cl => {
        labelCounts[cl.label.name] = (labelCounts[cl.label.name] || 0) + 1;
      });
    });

    const topLabels = Object.entries(labelCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3)
      .map(([name]) => name);

    return {
      id: member.user.id,
      name: member.user.name,
      inProgressCount,
      recentVelocity: recentCompleted.length,
      expertise: topLabels.join(', ') || 'general',
    };
  }));

  const memberStatsStr = memberStats.map(m => 
    `- ${m.name} (ID: ${m.id}): ${m.inProgressCount} tasks in progress, velocity ${m.recentVelocity} in 14 days, expertise: ${m.expertise}`
  ).join('\n');

  const suggestions = [];
  let isFirstCard = true;

  for (const card of unassignedCards) {
    if (!isFirstCard) {
      await delay(15000); 
    }
    isFirstCard = false;

    const labelsStr = card.labels.map(cl => cl.label.name).join(', ') || 'none';
    const prompt = `You are an agile project manager distributing tasks.
Task to assign:
Title: ${card.title}
Labels: ${labelsStr}
Description: ${card.description?.slice(0, 300) || 'None'}

Team members:
${memberStatsStr}

Suggest the best team member to assign this task to. Consider their current load (inProgressCount) and expertise matching the task labels.

Format your response exactly as a JSON object:
{
  "assigneeId": "ID of suggested member",
  "assigneeName": "Name of suggested member",
  "reason": "1 sentence explanation based on load and skills."
}
Respond ONLY with the JSON object.`;

    let aiResponse = '';
    try {
      if (io) {
        for await (const chunk of llm.stream(prompt, { temperature: 0.1 })) {
          aiResponse += chunk;
          io.to(`board:${boardId}`).emit('ai:stream', { type: 'auto_assign', chunk });
        }
      } else {
        aiResponse = await llm.complete(prompt, { temperature: 0.1 });
      }

      const parsed = JSON.parse(aiResponse.replace(/```json\n?|\n?```/g, '').trim());
      
      if (parsed.assigneeId) {
        suggestions.push({
          cardId: card.id,
          cardTitle: card.title,
          suggestedAssigneeId: parsed.assigneeId,
          suggestedAssignee: parsed.assigneeName,
          reason: parsed.reason,
        });
      }
    } catch (e) {
      console.error(`LLM auto-assign failed for card ${card.id}:`, e.message);
    }
  }

  return suggestions;
}

module.exports = { suggestAssignments };
