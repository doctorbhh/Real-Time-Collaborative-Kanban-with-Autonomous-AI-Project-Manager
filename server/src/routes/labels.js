const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { requireAuth, requireBoardMember } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

router.post('/:boardId/labels', requireAuth, requireBoardMember, async (req, res) => {
  try {
    const { name, color } = req.body;
    if (!name || !color) return res.status(400).json({ error: 'Name and color are required' });

    const label = await prisma.label.create({
      data: { name, color, boardId: req.params.boardId },
    });
    res.status(201).json({ label });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create label' });
  }
});

router.get('/:boardId/labels', requireAuth, requireBoardMember, async (req, res) => {
  try {
    const labels = await prisma.label.findMany({
      where: { boardId: req.params.boardId },
      include: { _count: { select: { cards: true } } },
    });
    res.json({ labels });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch labels' });
  }
});

router.delete('/:boardId/labels/:labelId', requireAuth, requireBoardMember, async (req, res) => {
  try {
    await prisma.label.delete({ where: { id: req.params.labelId } });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete label' });
  }
});

module.exports = router;
