const express = require('express');
const { requireAuth, requireBoardMember } = require('../middleware/auth');

const router = express.Router();
const prisma = require('../db');

router.post('/:boardId/columns', requireAuth, requireBoardMember, async (req, res) => {
  try {
    const { name, wipLimit } = req.body;
    if (!name) return res.status(400).json({ error: 'Column name is required' });

    const maxPos = await prisma.column.aggregate({
      where: { boardId: req.params.boardId },
      _max: { order: true },
    });

    const column = await prisma.column.create({
      data: {
        name,
        order: (maxPos._max.order ?? -1) + 1,
        wipLimit: wipLimit || null,
        boardId: req.params.boardId,
      },
      include: { cards: true },
    });

    const io = req.app.get('io');
    io.to(`board:${req.params.boardId}`).emit('column:created', { column });

    res.status(201).json({ column });
  } catch (err) {
    console.error('Create column error:', err);
    res.status(500).json({ error: 'Failed to create column' });
  }
});

router.patch('/:boardId/columns/:columnId', requireAuth, requireBoardMember, async (req, res) => {
  try {
    const { name, wipLimit } = req.body;
    const column = await prisma.column.update({
      where: { id: req.params.columnId },
      data: {
        ...(name && { name }),
        ...(wipLimit !== undefined && { wipLimit }),
      },
    });

    const io = req.app.get('io');
    io.to(`board:${req.params.boardId}`).emit('column:updated', { columnId: column.id, changes: { name, wipLimit } });

    res.json({ column });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update column' });
  }
});

router.patch('/:boardId/columns-reorder', requireAuth, requireBoardMember, async (req, res) => {
  try {
    const { columns } = req.body; 
    await prisma.$transaction(
      columns.map(({ id, order }) =>
        prisma.column.update({ where: { id }, data: { order } })
      )
    );

    const io = req.app.get('io');
    io.to(`board:${req.params.boardId}`).emit('column:reordered', { columns });

    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to reorder columns' });
  }
});

router.delete('/:boardId/columns/:columnId', requireAuth, requireBoardMember, async (req, res) => {
  try {
    await prisma.column.delete({ where: { id: req.params.columnId } });

    const io = req.app.get('io');
    io.to(`board:${req.params.boardId}`).emit('column:deleted', { columnId: req.params.columnId });

    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete column' });
  }
});

module.exports = router;
