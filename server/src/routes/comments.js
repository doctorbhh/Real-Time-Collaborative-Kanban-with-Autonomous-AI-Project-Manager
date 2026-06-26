const express = require('express');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
const prisma = require('../db');

router.get('/:cardId/comments', requireAuth, async (req, res) => {
  try {
    const comments = await prisma.comment.findMany({
      where: { cardId: req.params.cardId },
      include: { user: { select: { id: true, name: true, avatarUrl: true } } },
      orderBy: { createdAt: 'asc' },
    });
    res.json({ comments });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch comments' });
  }
});

router.post('/:cardId/comments', requireAuth, async (req, res) => {
  try {
    const { text } = req.body;
    if (!text) return res.status(400).json({ error: 'Comment text is required' });

    const comment = await prisma.comment.create({
      data: { text, cardId: req.params.cardId, userId: req.userId },
      include: { user: { select: { id: true, name: true, avatarUrl: true } } },
    });

    const card = await prisma.card.findUnique({
      where: { id: req.params.cardId },
      include: { column: { select: { boardId: true } } },
    });
    if (card) {
      const io = req.app.get('io');
      io.to(`board:${card.column.boardId}`).emit('comment:added', { cardId: req.params.cardId, comment });
    }

    res.status(201).json({ comment });
  } catch (err) {
    res.status(500).json({ error: 'Failed to add comment' });
  }
});

router.delete('/:cardId/comments/:commentId', requireAuth, async (req, res) => {
  try {
    const comment = await prisma.comment.findUnique({ where: { id: req.params.commentId } });
    if (!comment || comment.userId !== req.userId) {
      return res.status(403).json({ error: 'Cannot delete this comment' });
    }
    await prisma.comment.delete({ where: { id: req.params.commentId } });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete comment' });
  }
});

module.exports = router;
