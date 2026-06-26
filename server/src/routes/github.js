const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { requireAuth, requireBoardMember } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

function parseGithubUrl(url) {
  const match = url.match(/github\.com\/([^/]+)\/([^/]+)/);
  if (!match) return null;
  return { owner: match[1], repo: match[2].replace('.git', '') };
}

async function fetchGithubIssues(owner, repo, page = 1, perPage = 100) {
  const url = `https://api.github.com/repos/${owner}/${repo}/issues?state=open&per_page=${perPage}&page=${page}&sort=created&direction=desc`;
  const response = await fetch(url, {
    headers: {
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'KanbanAI-Scraper',
    },
  });

  if (!response.ok) {
    throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
  }

  const issues = await response.json();
  const filtered = issues.filter(i => !i.pull_request);

  const linkHeader = response.headers.get('link');
  const hasMore = linkHeader && linkHeader.includes('rel="next"');

  return { issues: filtered, hasMore };
}

router.post('/:boardId/github-import/preview', requireAuth, requireBoardMember, async (req, res) => {
  try {
    const { repoUrl } = req.body;
    if (!repoUrl) return res.status(400).json({ error: 'Repository URL is required' });

    const parsed = parseGithubUrl(repoUrl);
    if (!parsed) return res.status(400).json({ error: 'Invalid GitHub repository URL' });

    const { issues, hasMore } = await fetchGithubIssues(parsed.owner, parsed.repo, 1, 30);

    const existingCards = await prisma.card.findMany({
      where: {
        githubRepoUrl: repoUrl,
        column: { boardId: req.params.boardId },
      },
      select: { githubIssueId: true },
    });
    const existingIds = new Set(existingCards.map(c => c.githubIssueId));

    const preview = issues.map(issue => ({
      number: issue.number,
      title: issue.title,
      labels: issue.labels.map(l => ({ name: l.name, color: `#${l.color}` })),
      assignees: issue.assignees.map(a => a.login),
      alreadyImported: existingIds.has(issue.number),
      createdAt: issue.created_at,
    }));

    let totalCount = issues.length;
    if (hasMore) {
      const repoRes = await fetch(`https://api.github.com/repos/${parsed.owner}/${parsed.repo}`, {
        headers: { 'Accept': 'application/vnd.github.v3+json', 'User-Agent': 'KanbanAI-Scraper' },
      });
      if (repoRes.ok) {
        const repoData = await repoRes.json();
        totalCount = repoData.open_issues_count;
      }
    }

    res.json({
      repoUrl,
      owner: parsed.owner,
      repo: parsed.repo,
      totalIssues: totalCount,
      previewIssues: preview,
      hasMore,
      alreadyImportedCount: existingIds.size,
    });
  } catch (err) {
    console.error('GitHub preview error:', err);
    res.status(500).json({ error: err.message || 'Failed to preview GitHub issues' });
  }
});

router.post('/:boardId/github-import', requireAuth, requireBoardMember, async (req, res) => {
  try {
    const { repoUrl, targetColumnId } = req.body;
    if (!repoUrl || !targetColumnId) {
      return res.status(400).json({ error: 'Repository URL and target column are required' });
    }

    const parsed = parseGithubUrl(repoUrl);
    if (!parsed) return res.status(400).json({ error: 'Invalid GitHub repository URL' });

    const existingCards = await prisma.card.findMany({
      where: {
        githubRepoUrl: repoUrl,
        column: { boardId: req.params.boardId },
      },
      select: { githubIssueId: true },
    });
    const existingIds = new Set(existingCards.map(c => c.githubIssueId));

    const boardLabels = await prisma.label.findMany({
      where: { boardId: req.params.boardId },
    });
    const labelMap = new Map(boardLabels.map(l => [l.name.toLowerCase(), l]));

    const boardMembers = await prisma.boardMember.findMany({
      where: { boardId: req.params.boardId },
      include: { user: { select: { id: true, githubUsername: true } } },
    });
    const memberMap = new Map(
      boardMembers
        .filter(m => m.user.githubUsername)
        .map(m => [m.user.githubUsername.toLowerCase(), m.user.id])
    );

    let allIssues = [];
    let page = 1;
    let hasMore = true;
    while (hasMore) {
      const result = await fetchGithubIssues(parsed.owner, parsed.repo, page);
      allIssues = allIssues.concat(result.issues);
      hasMore = result.hasMore;
      page++;
      if (page > 20) break; // Safety limit
    }

    const newIssues = allIssues.filter(i => !existingIds.has(i.number));

    const maxPos = await prisma.card.aggregate({
      where: { columnId: targetColumnId },
      _max: { position: true },
    });
    let position = (maxPos._max.position ?? -1) + 1;

    let importedCount = 0;

    for (const issue of newIssues) {
      const cardLabelIds = [];
      for (const ghLabel of issue.labels) {
        let label = labelMap.get(ghLabel.name.toLowerCase());
        if (!label) {
          label = await prisma.label.create({
            data: { name: ghLabel.name, color: `#${ghLabel.color}`, boardId: req.params.boardId },
          });
          labelMap.set(ghLabel.name.toLowerCase(), label);
        }
        cardLabelIds.push(label.id);
      }

      let assigneeId = null;
      if (issue.assignees.length > 0) {
        const ghLogin = issue.assignees[0].login.toLowerCase();
        assigneeId = memberMap.get(ghLogin) || null;
      }

      await prisma.card.create({
        data: {
          title: issue.title,
          description: issue.body || null,
          position: position++,
          columnId: targetColumnId,
          assigneeId,
          githubIssueId: issue.number,
          githubRepoUrl: repoUrl,
          referenceUrl: issue.html_url,
          labels: cardLabelIds.length > 0 ? {
            create: cardLabelIds.map(labelId => ({ labelId })),
          } : undefined,
        },
      });
      importedCount++;
    }

    await prisma.githubImport.upsert({
      where: { repoUrl_boardId: { repoUrl, boardId: req.params.boardId } },
      update: { lastSyncAt: new Date(), issueCount: allIssues.length },
      create: { repoUrl, boardId: req.params.boardId, issueCount: allIssues.length },
    });

    const io = req.app.get('io');
    io.to(req.params.boardId).emit('board:refresh', { reason: 'github-import' });

    res.json({
      imported: importedCount,
      skipped: allIssues.length - newIssues.length,
      total: allIssues.length,
    });
  } catch (err) {
    console.error('GitHub import error:', err);
    res.status(500).json({ error: err.message || 'Failed to import GitHub issues' });
  }
});

module.exports = router;
