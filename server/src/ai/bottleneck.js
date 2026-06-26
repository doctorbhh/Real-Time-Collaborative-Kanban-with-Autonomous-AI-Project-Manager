const prisma = require('../db');
const llm = require('./llmClient');

async function detectBottlenecks(boardId, io) {
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const columns = await prisma.column.findMany({
    where: { boardId },
    include: {
      cards: {
        include: {
          assignee: { select: { id: true, name: true } },
          labels: { include: { label: true } },
          activities: {
            where: { createdAt: { gte: weekAgo } },
            orderBy: { createdAt: 'desc' },
          },
        },
      },
    },
    orderBy: { order: 'asc' },
  });

  const recentMoves = await prisma.activity.findMany({
    where: {
      action: 'moved',
      createdAt: { gte: weekAgo },
    },
  });

  const bottlenecks = [];

  for (const column of columns) {
    const entriesThisWeek = recentMoves.filter(
      (a) => a.details && a.details.toColumnId === column.id
    ).length;

    const exitsThisWeek = recentMoves.filter(
      (a) => a.details && a.details.fromColumnId === column.id
    ).length;

    const currentCardCount = column.cards.length;
    const flowRatio = exitsThisWeek / Math.max(entriesThisWeek, 1);

    if ((flowRatio < 0.4 && entriesThisWeek >= 3) || currentCardCount >= 8) {
      const causes = [];

      const assigneeCounts = {};
      column.cards.forEach(card => {
        if (card.assignee) {
          assigneeCounts[card.assignee.name] = (assigneeCounts[card.assignee.name] || 0) + 1;
        }
      });
      const topAssignee = Object.entries(assigneeCounts).sort(([, a], [, b]) => b - a)[0];
      if (topAssignee && topAssignee[1] > currentCardCount * 0.5) {
        causes.push({
          type: 'overloaded_assignee',
          description: `${topAssignee[0]} holds ${topAssignee[1]} of ${currentCardCount} cards (${Math.round(topAssignee[1] / currentCardCount * 100)}%)`,
          assignee: topAssignee[0],
        });
      }

      const labelCounts = {};
      column.cards.forEach(card => {
        card.labels.forEach(cl => {
          labelCounts[cl.label.name] = (labelCounts[cl.label.name] || 0) + 1;
        });
      });
      const topLabel = Object.entries(labelCounts).sort(([, a], [, b]) => b - a)[0];
      if (topLabel && topLabel[1] > currentCardCount * 0.4) {
        causes.push({
          type: 'stuck_label',
          description: `"${topLabel[0]}" tasks account for ${topLabel[1]} of ${currentCardCount} cards`,
          label: topLabel[0],
        });
      }

      const avgAge = column.cards.reduce((sum, card) => {
        return sum + (Date.now() - new Date(card.updatedAt).getTime());
      }, 0) / Math.max(column.cards.length, 1);
      const avgDays = Math.round(avgAge / (1000 * 60 * 60 * 24));

      if (avgDays > 5) {
        causes.push({
          type: 'stale_cards',
          description: `Cards have been sitting here for an average of ${avgDays} days`,
        });
      }

      if (causes.length === 0) {
        causes.push({
          type: 'general_accumulation',
          description: `${currentCardCount} cards accumulated with only ${exitsThisWeek} exits this week`,
        });
      }

      bottlenecks.push({
        columnId: column.id,
        columnName: column.name,
        cardCount: currentCardCount,
        entriesThisWeek,
        exitsThisWeek,
        flowRatio: Math.round(flowRatio * 100) / 100,
        severity: flowRatio < 0.2 ? 'critical' : 'warning',
        causes,
      });
    }
  }

  let aiAnalysis = null;
  if (io && bottlenecks.length > 0) {
    const prompt = `You are an agile project manager analyzing a Kanban board. 
The system has identified the following potential bottlenecks based on flow metrics:
${JSON.stringify(bottlenecks, null, 2)}

Provide a structured analysis. Format your response exactly as a JSON object with this shape:
{
  "summary": "A brief 2-3 sentence summary of the main bottleneck and its actionable solution.",
  "recommendedActions": ["Action 1", "Action 2"]
}
Respond ONLY with the JSON object, no markdown formatting like \`\`\`json.`;

    let aiResponse = '';
    try {
      for await (const chunk of llm.stream(prompt, { temperature: 0.2 })) {
        aiResponse += chunk;
        io.to(`board:${boardId}`).emit('ai:stream', { type: 'bottleneck', chunk });
      }
      aiAnalysis = JSON.parse(aiResponse.replace(/```json\n?|\n?```/g, '').trim());
    } catch (e) {
      console.error('LLM bottleneck analysis failed:', e);
    }
  }

  return { bottlenecks, aiAnalysis };
}

module.exports = { detectBottlenecks };
