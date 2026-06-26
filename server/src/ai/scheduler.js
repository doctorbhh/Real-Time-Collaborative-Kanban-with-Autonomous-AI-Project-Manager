const cron = require('node-cron');
const { PrismaClient } = require('@prisma/client');
const { runPipeline } = require('./pipeline');

const prisma = new PrismaClient();
const scheduledJobs = new Map();

async function startScheduler(io) {
  console.log('AI Scheduler starting...');

  const defaultSchedule = process.env.AI_SCHEDULE || '0 */6 * * *';

  const boards = await prisma.board.findMany({
    select: { id: true, name: true, aiSchedule: true },
  });

  for (const board of boards) {
    scheduleBoard(board.id, board.aiSchedule || defaultSchedule, io);
  }

  console.log(`Scheduled AI pipelines for ${boards.length} board(s)`);
}

function scheduleBoard(boardId, schedule, io) {
  if (scheduledJobs.has(boardId)) {
    scheduledJobs.get(boardId).stop();
  }

  if (!cron.validate(schedule)) {
    console.error(`Invalid cron schedule for board ${boardId}: ${schedule}`);
    return;
  }

  const job = cron.schedule(schedule, () => {
    console.log(`Running scheduled AI pipeline for board ${boardId}`);
    runPipeline(boardId, io).catch(err => {
      console.error(`Scheduled pipeline error for board ${boardId}:`, err);
    });
  });

  scheduledJobs.set(boardId, job);
}

function stopScheduler() {
  for (const [boardId, job] of scheduledJobs) {
    job.stop();
  }
  scheduledJobs.clear();
}

module.exports = { startScheduler, scheduleBoard, stopScheduler };
