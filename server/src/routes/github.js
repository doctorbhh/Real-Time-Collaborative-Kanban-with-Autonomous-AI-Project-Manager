const express = require('express');
const { requireAuth, requireBoardMember } = require('../middleware/auth');
const { Octokit } = require('@octokit/rest');
const prisma = require('../db');

const router = express.Router();

const octokit = new Octokit({
  auth: process.env.GITHUB_TOKEN,
  userAgent: 'kanban-ai/1.0',
});

function parseRepoUrl(url) {
  const match = url
    .trim()
    .match(/github\.com\/([a-zA-Z0-9_.-]+)\/([a-zA-Z0-9_.-]+?)(?:\.git)?(?:\/.*)?$/);
  if (!match) return null;
  return { owner: match[1], repo: match[2] };
}

function getTotalCountFromLinkHeader(link) {
  if (!link) return 0;
  const match = link.match(/page=(\d+)>; rel="last"/);
  return match ? parseInt(match[1]) : 1;
}


router.post('/:boardId/github-import/preview', requireAuth, requireBoardMember, async (req, res) => {
  try {
    const { repoUrl } = req.body;
    if (!repoUrl) return res.status(400).json({ error: 'Repository URL is required' });

    const parsed = parseRepoUrl(repoUrl);
    if (!parsed) return res.status(400).json({ error: "That doesn't look like a GitHub repository URL" });

    const { owner, repo } = parsed;

    let response;
    try {
      response = await octokit.issues.listForRepo({
        owner,
        repo,
        state: 'open',
        per_page: 100,
        page: 1,
      });
    } catch (err) {
      if (err.status === 404) {
        return res.status(404).json({ error: "Repository not found \u2014 make sure it's public and the URL is correct" });
      }
      if (err.status === 403 && err.response?.headers['x-ratelimit-remaining'] === '0') {
        return res.status(429).json({ error: "GitHub rate limit reached. Add a GitHub token to your server environment to increase the limit to 5,000 requests/hour." });
      }
      throw err;
    }


    const existingCards = await prisma.card.findMany({
      where: {
        column: { boardId: req.params.boardId },
        githubIssueId: { not: null },
      },
      select: { githubIssueId: true },
    });
    const existingIds = new Set(existingCards.map(c => c.githubIssueId));

    let existingCount = 0;
    for (const id of existingIds) {
      if (id.startsWith(`${owner}/${repo}#`)) existingCount++;
    }

    const issuesOnly = response.data.filter(i => !i.pull_request);
    const hasMore = !!(response.headers.link && response.headers.link.includes('rel="next"'));
    
    let totalCount = issuesOnly.length;
    let newCount = Math.max(0, totalCount - existingCount);
    
    if (hasMore) {
      totalCount = totalCount + '+';
      newCount = newCount + '+';
    }

    res.json({
      repoUrl,
      owner,
      repo,
      totalCount,
      newCount,
      alreadyImported: existingCount,
      samples: issuesOnly
        .slice(0, 5)
        .map(i => ({
          number: i.number,
          title: i.title,
          labels: i.labels.map(l => (typeof l === 'string' ? { name: l, color: '#6366f1' } : { name: l.name, color: `#${l.color}` })),
          hasAssignee: i.assignees && i.assignees.length > 0,
          alreadyImported: existingIds.has(`${owner}/${repo}#${i.number}`),
        })),
    });
  } catch (err) {
    console.error('GitHub preview error:', err);
    res.status(500).json({ error: 'Could not reach GitHub. Check your server\'s internet connection.' });
  }
});


