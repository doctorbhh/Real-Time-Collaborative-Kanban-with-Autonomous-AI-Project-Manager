const llm = require('./llmClient');
const prisma = require('../db');

async function inferComplexity(boardId) {
  const cards = await prisma.card.findMany({
    where: {
      column: { boardId },
      complexity: null,
      complexitySuggested: null,
      description: { not: null },
    },
    include: {
      labels: { include: { label: true } },
    },
    take: 5, 
  });

  if (cards.length === 0) return [];

  const historicalCards = await prisma.card.findMany({
    where: {
      column: { boardId },
      complexity: { not: null },
    },
    select: { title: true, description: true, complexity: true },
    take: 10,
    orderBy: { updatedAt: 'desc' },
  });

  const results = [];

  for (const card of cards) {
    try {
      const labelsStr = card.labels.map(cl => cl.label.name).join(', ') || 'none';
      const historyStr = historicalCards.length > 0
        ? historicalCards.map(h =>
          `- "${h.title}" (${h.description?.slice(0, 80) || 'no desc'}): ${h.complexity} points`
        ).join('\n')
        : 'No historical data available.';

      const prompt = `You are a project manager estimating task complexity.

Given this task card:
Title: ${card.title}
Description: ${card.description?.slice(0, 500) || 'No description'}
Labels: ${labelsStr}

Historical cards with known complexity:
${historyStr}

Estimate complexity on a 1-5 scale where:
1 = trivial (< 1 hour, simple text change, config update)
2 = small (1-4 hours, single component change)
3 = medium (1-2 days, multiple components, some testing)
4 = large (3-5 days, cross-cutting concerns, significant testing)
5 = epic (1+ week, major feature, architecture changes)

Return ONLY valid JSON: { "score": <number>, "reasoning": "<one sentence>" }`;

      const response = await llm.complete(prompt, { maxTokens: 200, temperature: 0.2 });

      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        const score = Math.min(5, Math.max(1, Math.round(parsed.score)));

        await prisma.card.update({
          where: { id: card.id },
          data: { complexitySuggested: score },
        });

        results.push({
          cardId: card.id,
          cardTitle: card.title,
          suggestedComplexity: score,
          reasoning: parsed.reasoning || 'Based on description analysis',
        });
      }
    } catch (err) {
      console.error(`Complexity inference failed for card ${card.id}:`, err.message);
    }
  }

  return results;
}

async function inferSingleCardComplexity(cardId, boardId, io) {
  const card = await prisma.card.findUnique({
    where: { id: cardId },
    include: { labels: { include: { label: true } } },
  });

  if (!card || !card.description || card.description.length < 20 || card.complexity || card.complexitySuggested) {
    return null;
  }

  const historicalCards = await prisma.card.findMany({
    where: {
      column: { boardId },
      complexity: { not: null },
    },
    select: { title: true, description: true, complexity: true },
    take: 10,
    orderBy: { updatedAt: 'desc' },
  });

  try {
    const labelsStr = card.labels.map(cl => cl.label.name).join(', ') || 'none';
    const historyStr = historicalCards.length > 0
      ? historicalCards.map(h =>
        `- "${h.title}" (${h.description?.slice(0, 80) || 'no desc'}): ${h.complexity} points`
      ).join('\n')
      : 'No historical data available.';

    const prompt = `You are a project manager estimating task complexity.

Given this task card:
Title: ${card.title}
Description: ${card.description?.slice(0, 500)}
Labels: ${labelsStr}

Historical cards with known complexity:
${historyStr}

Estimate complexity on a 1-5 scale where:
1 = trivial (< 1 hour, simple text change, config update)
2 = small (1-4 hours, single component change)
3 = medium (1-2 days, multiple components, some testing)
4 = large (3-5 days, cross-cutting concerns, significant testing)
5 = epic (1+ week, major feature, architecture changes)

Return ONLY valid JSON: { "score": <number>, "reasoning": "<one sentence>" }`;

    const response = await llm.complete(prompt, { maxTokens: 200, temperature: 0.2 });

    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      const score = Math.min(5, Math.max(1, Math.round(parsed.score)));

      await prisma.card.update({
        where: { id: card.id },
        data: { complexitySuggested: score },
      });

      if (io) {
        io.to(`board:${boardId}`).emit('card:complexity:suggested', {
          cardId: card.id,
          complexity: score,
          reasoning: parsed.reasoning || 'Based on description analysis',
        });
      }

      return score;
    }
  } catch (err) {
    console.error(`Complexity inference failed for single card ${card.id}:`, err.message);
  }
  return null;
}

module.exports = { inferComplexity, inferSingleCardComplexity };
