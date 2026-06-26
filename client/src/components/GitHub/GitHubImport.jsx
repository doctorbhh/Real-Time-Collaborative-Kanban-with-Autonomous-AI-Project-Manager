import { useState } from 'react';
import { GithubIcon, CircleCheckBigIcon } from "@animateicons/react/lucide";
import api from '../../utils/api';
import { useToast } from '../../context/ToastContext';

export default function GitHubImport({ boardId, columns }) {
  const [repoUrl, setRepoUrl] = useState('');
  const [preview, setPreview] = useState(null);
  const [targetColumnId, setTargetColumnId] = useState('');
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState(null);
  const { addToast } = useToast();

  const handlePreview = async () => {
    if (!repoUrl.trim()) return;
    setLoading(true);
    setPreview(null);
    setResult(null);
    try {
      const data = await api.previewImport(boardId, { repoUrl: repoUrl.trim() });
      setPreview(data);
      if (!targetColumnId && columns?.length > 0) {
        setTargetColumnId(columns[0].id);
      }
    } catch (err) {
      addToast(err.message || 'Failed to preview issues', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async () => {
    if (!targetColumnId) {
      addToast('Select a target column', 'error');
      return;
    }
    setImporting(true);
    try {
      const data = await api.importIssues(boardId, { repoUrl: repoUrl.trim(), targetColumnId });
      setResult(data);
      addToast(`Imported ${data.imported} issues!`, 'success');
    } catch (err) {
      addToast(err.message || 'Import failed', 'error');
    } finally {
      setImporting(false);
    }
  };

  return (
    <div style={{ maxWidth: 600 }}>
      <h2 className="headline-md" style={{ marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
        <GithubIcon size="24" /> GitHub Issues Import
      </h2>
      <p className="body-md" style={{ color: 'var(--outline)', marginBottom: 24 }}>
        Import open issues from any public GitHub repository. Labels and assignees are mapped automatically.
      </p>

      <div className="github-input-row">
        <input
          className="input"
          value={repoUrl}
          onChange={e => setRepoUrl(e.target.value)}
          placeholder="https://github.com/owner/repo"
          onKeyDown={e => e.key === 'Enter' && handlePreview()}
          style={{ border: '1px solid var(--outline-variant)' }}
        />
        <button className="btn btn-primary" onClick={handlePreview} disabled={loading}>
          {loading ? 'Loading...' : 'Preview'}
        </button>
      </div>

      {preview && (
        <div style={{ marginTop: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div>
              <strong className="title-md">{preview.owner}/{preview.repo}</strong>
              <div className="label-md" style={{ color: 'var(--outline)', marginTop: 4 }}>
                {preview.totalIssues} open issues · {preview.alreadyImportedCount} already imported
              </div>
            </div>
          </div>

          <div className="input-group" style={{ marginBottom: 16 }}>
            <label className="input-label">Import to Column</label>
            <select
              className="input"
              value={targetColumnId}
              onChange={e => setTargetColumnId(e.target.value)}
              style={{ border: '1px solid var(--outline-variant)', borderRadius: 'var(--radius)', padding: '8px 12px' }}
            >
              {columns?.map(col => (
                <option key={col.id} value={col.id}>{col.name}</option>
              ))}
            </select>
          </div>

          <div className="github-preview-list">
            {preview.previewIssues.map(issue => (
              <div key={issue.number} className={`github-issue-row ${issue.alreadyImported ? 'imported' : ''}`}>
                <span className="github-issue-number">#{issue.number}</span>
                <span className="github-issue-title">{issue.title}</span>
                {issue.labels.map(l => (
                  <span key={l.name} className="label-chip" style={{
                    backgroundColor: `${l.color}18`,
                    color: l.color,
                    fontSize: 10,
                  }}>
                    {l.name}
                  </span>
                ))}
                {issue.alreadyImported && <span className="chip chip-neutral">Imported</span>}
              </div>
            ))}
            {preview.hasMore && (
              <div style={{ padding: 12, textAlign: 'center', color: 'var(--outline)', fontSize: 13 }}>
                ... and {preview.totalIssues - preview.previewIssues.length} more issues
              </div>
            )}
          </div>

          <div style={{ marginTop: 16, display: 'flex', gap: 12 }}>
            <button className="btn btn-primary btn-lg" onClick={handleImport} disabled={importing}>
              {importing ? 'Importing...' : `Import ${preview.totalIssues - preview.alreadyImportedCount} Issues`}
            </button>
          </div>

          {result && (
            <div style={{ marginTop: 16, padding: 16, borderRadius: 'var(--radius-md)', background: 'var(--surface-container-highest)', color: 'var(--secondary)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <CircleCheckBigIcon size="20" /> Imported {result.imported} issues, skipped {result.skipped} duplicates
            </div>
          )}
        </div>
      )}
    </div>
  );
}
