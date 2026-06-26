const express = require('express');
const { requireAuth, requireBoardMember } = require('../middleware/auth');
const { runPipeline } = require('../ai/pipeline');

const router = express.Router();
const prisma = require('../db');

router.get('/:boardId/ai/insights', requireAuth, requireBoardMember, async (req, res) => {
  try {
    const insights = await prisma.aiInsight.findMany({
      where: { boardId: req.params.boardId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    res.json({ insights });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch AI insights' });
  }
});

router.patch('/:boardId/ai/insights/:insightId', requireAuth, requireBoardMember, async (req, res) => {
  try {
    const { status } = req.body; 
    if (!['accepted', 'dismissed'].includes(status)) {
      return res.status(400).json({ error: 'Status must be accepted or dismissed' });
    }

    const insight = await prisma.aiInsight.update({
      where: { id: req.params.insightId },
      data: { status },
    });

    if (status === 'accepted' && insight.type === 'complexity' && insight.data.cardId) {
      await prisma.card.update({
        where: { id: insight.data.cardId },
        data: { complexity: insight.data.suggestedComplexity, complexityInferred: true },
      });
    }

    if (status === 'accepted' && insight.type === 'auto_assign' && insight.data.cardId) {
      const updatedCard = await prisma.card.update({
        where: { id: insight.data.cardId },
        data: { assigneeId: insight.data.suggestedAssigneeId },
        include: {
          labels: { include: { label: true } },
          assignee: true,
        },
      });
      const io = req.app.get('io');
      io.to(`board:${req.params.boardId}`).emit('card:updated', { card: updatedCard });
    }

    const io = req.app.get('io');
    io.to(`board:${req.params.boardId}`).emit('ai:insight-updated', { insight });

    res.json({ insight });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update insight' });
  }
});

router.post('/:boardId/ai/run', requireAuth, requireBoardMember, async (req, res) => {
  try {
    const io = req.app.get('io');
    res.json({ ok: true, message: 'AI analysis started' });

    runPipeline(req.params.boardId, io).catch(err => {
      console.error('AI pipeline error:', err);
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to start AI analysis' });
  }
});

router.get('/:boardId/ai/digest', requireAuth, requireBoardMember, async (req, res) => {
  try {
    const reports = await prisma.digestReport.findMany({
      where: { boardId: req.params.boardId },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });
    res.json({ reports });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch digest reports' });
  }
});

router.get('/:boardId/team-stats', requireAuth, requireBoardMember, async (req, res) => {
  try {
    const members = await prisma.boardMember.findMany({
      where: { boardId: req.params.boardId },
      include: {
        user: { select: { id: true, name: true, email: true, avatarUrl: true } },
      },
    });

    const stats = await Promise.all(members.map(async (member) => {
      const inProgressCount = await prisma.card.count({
        where: {
          assigneeId: member.user.id,
          column: { boardId: req.params.boardId, name: { not: 'Done' } },
        },
      });

      const completedCount = await prisma.card.count({
        where: {
          assigneeId: member.user.id,
          column: { boardId: req.params.boardId, name: 'Done' },
        },
      });

      const labelStats = await prisma.cardLabel.findMany({
        where: {
          card: {
            assigneeId: member.user.id,
            column: { boardId: req.params.boardId },
          },
        },
        include: { label: true },
      });

      const labelCounts = {};
      labelStats.forEach(cl => {
        labelCounts[cl.label.name] = (labelCounts[cl.label.name] || 0) + 1;
      });
      const topLabels = Object.entries(labelCounts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 3)
        .map(([name, count]) => ({ name, count }));

      const recentActivityCount = await prisma.activity.count({
        where: {
          userId: member.user.id,
          card: { column: { boardId: req.params.boardId } },
          createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
        },
      });

      return {
        user: member.user,
        role: member.role,
        inProgressCount,
        completedCount,
        topLabels,
        recentActivityCount,
        completionRate: completedCount + inProgressCount > 0
          ? Math.round((completedCount / (completedCount + inProgressCount)) * 100)
          : 0,
      };
    }));

    res.json({ stats });
  } catch (err) {
    console.error('Team stats error:', err);
    res.status(500).json({ error: 'Failed to fetch team stats' });
  }
});

module.exports = router;
