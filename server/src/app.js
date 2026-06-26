const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const session = require('express-session');
const path = require('path');

const authRoutes = require('./routes/auth');
const boardRoutes = require('./routes/boards');
const columnRoutes = require('./routes/columns');
const cardRoutes = require('./routes/cards');
const labelRoutes = require('./routes/labels');
const commentRoutes = require('./routes/comments');
const githubRoutes = require('./routes/github');
const aiRoutes = require('./routes/ai');
const extRoutes = require('./routes/extension');

const app = express();

app.use(helmet({ contentSecurityPolicy: false }));
app.use(compression());

app.use(cors({
  origin: [
    process.env.CLIENT_URL || 'http://localhost:5173',
    /^chrome-extension:\/\//,
  ],
  credentials: true,
}));

if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('short'));
}

app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true }));

app.use(session({
  secret: process.env.SESSION_SECRET || 'dev-secret-change-me',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 7 * 24 * 60 * 60 * 1000, 
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
  },
}));

app.use('/api/auth', authRoutes);
app.use('/api/boards', boardRoutes);
app.use('/api/boards', columnRoutes);
app.use('/api/boards', cardRoutes);
app.use('/api/boards', labelRoutes);
app.use('/api/cards', commentRoutes);
app.use('/api/boards', githubRoutes);
app.use('/api/boards', aiRoutes);
app.use('/api/ext', extRoutes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../public')));
  app.get('*', (req, res) => {
    if (!req.path.startsWith('/api')) {
      res.sendFile(path.join(__dirname, '../public/index.html'));
    }
  });
}

app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
});

module.exports = app;
