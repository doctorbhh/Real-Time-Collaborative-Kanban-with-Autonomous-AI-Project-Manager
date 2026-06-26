const express = require('express');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const { PrismaClient } = require('@prisma/client');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

router.post('/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Name, email, and password are required' });
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const apiKey = uuidv4();

    const user = await prisma.user.create({
      data: { name, email, passwordHash, apiKey },
      select: { id: true, name: true, email: true, apiKey: true, avatarUrl: true },
    });

    req.session.userId = user.id;
    res.status(201).json({ user });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Registration failed' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    req.session.userId = user.id;
    res.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        apiKey: user.apiKey,
        avatarUrl: user.avatarUrl,
        githubUsername: user.githubUsername,
      },
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Login failed' });
  }
});

router.post('/logout', (req, res) => {
  req.session.destroy();
  res.json({ ok: true });
});

router.get('/me', requireAuth, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: { id: true, name: true, email: true, apiKey: true, avatarUrl: true, githubUsername: true },
    });
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ user });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

router.patch('/me', requireAuth, async (req, res) => {
  try {
    const { name, githubUsername, avatarUrl } = req.body;
    const user = await prisma.user.update({
      where: { id: req.userId },
      data: { ...(name && { name }), ...(githubUsername && { githubUsername }), ...(avatarUrl && { avatarUrl }) },
      select: { id: true, name: true, email: true, apiKey: true, avatarUrl: true, githubUsername: true },
    });
    res.json({ user });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

module.exports = router;