router.post('/:boardId/github-import', requireAuth, requireBoardMember, async (req, res) => {
  try {
    const { repoUrl, targetColumnId } = req.body;
    const { boardId } = req.params;

    if (!repoUrl || !targetColumnId) {
      return res.status(400).json({ error: 'Repository URL and target column are required' });
    }

    const parsed = parseRepoUrl(repoUrl);
    if (!parsed) return res.status(400).json({ error: "That doesn't look like a GitHub repository URL" });
    const { owner, repo } = parsed;


    const boardLabels = await prisma.label.findMany({ where: { boardId } });
    const labelMap = new Map(boardLabels.map(l => [l.name.toLowerCase(), l.id]));


    const boardMembers = await prisma.boardMember.findMany({
      where: { boardId },
      include: { user: { select: { id: true, githubUsername: true } } }
    });
    const ghUserMap = new Map(
      boardMembers
        .filter(m => m.user.githubUsername)
        .map(m => [m.user.githubUsername.toLowerCase(), m.user.id])
    );


    const existing = await prisma.card.findMany({
      where: { column: { boardId }, githubIssueId: { not: null } },
      select: { githubIssueId: true }
    });
    const existingIds = new Set(existing.map(c => c.githubIssueId));

    let allIssues = [];
    let page = 1;


    while (true) {
      let response;
      try {
        response = await octokit.issues.listForRepo({
          owner,
          repo,
          state: 'open',
          per_page: 100,
          page,
        });
      } catch (err) {
        if (err.status === 404) return res.status(404).json({ error: "Repository not found \u2014 make sure it's public and the URL is correct" });
        if (err.status === 403 && err.response?.headers['x-ratelimit-remaining'] === '0') {
          return res.status(429).json({ error: "GitHub rate limit reached. Try again later or add a GitHub token to your server." });
        }
        throw err;
      }

      const issues = response.data.filter(item => !item.pull_request);
      allIssues.push(...issues);

      if (response.data.length < 100) break;
      page++;
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    if (allIssues.length === 0) {
      return res.status(400).json({ error: "This repository has no open issues to import" });
    }


    const maxPos = await prisma.card.aggregate({
      where: { columnId: targetColumnId },
      _max: { order: true },
    });
    let order = (maxPos._max.order ?? -1) + 1;

    let imported = 0;
    let skipped = 0;

    for (const issue of allIssues) {
      const githubIssueId = `${owner}/${repo}#${issue.number}`;
      if (existingIds.has(githubIssueId)) {
        skipped++;
        continue;
      }

      try {

        const labelIds = [];
        for (const ghLabel of issue.labels) {
          const name = typeof ghLabel === 'string' ? ghLabel : ghLabel.name ?? '';
          const color = typeof ghLabel === 'string' ? '#6366f1' : `#${ghLabel.color}`;
          const key = name.toLowerCase();

          if (!labelMap.has(key)) {
            const newLabel = await prisma.label.create({
              data: { boardId, name, color }
            });
            labelMap.set(key, newLabel.id);
          }
          labelIds.push(labelMap.get(key));
        }


        const assigneeIds = (issue.assignees || [])
          .map(a => ghUserMap.get(a.login.toLowerCase()))
          .filter(id => id !== undefined);

        await prisma.card.create({
          data: {
            columnId: targetColumnId,
            title: `[#${issue.number}] ${issue.title}`,
            description: issue.body ?? null,
            referenceUrl: issue.html_url,
            githubIssueId,
            githubRepoUrl: repoUrl,
            order: order++,
            labels: labelIds.length ? { create: labelIds.map(id => ({ labelId: id })) } : undefined,
            assigneeId: assigneeIds.length > 0 ? assigneeIds[0] : null,
          }
        });
        imported++;
      } catch (err) {
        console.error(`Error importing issue #${issue.number}:`, err);
        return res.status(500).json({ error: `Import partially failed at issue #${issue.number}. ${imported} cards were created before the error.` });
      }
    }


    await prisma.githubImport.upsert({
      where: { repoUrl_boardId: { boardId, repoUrl } },
      create: { boardId, repoUrl, issueCount: imported },
      update: { lastSyncAt: new Date(), issueCount: { increment: imported } }
    });

    const io = req.app.get('io');
    io.to(`board:${boardId}`).emit('board:refresh', { reason: 'github-import' });

    res.json({ imported, skipped, total: allIssues.length });
  } catch (err) {
    console.error('GitHub import error:', err);
    res.status(500).json({ error: err.message || 'Could not reach GitHub. Check your server\'s internet connection.' });
  }
});


router.get('/:boardId/github-import/history', requireAuth, requireBoardMember, async (req, res) => {
  try {
    const history = await prisma.githubImport.findMany({
      where: { boardId: req.params.boardId },
      orderBy: { lastSyncAt: 'desc' },
    });
    res.json(history);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch import history' });
  }
});

module.exports = router;
