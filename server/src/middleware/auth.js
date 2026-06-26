const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

function requireAuth(req, res, next) {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  req.userId = req.session.userId;
  next();
}

async function requireApiKey(req, res, next) {
  const apiKey = req.headers.authorization?.replace('Bearer ', '');
  if (!apiKey) {
    return res.status(401).json({ error: 'API key required' });
  }
  const user = await prisma.user.findUnique({ where: { apiKey } });
  if (!user) {
    return res.status(401).json({ error: 'Invalid API key' });
  }
  req.userId = user.id;
  req.user = user;
  next();
}

async function requireBoardMember(req, res, next) {
  const boardId = req.params.boardId || req.body.boardId;
  if (!boardId) return next();

  const member = await prisma.boardMember.findUnique({
    where: { userId_boardId: { userId: req.userId, boardId } },
  });
  if (!member) {
    return res.status(403).json({ error: 'Not a member of this board' });
  }
  req.boardRole = member.role;
  next();
}

module.exports = { requireAuth, requireApiKey, requireBoardMember };
