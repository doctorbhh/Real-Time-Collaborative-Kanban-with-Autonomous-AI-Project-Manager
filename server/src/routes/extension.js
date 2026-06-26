const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { requireApiKey } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

router.post('/clip', requireApiKey, async (req, res) => {
  try {
    const { title, description, boardId, columnId, referenceUrl } = req.body;
    if (!title || !boardId || !columnId) {
      return res.status(400).json({ error: 'Title, boardId, and columnId are required' });
    }

    const member = await prisma.boardMember.findUnique({
      where: { userId_boardId: { userId: req.userId, boardId } },
    });
    if (!member) {
      return res.status(403).json({ error: 'Not a member of this board' });
    }

    const maxPos = await prisma.card.aggregate({
      where: { columnId },
      _max: { position: true },
    });

    const card = await prisma.card.create({
      data: {
        title,
        description: description || null,
        referenceUrl: referenceUrl || null,
        position: (maxPos._max.position ?? -1) + 1,
        columnId,
      },
      include: {
        labels: { include: { label: true } },
        assignee: { select: { id: true, name: true, avatarUrl: true } },
        _count: { select: { comments: true } },
      },
    });

    await prisma.activity.create({
      data: { action: 'created', details: { source: 'chrome-extension' }, cardId: card.id, userId: req.userId },
    });

    const io = req.app.get('io');
    io.to(boardId).emit('card:created', { card });

    res.status(201).json({ card });
  } catch (err) {
    console.error('Extension clip error:', err);
    res.status(500).json({ error: 'Failed to create card from extension' });
  }
});

router.get('/boards', requireApiKey, async (req, res) => {
  try {
    const boards = await prisma.board.findMany({
      where: { members: { some: { userId: req.userId } } },
      include: {
        columns: { orderBy: { position: 'asc' }, select: { id: true, name: true } },
      },
    });
    res.json({ boards });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch boards' });
  }
});

module.exports = router;
