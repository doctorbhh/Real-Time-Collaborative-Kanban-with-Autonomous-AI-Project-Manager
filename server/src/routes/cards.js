const express = require('express');
const { requireAuth, requireBoardMember } = require('../middleware/auth');
const { inferSingleCardComplexity } = require('../ai/complexity');

const router = express.Router();
const prisma = require('../db');

router.post('/:boardId/cards', requireAuth, requireBoardMember, async (req, res) => {
  try {
    const { title, description, columnId, assigneeId, labelIds, referenceUrl } = req.body;
    if (!title || !columnId) {
      return res.status(400).json({ error: 'Title and columnId are required' });
    }

    const maxPos = await prisma.card.aggregate({
      where: { columnId },
      _max: { order: true },
    });

    const card = await prisma.card.create({
      data: {
        title,
        description: description || null,
        order: (maxPos._max.order ?? -1) + 1,
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
    io.to(`board:${req.params.boardId}`).emit('card:created', { card });

    res.status(201).json({ card });

    inferSingleCardComplexity(card.id, req.params.boardId, io).catch(err => {
      console.error('Non-blocking complexity inference failed:', err);
    });
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
    const { title, description, assigneeId, complexity, complexitySuggested, baseVersion, labelIds } = req.body;

    const existing = await prisma.card.findUnique({ where: { id: req.params.cardId } });
    if (!existing) return res.status(404).json({ error: 'Card not found' });

    let conflictDetected = false;
    if (baseVersion !== undefined && existing.version !== baseVersion) {
      conflictDetected = true;
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

    let finalCard = card;
    if (labelIds !== undefined) {
      await prisma.cardLabel.deleteMany({ where: { cardId: card.id } });
      if (labelIds.length > 0) {
        await prisma.cardLabel.createMany({
          data: labelIds.map(labelId => ({ cardId: card.id, labelId })),
        });
      }
      finalCard = await prisma.card.findUnique({
        where: { id: req.params.cardId },
        include: {
          labels: { include: { label: true } },
          assignee: { select: { id: true, name: true, avatarUrl: true } },
          _count: { select: { comments: true } },
        }
      });
    }

    const user = await prisma.user.findUnique({ where: { id: req.userId }, select: { name: true } });

    await prisma.activity.create({
      data: {
        action: 'edited',
        details: { fields: Object.keys(req.body).filter(k => k !== 'baseVersion') },
        cardId: finalCard.id,
        userId: req.userId,
      },
    });

    const io = req.app.get('io');
    io.to(`board:${req.params.boardId}`).emit('card:updated', { 
      card: finalCard, 
      conflictDetected, 
      updatedBy: user?.name 
    });

    res.json({ card: finalCard, conflictDetected });
  } catch (err) {
    console.error('Update card error:', err);
    res.status(500).json({ error: 'Failed to update card' });
  }
});

router.patch('/:boardId/cards/:cardId/move', requireAuth, requireBoardMember, async (req, res) => {
  try {
    const { toColumnId, order } = req.body;
    const existingCard = await prisma.card.findUnique({ where: { id: req.params.cardId } });
    if (!existingCard) return res.status(404).json({ error: 'Card not found' });

    const fromColumnId = existingCard.columnId;

    let finalOrder = order;

    const card = await prisma.$transaction(async (tx) => {
      const updatedCard = await tx.card.update({
        where: { id: req.params.cardId },
        data: { 
          columnId: toColumnId, 
          order: finalOrder, 
          movedAt: new Date(),
          version: { increment: 1 } 
        },
        include: {
          labels: { include: { label: true } },
          assignee: { select: { id: true, name: true, avatarUrl: true } },
          _count: { select: { comments: true } },
        }
      });

      await tx.activity.create({
        data: {
          action: 'moved',
          details: { fromColumnId, toColumnId },
          cardId: req.params.cardId,
          userId: req.userId,
        },
      });

      const cardsInColumn = await tx.card.findMany({ 
        where: { columnId: toColumnId }, 
        orderBy: { order: 'asc' } 
      });
      
      let minGap = Infinity;
      for (let i = 1; i < cardsInColumn.length; i++) {
        const gap = cardsInColumn[i].order - cardsInColumn[i-1].order;
        if (gap < minGap) minGap = gap;
      }

      if (minGap < 0.001 && cardsInColumn.length > 1) {
        console.log(`Rebalancing column ${toColumnId} due to low gap ${minGap}`);
        for (let i = 0; i < cardsInColumn.length; i++) {
          const newOrder = (i + 1) * 1.0;
          await tx.card.update({ 
            where: { id: cardsInColumn[i].id }, 
            data: { order: newOrder } 
          });
          if (cardsInColumn[i].id === req.params.cardId) {
            updatedCard.order = newOrder;
            finalOrder = newOrder;
          }
        }
      }

      return updatedCard;
    });

    const user = await prisma.user.findUnique({ where: { id: req.userId }, select: { name: true } });

    const io = req.app.get('io');
    io.to(`board:${req.params.boardId}`).emit('card:moved', {
      cardId: req.params.cardId,
      fromColumnId,
      toColumnId,
      order: finalOrder,
      card,
      movedBy: user?.name,
    });

    res.json({ ok: true, card });
  } catch (err) {
    console.error('Move card error:', err);
    res.status(500).json({ error: 'Failed to move card' });
  }
});

router.delete('/:boardId/cards/:cardId', requireAuth, requireBoardMember, async (req, res) => {
  try {
    const card = await prisma.card.findUnique({ where: { id: req.params.cardId } });
    if (!card) return res.status(404).json({ error: 'Card not found' });
    
    await prisma.card.delete({ where: { id: req.params.cardId } });

    const io = req.app.get('io');
    io.to(`board:${req.params.boardId}`).emit('card:deleted', { 
      cardId: req.params.cardId,
      columnId: card.columnId 
    });

    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete card' });
  }
});

module.exports = router;
