const { detectBottlenecks } = require('./bottleneck');
const { assessSprintRisk } = require('./sprintRisk');
const { suggestAssignments } = require('./autoAssign');
const { generateDigest } = require('./digest');

const prisma = require('../db');

const delay = ms => new Promise(res => setTimeout(res, ms));

async function runPipeline(boardId, io) {
  console.log(`AI Pipeline starting for board: ${boardId}`);

  const emitProgress = (type, status, message) => {
    if (io) {
      io.to(`board:${boardId}`).emit('ai:progress', { type, status, message });
    }
  };

  try {
    if (io) io.to(`board:${boardId}`).emit('ai:analyzing', { phase: 'bottleneck' });
    emitProgress('bottleneck', 'running', 'Analyzing column flow rates...');
    const { bottlenecks, aiAnalysis: bnAnalysis } = await detectBottlenecks(boardId, io);

    for (const bn of bottlenecks) {
      const insightData = { ...bn, aiAnalysis: bnAnalysis };
      const insight = await prisma.aiInsight.create({
        data: {
          type: 'bottleneck',
          data: insightData,
          boardId,
        },
      });

      if (io) {
        io.to(`board:${boardId}`).emit('ai:insight', { insight });
      }
    }
    emitProgress('bottleneck', 'done', `Found ${bottlenecks.length} bottleneck(s)`);

    await delay(15000); 

    if (io) io.to(`board:${boardId}`).emit('ai:analyzing', { phase: 'sprint_risk' });
    emitProgress('sprint_risk', 'running', 'Calculating sprint velocity...');
    const sprintRisk = await assessSprintRisk(boardId, io);

    if (sprintRisk) {
      const insight = await prisma.aiInsight.create({
        data: {
          type: 'sprint_risk',
          data: sprintRisk,
          boardId,
        },
      });

      if (io) {
        io.to(`board:${boardId}`).emit('ai:insight', { insight });
      }
      emitProgress('sprint_risk', 'done', `Sprint risk: ${sprintRisk.risk}`);
    } else {
      emitProgress('sprint_risk', 'skipped', 'No sprint deadline configured');
    }

    await delay(15000); 

    if (io) io.to(`board:${boardId}`).emit('ai:analyzing', { phase: 'auto_assign' });
    emitProgress('auto_assign', 'running', 'Suggesting assignees for unassigned tasks...');
    const autoAssigns = await suggestAssignments(boardId, io);

    for (const assignment of autoAssigns) {
      const insight = await prisma.aiInsight.create({
        data: {
          type: 'auto_assign',
          data: assignment,
          boardId,
        },
      });

      if (io) {
        io.to(`board:${boardId}`).emit('ai:insight', { insight });
      }
    }
    emitProgress('auto_assign', 'done', `Generated ${autoAssigns.length} assignment suggestion(s)`);

    const today = new Date();
    const dayOfWeek = today.getDay();
    const lastDigest = await prisma.digestReport.findFirst({
      where: { boardId },
      orderBy: { createdAt: 'desc' },
    });

    const shouldGenerateDigest = !lastDigest ||
      (Date.now() - new Date(lastDigest.createdAt).getTime()) > 6 * 24 * 60 * 60 * 1000;

    if (shouldGenerateDigest) {
      await delay(15000); 
      emitProgress('digest', 'running', 'Generating weekly digest...');
      const digest = await generateDigest(boardId);
      if (digest && io) {
        io.to(`board:${boardId}`).emit('ai:digest', { digest: digest.data });
      }
      emitProgress('digest', 'done', 'Weekly digest generated');
    }

    if (io) io.to(`board:${boardId}`).emit('ai:analyzing', { phase: 'complete' });
    console.log(`AI Pipeline completed for board: ${boardId}`);
  } catch (err) {
    console.error(`AI Pipeline error for board ${boardId}:`, err);
    emitProgress('error', 'error', `Pipeline failed: ${err.message}`);
  }
}

module.exports = { runPipeline };
