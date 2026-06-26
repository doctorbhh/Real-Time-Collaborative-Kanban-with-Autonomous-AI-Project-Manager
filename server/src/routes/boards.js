const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { requireAuth, requireBoardMember } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

router.post('/', requireAuth, async (req, res) => {
  try {
    const { name, description, sprintEndDate } = req.body;
    if (!name) return res.status(400).json({ error: 'Board name is required' });

    const board = await prisma.board.create({
      data: {
        name,
        description,
        sprintEndDate: sprintEndDate ? new Date(sprintEndDate) : null,
        columns: {
          create: [
            { name: 'Backlog', position: 0 },
            { name: 'To Do', position: 1 },
            { name: 'In Progress', position: 2 },
            { name: 'Review', position: 3 },
            { name: 'Done', position: 4 },
          ],
        },
        members: {
          create: { userId: req.userId, role: 'owner' },
        },
        labels: {
          create: [
            { name: 'Bug', color: '#ba1a1a' },
            { name: 'Feature', color: '#2c2abc' },
            { name: 'Enhancement', color: '#006c49' },
            { name: 'Documentation', color: '#623c00' },
            { name: 'Urgent', color: '#ba1a1a' },
          ],
        },
      },
      include: {
        columns: { orderBy: { position: 'asc' } },
        members: { include: { user: { select: { id: true, name: true, email: true, avatarUrl: true } } } },
        labels: true,
      },
    });

    res.status(201).json({ board });
  } catch (err) {
    console.error('Create board error:', err);
    res.status(500).json({ error: 'Failed to create board' });
  }
});

router.get('/', requireAuth, async (req, res) => {
  try {
    const boards = await prisma.board.findMany({
      where: { members: { some: { userId: req.userId } } },
      include: {
        columns: {
          orderBy: { position: 'asc' },
          include: { _count: { select: { cards: true } } },
        },
        members: { include: { user: { select: { id: true, name: true, avatarUrl: true } } } },
        _count: { select: { aiInsights: { where: { status: 'pending' } } } },
      },
      orderBy: { updatedAt: 'desc' },
    });
    res.json({ boards });
  } catch (err) {
    console.error('List boards error:', err);
    res.status(500).json({ error: 'Failed to fetch boards' });
  }
});

router.get('/:boardId/full', requireAuth, requireBoardMember, async (req, res) => {
  try {
    const board = await prisma.board.findUnique({
      where: { id: req.params.boardId },
      include: {
        columns: {
          orderBy: { position: 'asc' },
          include: {
            cards: {
              orderBy: { position: 'asc' },
              include: {
                labels: { include: { label: true } },
                assignee: { select: { id: true, name: true, avatarUrl: true } },
                _count: { select: { comments: true } },
              },
            },
          },
        },
        members: {
          include: {
            user: { select: { id: true, name: true, email: true, avatarUrl: true, githubUsername: true } },
          },
        },
        labels: true,
      },
    });

    if (!board) return res.status(404).json({ error: 'Board not found' });
    res.json({ board });
  } catch (err) {
    console.error('Get board error:', err);
    res.status(500).json({ error: 'Failed to fetch board' });
  }
});

router.patch('/:boardId', requireAuth, requireBoardMember, async (req, res) => {
  try {
    const { name, description, sprintEndDate, aiSchedule } = req.body;
    const board = await prisma.board.update({
      where: { id: req.params.boardId },
      data: {
        ...(name && { name }),
        ...(description !== undefined && { description }),
        ...(sprintEndDate !== undefined && { sprintEndDate: sprintEndDate ? new Date(sprintEndDate) : null }),
        ...(aiSchedule && { aiSchedule }),
      },
    });
    res.json({ board });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update board' });
  }
});

router.delete('/:boardId', requireAuth, requireBoardMember, async (req, res) => {
  try {
    if (req.boardRole !== 'owner') {
      return res.status(403).json({ error: 'Only the board owner can delete it' });
    }
    await prisma.board.delete({ where: { id: req.params.boardId } });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete board' });
  }
});

router.post('/:boardId/members', requireAuth, requireBoardMember, async (req, res) => {
  try {
    const { email } = req.body;
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.status(404).json({ error: 'User not found' });

    const member = await prisma.boardMember.create({
      data: { userId: user.id, boardId: req.params.boardId },
      include: { user: { select: { id: true, name: true, email: true, avatarUrl: true } } },
    });
    res.status(201).json({ member });
  } catch (err) {
    if (err.code === 'P2002') return res.status(409).json({ error: 'User is already a member' });
    res.status(500).json({ error: 'Failed to add member' });
  }
});

module.exports = router;
