const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  const passwordHash = await bcrypt.hash('demo123', 12);

  const alice = await prisma.user.upsert({
    where: { email: 'alice@demo.com' },
    update: {},
    create: {
      name: 'Alice Chen',
      email: 'alice@demo.com',
      passwordHash,
      apiKey: uuidv4(),
      githubUsername: 'alicechen',
    },
  });

  const bob = await prisma.user.upsert({
    where: { email: 'bob@demo.com' },
    update: {},
    create: {
      name: 'Bob Martinez',
      email: 'bob@demo.com',
      passwordHash,
      apiKey: uuidv4(),
      githubUsername: 'bobmartinez',
    },
  });

  const carol = await prisma.user.upsert({
    where: { email: 'carol@demo.com' },
    update: {},
    create: {
      name: 'Carol Johnson',
      email: 'carol@demo.com',
      passwordHash,
      apiKey: uuidv4(),
    },
  });

  const board = await prisma.board.create({
    data: {
      name: 'Sprint 12 — Launch Features',
      description: 'Main development board for Sprint 12',
      sprintEndDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 2 weeks from now
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
        create: [
          { userId: alice.id, role: 'owner' },
          { userId: bob.id, role: 'member' },
          { userId: carol.id, role: 'member' },
        ],
      },
      labels: {
        create: [
          { name: 'Bug', color: '#ba1a1a' },
          { name: 'Feature', color: '#2c2abc' },
          { name: 'Enhancement', color: '#006c49' },
          { name: 'Documentation', color: '#623c00' },
          { name: 'Urgent', color: '#ba1a1a' },
          { name: 'Backend', color: '#4648d4' },
          { name: 'Frontend', color: '#006c49' },
        ],
      },
    },
    include: {
      columns: { orderBy: { position: 'asc' } },
      labels: true,
    },
  });

  const [backlog, todo, inProgress, review, done] = board.columns;
  const labelMap = {};
  board.labels.forEach(l => { labelMap[l.name] = l.id; });

  const cards = [
    { title: 'Implement user authentication', desc: 'Add JWT-based auth with refresh tokens', col: done, assignee: alice, labels: ['Feature', 'Backend'], complexity: 3 },
    { title: 'Design dashboard UI mockups', desc: 'Create Figma mockups for the main dashboard view', col: done, assignee: carol, labels: ['Feature', 'Frontend'], complexity: 2 },
    { title: 'Setup CI/CD pipeline', desc: 'Configure GitHub Actions for automated testing and deployment', col: review, assignee: bob, labels: ['Enhancement', 'Backend'], complexity: 3 },
    { title: 'Fix login redirect loop', desc: 'Users stuck in redirect loop when session expires', col: review, assignee: alice, labels: ['Bug', 'Urgent'], complexity: 2 },
    { title: 'Add drag and drop to board', desc: 'Implement card drag-and-drop with @dnd-kit for column reordering', col: inProgress, assignee: carol, labels: ['Feature', 'Frontend'], complexity: 4 },
    { title: 'WebSocket event broadcasting', desc: 'Setup Socket.io rooms for real-time board sync across multiple clients', col: inProgress, assignee: bob, labels: ['Feature', 'Backend'], complexity: 4 },
    { title: 'Rate limit API endpoints', desc: 'Add express-rate-limit to prevent API abuse', col: inProgress, assignee: alice, labels: ['Enhancement', 'Backend'], complexity: 2 },
    { title: 'Build AI insights panel', desc: 'Create sidebar component to display streaming AI analysis results', col: todo, assignee: carol, labels: ['Feature', 'Frontend'] },
    { title: 'Implement bottleneck detection', desc: 'Analyze column flow rates to identify stuck cards and overloaded assignees', col: todo, assignee: bob, labels: ['Feature', 'Backend'] },
    { title: 'Chrome extension popup UI', desc: 'Build the extension popup with board selector and clip form', col: todo, labels: ['Feature', 'Frontend'] },
    { title: 'GitHub Issues scraper', desc: 'Fetch and import open issues from public repos with pagination', col: todo, assignee: alice, labels: ['Feature', 'Backend'] },
    { title: 'Add dark mode toggle', desc: 'Allow users to switch between light and dark themes', col: backlog, labels: ['Enhancement', 'Frontend'] },
    { title: 'Write API documentation', desc: 'Document all REST endpoints using OpenAPI/Swagger format', col: backlog, labels: ['Documentation'] },
    { title: 'Mobile responsive layout', desc: 'Ensure all views work on tablet and mobile screen sizes', col: backlog, labels: ['Enhancement', 'Frontend'] },
    { title: 'Team velocity charts', desc: 'Add burndown and velocity chart components using CSS-based charts', col: backlog, labels: ['Feature', 'Frontend'] },
  ];

  for (let i = 0; i < cards.length; i++) {
    const c = cards[i];
    await prisma.card.create({
      data: {
        title: c.title,
        description: c.desc,
        position: i % 5,
        complexity: c.complexity || null,
        columnId: c.col.id,
        assigneeId: c.assignee?.id || null,
        labels: {
          create: (c.labels || []).map(name => ({ labelId: labelMap[name] })),
        },
      },
    });
  }

  const inProgressCards = await prisma.card.findMany({ where: { columnId: inProgress.id } });
  for (const card of inProgressCards) {
    await prisma.activity.create({
      data: {
        action: 'moved',
        details: { fromColumnId: todo.id, toColumnId: inProgress.id },
        cardId: card.id,
        userId: card.assigneeId,
      },
    });
  }

  const doneCards = await prisma.card.findMany({ where: { columnId: done.id } });
  for (const card of doneCards) {
    await prisma.activity.create({
      data: {
        action: 'moved',
        details: { fromColumnId: review.id, toColumnId: done.id },
        cardId: card.id,
        userId: card.assigneeId,
      },
    });
  }

  console.log('Seed complete!');
  console.log(`   Board: "${board.name}"`);
  console.log(`   Users: alice@demo.com, bob@demo.com, carol@demo.com (password: demo123)`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
