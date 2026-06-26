const { PrismaClient } = require('@prisma/client');
const { detectBottlenecks } = require('./bottleneck');
const { assessSprintRisk } = require('./sprintRisk');
const { inferComplexity } = require('./complexity');
const { generateDigest } = require('./digest');

const prisma = new PrismaClient();

async function runPipeline(boardId, io) {
  console.log(`AI Pipeline starting for board: ${boardId}`);

  const emitProgress = (type, status, message) => {
    if (io) {
      io.to(boardId).emit('ai:progress', { type, status, message });
    }
  };

  try {
    emitProgress('bottleneck', 'running', 'Analyzing column flow rates...');
    const bottlenecks = await detectBottlenecks(boardId);

    for (const bn of bottlenecks) {
      const insight = await prisma.aiInsight.create({
        data: {
          type: 'bottleneck',
          data: bn,
          boardId,
        },
      });

      if (io) {
        io.to(boardId).emit('ai:insight', { insight });
      }
    }
    emitProgress('bottleneck', 'done', `Found ${bottlenecks.length} bottleneck(s)`);

    emitProgress('sprint_risk', 'running', 'Calculating sprint velocity...');
    const sprintRisk = await assessSprintRisk(boardId);

    if (sprintRisk) {
      const insight = await prisma.aiInsight.create({
        data: {
          type: 'sprint_risk',
          data: sprintRisk,
          boardId,
        },
      });

      if (io) {
        io.to(boardId).emit('ai:insight', { insight });
      }
      emitProgress('sprint_risk', 'done', `Sprint risk: ${sprintRisk.risk}`);
    } else {
      emitProgress('sprint_risk', 'skipped', 'No sprint deadline configured');
    }

    emitProgress('complexity', 'running', 'Inferring task complexity with AI...');
    const complexityResults = await inferComplexity(boardId);

    for (const result of complexityResults) {
      const insight = await prisma.aiInsight.create({
        data: {
          type: 'complexity',
          data: result,
          boardId,
        },
      });

      if (io) {
        io.to(boardId).emit('ai:insight', { insight });
      }
    }
    emitProgress('complexity', 'done', `Inferred complexity for ${complexityResults.length} card(s)`);

    const today = new Date();
    const dayOfWeek = today.getDay();
    const lastDigest = await prisma.digestReport.findFirst({
      where: { boardId },
      orderBy: { createdAt: 'desc' },
    });

    const shouldGenerateDigest = !lastDigest ||
      (Date.now() - new Date(lastDigest.createdAt).getTime()) > 6 * 24 * 60 * 60 * 1000;

    if (shouldGenerateDigest) {
      emitProgress('digest', 'running', 'Generating weekly digest...');
      const digest = await generateDigest(boardId);
      if (digest && io) {
        io.to(boardId).emit('ai:digest', { digest: digest.data });
      }
      emitProgress('digest', 'done', 'Weekly digest generated');
    }

    console.log(`AI Pipeline completed for board: ${boardId}`);
  } catch (err) {
    console.error(`AI Pipeline error for board ${boardId}:`, err);
    emitProgress('error', 'error', `Pipeline failed: ${err.message}`);
  }
}

module.exports = { runPipeline };
