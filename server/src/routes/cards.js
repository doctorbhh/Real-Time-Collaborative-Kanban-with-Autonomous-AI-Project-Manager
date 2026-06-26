const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { requireAuth, requireBoardMember } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

router.post('/:boardId/cards', requireAuth, requireBoardMember, async (req, res) => {
  try {
    const { title, description, columnId, assigneeId, labelIds, referenceUrl } = req.body;
    if (!title || !columnId) {
      return res.status(400).json({ error: 'Title and columnId are required' });
    }

    const maxPos = await prisma.card.aggregate({
      where: { columnId },
      _max: { position: true },
    });

    const card = await prisma.card.create({
      data: {
        title,
        description: description || null,
        position: (maxPos._max.position ?? -1) + 1,
        columnId,
        assigneeId: assigneeId || null,
        referenceUrl: referenceUrl || null,
        labels: labelIds?.length ? {
          create: labelIds.map(labelId => ({ labelId })),
        } : undefined,
      },
      include: {
        labels: { include: { label: true } },
        assignee: { select: { id: true, name: true, avatarUrl: true } },
        _count: { select: { comments: true } },
      },
    });

    await prisma.activity.create({
      data: { action: 'created', cardId: card.id, userId: req.userId },
    });

    const io = req.app.get('io');
    io.to(req.params.boardId).emit('card:created', { card });

    res.status(201).json({ card });
  } catch (err) {
    console.error('Create card error:', err);
    res.status(500).json({ error: 'Failed to create card' });
  }
});

router.get('/:boardId/cards/:cardId', requireAuth, requireBoardMember, async (req, res) => {
  try {
    const card = await prisma.card.findUnique({
      where: { id: req.params.cardId },
      include: {
        labels: { include: { label: true } },
        assignee: { select: { id: true, name: true, avatarUrl: true, email: true } },
        comments: {
          include: { user: { select: { id: true, name: true, avatarUrl: true } } },
          orderBy: { createdAt: 'asc' },
        },
        activities: {
          include: { user: { select: { id: true, name: true } } },
          orderBy: { createdAt: 'desc' },
          take: 20,
        },
        column: { select: { id: true, name: true } },
      },
    });

    if (!card) return res.status(404).json({ error: 'Card not found' });
    res.json({ card });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch card' });
  }
});

router.patch('/:boardId/cards/:cardId', requireAuth, requireBoardMember, async (req, res) => {
  try {
    const { title, description, assigneeId, complexity, complexitySuggested, version, labelIds } = req.body;

    if (version !== undefined) {
      const existing = await prisma.card.findUnique({ where: { id: req.params.cardId } });
      if (existing && existing.version !== version) {
        return res.status(409).json({
          error: 'Conflict detected',
          serverVersion: existing.version,
          serverData: existing,
        });
      }
    }

    const updateData = { version: { increment: 1 } };
    if (title !== undefined) updateData.title = title;
    if (description !== undefined) updateData.description = description;
    if (assigneeId !== undefined) updateData.assigneeId = assigneeId || null;
    if (complexity !== undefined) updateData.complexity = complexity;
    if (complexitySuggested !== undefined) updateData.complexitySuggested = complexitySuggested;

    const card = await prisma.card.update({
      where: { id: req.params.cardId },
      data: updateData,
      include: {
        labels: { include: { label: true } },
        assignee: { select: { id: true, name: true, avatarUrl: true } },
        _count: { select: { comments: true } },
      },
    });

    if (labelIds !== undefined) {
      await prisma.cardLabel.deleteMany({ where: { cardId: card.id } });
      if (labelIds.length > 0) {
        await prisma.cardLabel.createMany({
          data: labelIds.map(labelId => ({ cardId: card.id, labelId })),
        });
      }
    }

    await prisma.activity.create({
      data: {
        action: 'edited',
        details: { fields: Object.keys(req.body).filter(k => k !== 'version') },
        cardId: card.id,
        userId: req.userId,
      },
    });

    const io = req.app.get('io');
    io.to(req.params.boardId).emit('card:updated', { card });

    res.json({ card });
  } catch (err) {
    console.error('Update card error:', err);
    res.status(500).json({ error: 'Failed to update card' });
  }
});

router.patch('/:boardId/cards/:cardId/move', requireAuth, requireBoardMember, async (req, res) => {
  try {
    const { toColumnId, newPosition } = req.body;
    const card = await prisma.card.findUnique({ where: { id: req.params.cardId } });
    if (!card) return res.status(404).json({ error: 'Card not found' });

    const fromColumnId = card.columnId;

    await prisma.$transaction(async (tx) => {
      if (fromColumnId !== toColumnId) {
        await tx.card.updateMany({
          where: { columnId: fromColumnId, position: { gt: card.position } },
          data: { position: { decrement: 1 } },
        });
        await tx.card.updateMany({
          where: { columnId: toColumnId, position: { gte: newPosition } },
          data: { position: { increment: 1 } },
        });
      } else {
        if (newPosition > card.position) {
          await tx.card.updateMany({
            where: { columnId: toColumnId, position: { gt: card.position, lte: newPosition } },
            data: { position: { decrement: 1 } },
          });
        } else if (newPosition < card.position) {
          await tx.card.updateMany({
            where: { columnId: toColumnId, position: { gte: newPosition, lt: card.position } },
            data: { position: { increment: 1 } },
          });
        }
      }

      await tx.card.update({
        where: { id: req.params.cardId },
        data: { columnId: toColumnId, position: newPosition, version: { increment: 1 } },
      });

      await tx.activity.create({
        data: {
          action: 'moved',
          details: { fromColumnId, toColumnId },
          cardId: req.params.cardId,
          userId: req.userId,
        },
      });
    });

    const io = req.app.get('io');
    io.to(req.params.boardId).emit('card:moved', {
      cardId: req.params.cardId,
      fromColumnId,
      toColumnId,
      newPosition,
    });

    res.json({ ok: true });
  } catch (err) {
    console.error('Move card error:', err);
    res.status(500).json({ error: 'Failed to move card' });
  }
});

router.delete('/:boardId/cards/:cardId', requireAuth, requireBoardMember, async (req, res) => {
  try {
    await prisma.card.delete({ where: { id: req.params.cardId } });

    const io = req.app.get('io');
    io.to(req.params.boardId).emit('card:deleted', { cardId: req.params.cardId });

    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete card' });
  }
});

module.exports = router;
